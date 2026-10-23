"use server";

import { createHash, randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { Setting } from "@/lib/types";
import {
  APP_LAYER_PERMISSION_IDS,
  permissionKeyForId,
} from "./permissions";
import {
  appendAudit,
  checkPermission,
  getActiveWorkspace,
  resolveRoleUuid,
} from "./server";

/**
 * Mutating server actions. EVERY action: (1) resolves the actor's
 * active workspace from the real session, (2) checks the actor's
 * permission via the has_permission RPC BEFORE writing (RLS is the
 * second line of defence, not the only one), (3) writes, (4) appends
 * an audit_log entry, (5) revalidates the affected routes.
 */

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

const DENIED: ActionResult = {
  ok: false,
  error: "You don't have permission to do this in this workspace.",
};

async function actor() {
  const ws = await getActiveWorkspace();
  if (!ws) return null;
  if (!ws.isActive) return null; // deactivated members cannot act
  return ws;
}

function newToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

/* ------------------------------------------------------------------ */
/* Invitations                                                         */
/* ------------------------------------------------------------------ */

export async function createInvitation(input: {
  email: string;
  roleId: string;
  teamId?: string;
  message?: string;
}): Promise<ActionResult & { invitePath?: string }> {
  const ws = await actor();
  if (!ws) return { ok: false, error: "Sign in first." };
  if (!(await checkPermission(ws.orgId, "members:invite"))) return DENIED;
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s]+@[^\s]+\.[^\s]+$/.test(email))
    return { ok: false, error: "That email address doesn't look right." };
  const roleUuid = await resolveRoleUuid(ws.orgId, input.roleId);
  if (!roleUuid) return { ok: false, error: "That role doesn't exist." };

  const supabase = await createClient();
  // Already a member? The preview RPC from 00012 answers without
  // exposing auth.users.
  const { data: existing } = await supabase.rpc("org_member_id_by_email", {
    p_org_id: ws.orgId,
    p_email: email,
  });
  if (existing) return { ok: false, error: `${email} is already a member.` };

  const { raw, hash } = newToken();
  const { data, error } = await supabase
    .from("invitations")
    .insert({
      org_id: ws.orgId,
      email,
      role_id: roleUuid,
      team_ids: input.teamId ? [input.teamId] : [],
      token_hash: hash,
      invited_by: ws.userId,
      message: input.message?.trim() || null,
      source: "manual",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await appendAudit({
    orgId: ws.orgId,
    actorId: ws.userId,
    action: "invitation.created",
    targetType: "invitation",
    targetId: data.id,
    targetLabel: email,
    summary: `Invited ${email}`,
  });
  revalidatePath("/app/invitations");
  revalidatePath("/app/people");
  // The raw token exists only here and in the invite link — the DB
  // stores its SHA-256 hash. Email delivery runs through the
  // send-invitation Edge Function (Resend); the link is returned so
  // the inviter can share it if email is not configured.
  return { ok: true, invitePath: `/invite/${raw}` };
}

export async function resendInvitation(
  invitationId: string,
): Promise<ActionResult & { invitePath?: string }> {
  const ws = await actor();
  if (!ws) return { ok: false, error: "Sign in first." };
  if (!(await checkPermission(ws.orgId, "invitations:manage"))) return DENIED;
  const supabase = await createClient();
  const { data: inv } = await supabase
    .from("invitations")
    .select("id, email, status, resend_count")
    .eq("id", invitationId)
    .eq("org_id", ws.orgId)
    .single();
  if (!inv) return { ok: false, error: "Invitation not found." };
  if (inv.status !== "pending")
    return { ok: false, error: "Only an open invitation can be resent." };
  const { raw, hash } = newToken();
  const { error } = await supabase
    .from("invitations")
    .update({
      token_hash: hash,
      resend_count: inv.resend_count + 1,
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    })
    .eq("id", invitationId);
  if (error) return { ok: false, error: error.message };
  await appendAudit({
    orgId: ws.orgId,
    actorId: ws.userId,
    action: "invitation.resent",
    targetType: "invitation",
    targetId: invitationId,
    targetLabel: inv.email,
    summary: `Resent the invitation to ${inv.email}`,
  });
  revalidatePath("/app/invitations");
  return { ok: true, invitePath: `/invite/${raw}` };
}

export async function revokeInvitation(
  invitationId: string,
): Promise<ActionResult> {
  const ws = await actor();
  if (!ws) return { ok: false, error: "Sign in first." };
  if (!(await checkPermission(ws.orgId, "invitations:manage"))) return DENIED;
  const supabase = await createClient();
  const { data: inv } = await supabase
    .from("invitations")
    .select("email")
    .eq("id", invitationId)
    .eq("org_id", ws.orgId)
    .single();
  const { error } = await supabase
    .from("invitations")
    .update({ status: "revoked" })
    .eq("id", invitationId)
    .eq("org_id", ws.orgId);
  if (error) return { ok: false, error: error.message };
  await appendAudit({
    orgId: ws.orgId,
    actorId: ws.userId,
    action: "invitation.revoked",
    targetType: "invitation",
    targetId: invitationId,
    targetLabel: inv?.email,
    summary: `Revoked the invitation to ${inv?.email ?? "a guest"}`,
  });
  revalidatePath("/app/invitations");
  revalidatePath("/app/people");
  return { ok: true };
}

export async function importInvitations(
  rows: { email: string; roleId: string; teamId?: string }[],
): Promise<ActionResult & { created?: number }> {
  const ws = await actor();
  if (!ws) return { ok: false, error: "Sign in first." };
  if (!(await checkPermission(ws.orgId, "members:invite"))) return DENIED;
  if (!(await checkPermission(ws.orgId, "invitations:manage"))) return DENIED;
  const supabase = await createClient();
  let created = 0;
  for (const row of rows) {
    const roleUuid = await resolveRoleUuid(ws.orgId, row.roleId);
    if (!roleUuid) continue;
    const { data: existing } = await supabase.rpc("org_member_id_by_email", {
      p_org_id: ws.orgId,
      p_email: row.email,
    });
    if (existing) continue;
    const { hash } = newToken();
    const { error } = await supabase.from("invitations").insert({
      org_id: ws.orgId,
      email: row.email.trim().toLowerCase(),
      role_id: roleUuid,
      team_ids: row.teamId ? [row.teamId] : [],
      token_hash: hash,
      invited_by: ws.userId,
      source: "bulk",
    });
    if (!error) created++;
  }
  await appendAudit({
    orgId: ws.orgId,
    actorId: ws.userId,
    action: "invitation.imported",
    targetType: "invitation",
    summary: `Imported ${created} invitation${created === 1 ? "" : "s"} from CSV`,
  });
  revalidatePath("/app/invitations");
  return { ok: true, created };
}

/** Accept an invitation by raw token (migration 00007 RPC). */
export async function acceptInvitation(token: string): Promise<ActionResult> {
  const ws = await getActiveWorkspace().catch(() => null);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in or create an account first." };
  void ws;
  const { error } = await supabase.rpc("accept_invitation", {
    p_token: token,
    p_user_id: user.id,
  });
  if (error) return { ok: false, error: error.message.replace(/^crewspace:\s*/, "") };
  revalidatePath("/app");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Roles — the register                                                */
/* ------------------------------------------------------------------ */

async function writeRoleSetting(
  roleUuid: string,
  permissionId: number,
  to: Setting,
  userId: string,
): Promise<void> {
  // Used only by createRole — the register's draft flow goes through
  // the 00019 RPCs below. Translation mirrors Worker S's seed rule:
  // allow = grant row, deny = deny row, inherit = neither — EXCEPT
  // permission 3 (baseline allows it: inherit is stored as a grant)
  // and permission 18 (locked/deny/inherit all land as a deny row for
  // non-owners). App-layer ids (12/14/16) have no row at all.
  if (APP_LAYER_PERMISSION_IDS.has(permissionId)) return;
  const supabase = await createClient();
  const key = permissionKeyForId(permissionId);
  if (!key) return;
  await supabase
    .from("role_permissions")
    .delete()
    .eq("role_id", roleUuid)
    .eq("permission_key", key);
  await supabase
    .from("role_permission_denies")
    .delete()
    .eq("role_id", roleUuid)
    .eq("permission_key", key);
  const grant =
    to === "allow" || (permissionId === 3 && to === "inherit");
  const deny =
    to === "deny" ||
    to === "locked" ||
    (permissionId === 18 && to === "inherit");
  if (grant) {
    await supabase
      .from("role_permissions")
      .insert({ role_id: roleUuid, permission_key: key, granted_by: userId });
  } else if (deny) {
    await supabase
      .from("role_permission_denies")
      .insert({ role_id: roleUuid, permission_key: key, denied_by: userId });
  }
}

/**
 * Create a custom role (roles:create) with the wizard's register
 * settings, translated to grant/deny rows by writeRoleSetting.
 * Returns the new role's DB id (its UI id — custom roles have no
 * system key).
 */
export async function createRole(input: {
  name: string;
  summary?: string;
  settings: Record<string, Setting>;
}): Promise<ActionResult & { roleId?: string }> {
  const ws = await actor();
  if (!ws) return { ok: false, error: "Sign in first." };
  if (!(await checkPermission(ws.orgId, "roles:create"))) return DENIED;
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Give the role a name." };
  const supabase = await createClient();
  const { data: role, error } = await supabase
    .from("roles")
    .insert({
      org_id: ws.orgId,
      name,
      description: input.summary?.trim() || null,
      is_system: false,
      created_by: ws.userId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  for (const [idStr, setting] of Object.entries(input.settings)) {
    const permissionId = Number(idStr);
    if (!Number.isNaN(permissionId)) {
      await writeRoleSetting(role.id, permissionId, setting, ws.userId);
    }
  }
  await appendAudit({
    orgId: ws.orgId,
    actorId: ws.userId,
    action: "role.created",
    targetType: "role",
    targetId: role.id,
    targetLabel: name,
    summary: `Created role ${name}`,
  });
  revalidatePath("/app/roles");
  return { ok: true, roleId: role.id };
}

/**
 * Register draft flow (00019): toggling a permission in R-04 PROPOSES
 * a change (role_permission_changes row) — committed grants/denies do
 * not move until Apply. Toggling back to the committed state discards
 * the pending row instead. The RPCs re-check roles:update server-side
 * and apply writes the audit row.
 */
export async function proposeRoleChange(
  roleUiId: string,
  permissionId: number,
  to: Setting,
): Promise<ActionResult> {
  const ws = await actor();
  if (!ws) return { ok: false, error: "Sign in first." };
  if (!(await checkPermission(ws.orgId, "roles:update"))) return DENIED;
  if (APP_LAYER_PERMISSION_IDS.has(permissionId))
    return {
      ok: false,
      error:
        "That register row is managed at the platform layer and can't be changed here.",
    };
  const key = permissionKeyForId(permissionId);
  if (!key) return { ok: false, error: "Unknown permission." };
  const roleUuid = await resolveRoleUuid(ws.orgId, roleUiId);
  if (!roleUuid) return { ok: false, error: "That role doesn't exist." };
  const supabase = await createClient();

  const [{ data: pending }, { data: grant }, { data: deny }] =
    await Promise.all([
      supabase
        .from("role_permission_changes")
        .select("id, to_state")
        .eq("role_id", roleUuid)
        .eq("permission_key", key)
        .eq("status", "pending")
        .maybeSingle(),
      supabase
        .from("role_permissions")
        .select("permission_key")
        .eq("role_id", roleUuid)
        .eq("permission_key", key)
        .maybeSingle(),
      supabase
        .from("role_permission_denies")
        .select("permission_key")
        .eq("role_id", roleUuid)
        .eq("permission_key", key)
        .maybeSingle(),
    ]);
  const committed: Setting =
    permissionId === 18 && !grant
      ? "locked"
      : deny
        ? "deny"
        : grant
          ? "allow"
          : "inherit";

  if (to === committed) {
    // Toggled back to the committed state: drop the draft row.
    if (pending) {
      const { error } = await supabase.rpc("discard_permission_change", {
        p_change_id: pending.id,
      });
      if (error) return { ok: false, error: error.message };
    }
    revalidatePath(`/app/roles/${roleUiId}`);
    return { ok: true };
  }
  if (pending) {
    if (pending.to_state === to) return { ok: true };
    // Changing one's mind: discard the old draft, propose the new one.
    const { error } = await supabase.rpc("discard_permission_change", {
      p_change_id: pending.id,
    });
    if (error) return { ok: false, error: error.message };
  }
  const { error } = await supabase.rpc("propose_permission_change", {
    p_role_id: roleUuid,
    p_permission_key: key,
    p_to_state: to,
  });
  if (error)
    return { ok: false, error: error.message.replace(/^crewspace:\s*/, "") };
  revalidatePath(`/app/roles/${roleUiId}`);
  revalidatePath("/app/roles");
  revalidatePath("/app");
  return { ok: true };
}

async function pendingChangeIdsForRole(
  roleUuid: string,
): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("role_permission_changes")
    .select("id")
    .eq("role_id", roleUuid)
    .eq("status", "pending");
  return (data ?? []).map((r) => r.id);
}

/** Review → Apply: every pending row for the role is applied via RPC
    (each apply writes committed state + its audit row atomically). */
export async function applyRoleChanges(roleUiId: string): Promise<ActionResult> {
  const ws = await actor();
  if (!ws) return { ok: false, error: "Sign in first." };
  if (!(await checkPermission(ws.orgId, "roles:update"))) return DENIED;
  const roleUuid = await resolveRoleUuid(ws.orgId, roleUiId);
  if (!roleUuid) return { ok: false, error: "That role doesn't exist." };
  const supabase = await createClient();
  const ids = await pendingChangeIdsForRole(roleUuid);
  for (const id of ids) {
    const { error } = await supabase.rpc("apply_permission_change", {
      p_change_id: id,
    });
    if (error)
      return { ok: false, error: error.message.replace(/^crewspace:\s*/, "") };
  }
  revalidatePath(`/app/roles/${roleUiId}`);
  revalidatePath("/app/roles");
  revalidatePath("/app/audit");
  revalidatePath("/app");
  return { ok: true };
}

/** Review → Discard: every pending row for the role is discarded. */
export async function discardRoleChanges(
  roleUiId: string,
): Promise<ActionResult> {
  const ws = await actor();
  if (!ws) return { ok: false, error: "Sign in first." };
  if (!(await checkPermission(ws.orgId, "roles:update"))) return DENIED;
  const roleUuid = await resolveRoleUuid(ws.orgId, roleUiId);
  if (!roleUuid) return { ok: false, error: "That role doesn't exist." };
  const supabase = await createClient();
  const ids = await pendingChangeIdsForRole(roleUuid);
  for (const id of ids) {
    const { error } = await supabase.rpc("discard_permission_change", {
      p_change_id: id,
    });
    if (error)
      return { ok: false, error: error.message.replace(/^crewspace:\s*/, "") };
  }
  revalidatePath(`/app/roles/${roleUiId}`);
  revalidatePath("/app/roles");
  revalidatePath("/app");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Members                                                             */
/* ------------------------------------------------------------------ */

export async function updateMemberRole(
  membershipId: string,
  roleUiId: string,
): Promise<ActionResult> {
  const ws = await actor();
  if (!ws) return { ok: false, error: "Sign in first." };
  if (!(await checkPermission(ws.orgId, "members:change_role"))) return DENIED;
  const roleUuid = await resolveRoleUuid(ws.orgId, roleUiId);
  if (!roleUuid) return { ok: false, error: "That role doesn't exist." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("memberships")
    .update({ role_id: roleUuid })
    .eq("id", membershipId)
    .eq("org_id", ws.orgId);
  if (error) return { ok: false, error: error.message };
  await appendAudit({
    orgId: ws.orgId,
    actorId: ws.userId,
    action: "membership.role_changed",
    targetType: "membership",
    targetId: membershipId,
    summary: "Changed a member's role",
  });
  revalidatePath("/app/people");
  revalidatePath(`/app/people/${membershipId}`);
  return { ok: true };
}

export async function setMemberActive(
  membershipId: string,
  active: boolean,
): Promise<ActionResult> {
  const ws = await actor();
  if (!ws) return { ok: false, error: "Sign in first." };
  if (!(await checkPermission(ws.orgId, "members:deactivate"))) return DENIED;
  if (membershipId === ws.membershipId && !active)
    return { ok: false, error: "You can't deactivate yourself." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("memberships")
    .update({
      is_active: active,
      deactivated_at: active ? null : new Date().toISOString(),
      deactivated_by: active ? null : ws.userId,
    })
    .eq("id", membershipId)
    .eq("org_id", ws.orgId);
  if (error) return { ok: false, error: error.message };
  await appendAudit({
    orgId: ws.orgId,
    actorId: ws.userId,
    action: active ? "membership.reactivated" : "membership.deactivated",
    targetType: "membership",
    targetId: membershipId,
    summary: active ? "Reactivated a member" : "Deactivated a member",
  });
  revalidatePath("/app/people");
  revalidatePath(`/app/people/${membershipId}`);
  return { ok: true };
}

export async function setTeamMembership(
  membershipId: string,
  teamId: string,
  add: boolean,
): Promise<ActionResult> {
  const ws = await actor();
  if (!ws) return { ok: false, error: "Sign in first." };
  if (!(await checkPermission(ws.orgId, "teams:manage"))) return DENIED;
  const supabase = await createClient();
  if (add) {
    const { error } = await supabase.from("team_memberships").insert({
      team_id: teamId,
      membership_id: membershipId,
      added_by: ws.userId,
    });
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("team_memberships")
      .delete()
      .eq("team_id", teamId)
      .eq("membership_id", membershipId);
    if (error) return { ok: false, error: error.message };
  }
  await appendAudit({
    orgId: ws.orgId,
    actorId: ws.userId,
    action: add ? "team.member_added" : "team.member_removed",
    targetType: "team",
    targetId: teamId,
    summary: add ? "Added a member to a team" : "Removed a member from a team",
  });
  revalidatePath("/app/teams");
  revalidatePath(`/app/teams/${teamId}`);
  revalidatePath("/app/people");
  return { ok: true };
}

export async function createTeam(input: {
  name: string;
  blurb: string;
}): Promise<ActionResult> {
  const ws = await actor();
  if (!ws) return { ok: false, error: "Sign in first." };
  if (!(await checkPermission(ws.orgId, "teams:create"))) return DENIED;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teams")
    .insert({
      org_id: ws.orgId,
      name: input.name.trim(),
      description: input.blurb.trim() || null,
      created_by: ws.userId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  await appendAudit({
    orgId: ws.orgId,
    actorId: ws.userId,
    action: "team.created",
    targetType: "team",
    targetId: data.id,
    targetLabel: input.name,
    summary: `Created the team ${input.name}`,
  });
  revalidatePath("/app/teams");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Settings + profile                                                  */
/* ------------------------------------------------------------------ */

export async function updateOrgSettings(input: {
  name?: string;
  domain?: string;
  defaultRoleUiId?: string;
  /** Per-seat price in DOLLARS (UI) — stored as seat_price_cents (00018). */
  pricePerSeat?: number;
  /** organizations.session_timeout_minutes (00009). */
  sessionTimeoutMinutes?: number;
}): Promise<ActionResult> {
  const ws = await actor();
  if (!ws) return { ok: false, error: "Sign in first." };
  if (!(await checkPermission(ws.orgId, "settings:manage"))) return DENIED;
  const supabase = await createClient();
  const patch: {
    name?: string;
    allowed_domains?: string[];
    default_role_id?: string;
    seat_price_cents?: number;
    session_timeout_minutes?: number;
  } = {};
  if (input.name) patch.name = input.name.trim();
  if (input.domain) patch.allowed_domains = [input.domain.trim()];
  if (input.defaultRoleUiId) {
    const uuid = await resolveRoleUuid(ws.orgId, input.defaultRoleUiId);
    if (uuid) patch.default_role_id = uuid;
  }
  if (input.pricePerSeat !== undefined) {
    if (input.pricePerSeat < 0)
      return { ok: false, error: "The per-seat price can't be negative." };
    patch.seat_price_cents = Math.round(input.pricePerSeat * 100);
  }
  if (input.sessionTimeoutMinutes !== undefined) {
    patch.session_timeout_minutes = input.sessionTimeoutMinutes;
  }
  if (Object.keys(patch).length) {
    const { error } = await supabase
      .from("organizations")
      .update(patch)
      .eq("id", ws.orgId);
    if (error) return { ok: false, error: error.message };
  }
  await appendAudit({
    orgId: ws.orgId,
    actorId: ws.userId,
    action: "settings.updated",
    targetType: "organization",
    targetId: ws.orgId,
    summary: "Updated organization settings",
  });
  revalidatePath("/app/settings");
  revalidatePath("/app/settings/billing");
  return { ok: true };
}

export async function updateMyProfile(input: {
  fullName: string;
  title?: string;
  timezone?: string;
}): Promise<ActionResult> {
  const ws = await getActiveWorkspace();
  if (!ws) return { ok: false, error: "Sign in first." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: input.fullName.trim(),
      title: input.title?.trim() || null,
      ...(input.timezone ? { timezone: input.timezone } : {}),
    })
    .eq("id", ws.userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/me");
  revalidatePath("/app/people");
  return { ok: true };
}

/**
 * Transfer ownership via the transfer_org_ownership RPC (00014).
 * Gated on org:transfer_ownership. NOTE (Worker S Q1): the RPC demotes
 * the actor to a system role with system_key 'admin', which the canon
 * 9-role template does not include — until the coordinator rules, the
 * RPC raises and this action surfaces that error honestly.
 */
export async function transferOwnership(
  targetMembershipId: string,
): Promise<ActionResult> {
  const ws = await actor();
  if (!ws) return { ok: false, error: "You're not an active member." };
  if (!(await checkPermission(ws.orgId, "org:transfer_ownership"))) {
    return { ok: false, error: "You don't have permission to transfer ownership." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_org_ownership", {
    p_org_id: ws.orgId,
    p_target_membership_id: targetMembershipId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/settings");
  revalidatePath("/app");
  return { ok: true };
}
