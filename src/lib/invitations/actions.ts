"use server";

import { requireUser } from "@/lib/auth/require-user";
import { writeAudit } from "@/lib/audit";
import { requireOrgAccess } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

import { MAX_INVITES_PER_DAY } from "./constants";
import {
  canInviteUnderPolicy,
  invitationAcceptUrl,
  invitationExpiresAt,
  isDomainAllowed,
  issueInvitationToken,
  normalizeEmail,
  resolveInvitationState,
  validateInviteEmail,
  type InvitePolicy,
  type InvitationStatus,
  type TokenResolution,
} from "./policy";

/**
 * Invitation server actions — Worker 2 (Organizations + Invitations).
 * ============================================================================
 *
 * Layer 2 enforcement: every org-scoped action re-asserts via
 * requireOrgAccess(orgId, permission) even when the UI hides the control.
 * The token accept path (getInvitationByToken / acceptInvitation) is the
 * exception — invitees are not members yet, so it runs unauthenticated-safe
 * through SECURITY DEFINER functions that only ever see token hashes.
 *
 * Every privileged action writes an audit_log row via writeAudit().
 */

// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------

export interface InvitationListItem {
  id: string;
  email: string;
  role_id: string;
  role_name: string;
  team_ids: string[];
  team_names: string[];
  status: "pending" | "accepted" | "expired" | "revoked";
  invited_by: string;
  inviter_name: string;
  message: string | null;
  source: "manual" | "bulk";
  expires_at: string;
  accepted_at: string | null;
  resend_count: number;
  created_at: string;
}

export interface InviteOrgContext {
  id: string;
  name: string;
  slug: string;
  invitePolicy: InvitePolicy;
  allowedDomains: string[];
  requireEmailVerification: boolean;
  defaultRoleId: string | null;
  defaultRoleName: string | null;
  roles: { id: string; name: string; is_system: boolean; system_key: string | null }[];
  teams: { id: string; name: string }[];
}

export interface InvitePageData {
  invitations: InvitationListItem[];
  context: InviteOrgContext;
  canInvite: boolean;
  canManage: boolean;
}

export interface SendResult {
  email: string;
  ok: boolean;
  error?: string;
  /** Set when the address is already an active member — link to their profile. */
  memberId?: string;
  /** Set when a pending invite already exists — offer a resend instead. */
  existingInvitationId?: string;
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

// TODO: wire Resend — no email leaves the server until this is implemented.
// When wired: render the invitation template (org name, inviter, role,
// accept URL, expiry) and send via the Resend API; keep this dev log.
export async function sendInvitationEmail(args: {
  to: string;
  orgName: string;
  inviterName: string;
  roleName: string;
  acceptUrl: string;
  expiresAt: Date;
  message?: string | null;
}): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[invitation-email:stub] to=${args.to} org="${args.orgName}" role="${args.roleName}" ` +
        `accept=${args.acceptUrl}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Everything the /invitations page needs in one round trip. Requires
 * members:read (mirrors the invitations SELECT RLS policy); invitation
 * management affordances are additionally gated on members:invite /
 * invitations:manage via the returned flags.
 */
export async function getInvitePageData(orgId: string): Promise<InvitePageData> {
  const { membership, permissions, supabase } = await requireOrgAccess(orgId, "members:read");

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select(
      "id, name, slug, invite_policy, allowed_domains, require_email_verification, default_role_id",
    )
    .eq("id", orgId)
    .single();
  if (orgError || !org) throw new Error("Organization not found.");

  const [{ data: invitations }, { data: roles }, { data: teams }] = await Promise.all([
    supabase
      .from("invitations")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
    supabase.from("roles").select("id, name, is_system, system_key").eq("org_id", orgId).order("name"),
    supabase.from("teams").select("id, name").eq("org_id", orgId).eq("is_archived", false).order("name"),
  ]);

  const inviterIds = [...new Set((invitations ?? []).map((i) => i.invited_by))];
  const { data: inviters } = inviterIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", inviterIds)
    : { data: [] as { id: string; full_name: string }[] | null };

  const inviterName = new Map((inviters ?? []).map((p) => [p.id, p.full_name] as const));
  const roleName = new Map((roles ?? []).map((r) => [r.id, r.name] as const));
  const teamName = new Map((teams ?? []).map((t) => [t.id, t.name] as const));

  const items: InvitationListItem[] = (invitations ?? []).map((i) => ({
    id: i.id,
    email: i.email,
    role_id: i.role_id,
    role_name: roleName.get(i.role_id) ?? "Unknown role",
    team_ids: i.team_ids,
    team_names: i.team_ids.map((id: string) => teamName.get(id) ?? "Unknown team"),
    status: i.status,
    invited_by: i.invited_by,
    inviter_name: inviterName.get(i.invited_by) ?? "A teammate",
    message: i.message,
    source: i.source,
    expires_at: i.expires_at,
    accepted_at: i.accepted_at,
    resend_count: i.resend_count,
    created_at: i.created_at,
  }));

  const invitePolicy = (org.invite_policy ?? "admins") as InvitePolicy;
  return {
    invitations: items,
    context: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      invitePolicy,
      allowedDomains: org.allowed_domains ?? [],
      requireEmailVerification: org.require_email_verification ?? true,
      defaultRoleId: org.default_role_id,
      defaultRoleName: org.default_role_id ? (roleName.get(org.default_role_id) ?? null) : null,
      roles: (roles ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        is_system: r.is_system,
        system_key: r.system_key,
      })),
      teams: (teams ?? []).map((t) => ({ id: t.id, name: t.name })),
    },
    canInvite:
      permissions.includes("members:invite") &&
      canInviteUnderPolicy({ invitePolicy, viewerSystemKey: membership.role_system_key }),
    canManage: permissions.includes("invitations:manage"),
  };
}

/** Lifecycle timeline for the invitation detail drawer (audit events). */
export async function getInvitationTimeline(orgId: string, invitationId: string) {
  const { supabase } = await requireOrgAccess(orgId, "members:read");

  const { data: invitation } = await supabase
    .from("invitations")
    .select("id, org_id, created_at, expires_at, accepted_at, resend_count, status")
    .eq("id", invitationId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!invitation) throw new Error("Invitation not found.");

  const { data: events } = await supabase
    .from("audit_log")
    .select("id, action, actor_id, created_at, diff, metadata")
    .eq("org_id", orgId)
    .eq("target_id", invitationId)
    .order("created_at", { ascending: true });

  const actorIds = [...new Set((events ?? []).map((e) => e.actor_id))];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [] as { id: string; full_name: string }[] | null };
  const actorName = new Map((actors ?? []).map((p) => [p.id, p.full_name] as const));

  return {
    invitation,
    events: (events ?? []).map((e) => ({
      id: e.id,
      action: e.action,
      actorName: actorName.get(e.actor_id) ?? "Someone",
      createdAt: e.created_at,
      diff: e.diff,
      metadata: e.metadata,
    })),
  };
}

// ---------------------------------------------------------------------------
// Public token preview (invitees are not members yet — no requireOrgAccess)
// ---------------------------------------------------------------------------

export interface InvitationPreview {
  orgId: string;
  orgSlug: string;
  orgName: string;
  orgLogoUrl: string | null;
  email: string;
  roleName: string;
  roleDescription: string | null;
  permissionLabels: string[];
  inviterName: string;
  status: TokenResolution;
  expiresAt: string;
}

export type TokenLookupResult =
  | { ok: true; preview: InvitationPreview }
  | { ok: false; reason: Exclude<TokenResolution, "valid"> };

/**
 * Validates a raw token and returns the safe public subset for the accept
 * page. Runs through the SECURITY DEFINER get_invitation_preview() so
 * signed-out invitees can see the org card. Never reveals whether an email
 * is registered — only the token's own validity.
 */
export async function getInvitationByToken(rawToken: string): Promise<TokenLookupResult> {
  const token = (rawToken ?? "").trim();
  if (!token) return { ok: false, reason: "invalid" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_invitation_preview", { p_token: token });
  if (error) throw new Error("Could not verify this invitation. Try again.");
  const row = data?.[0];
  if (!row) return { ok: false, reason: "invalid" };

  const status = resolveInvitationState({
    status: row.status as InvitationStatus,
    expires_at: row.expires_at,
  });
  if (status !== "valid") return { ok: false, reason: status };

  return {
    ok: true,
    preview: {
      orgId: row.org_id,
      orgSlug: row.org_slug,
      orgName: row.org_name,
      orgLogoUrl: row.org_logo_url,
      email: row.email,
      roleName: row.role_name,
      roleDescription: row.role_description,
      permissionLabels: row.permission_labels ?? [],
      inviterName: row.inviter_name,
      status: "valid",
      expiresAt: row.expires_at,
    },
  };
}

/**
 * Accepts an invitation via the transactional accept_invitation() RPC
 * (hash + pending + TTL checked in one transaction; single-use by row lock).
 * The caller must be signed in — new users sign up first, inline on the
 * accept page, then land here.
 */
export async function acceptInvitation(
  rawToken: string,
): Promise<{ ok: true; membershipId: string } | { ok: false; code: string; message: string }> {
  const user = await requireUser("/invite/accept");
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("accept_invitation", {
    p_token: (rawToken ?? "").trim(),
    p_user_id: user.id,
  });

  if (!error) {
    return { ok: true, membershipId: data };
  }

  // Map the RPC's internal exceptions to the public state machine. The
  // messages are our own DB strings — safe to branch on server-side.
  const msg = error.message;
  if (msg.includes("invitation not found") || msg.includes("token is required")) {
    return { ok: false, code: "invalid", message: "This invite link is not valid." };
  }
  if (msg.includes("no longer pending")) {
    if (msg.includes("accepted")) {
      return {
        ok: false,
        code: "already-accepted",
        message: "You already accepted this invitation.",
      };
    }
    if (msg.includes("revoked")) {
      return { ok: false, code: "revoked", message: "This invitation was revoked." };
    }
    return { ok: false, code: "expired", message: "This invitation has expired." };
  }
  if (msg.includes("has expired")) {
    return { ok: false, code: "expired", message: "This invitation has expired." };
  }
  // Unique-violation on memberships = the user is already a member (race or
  // double submit that slipped past the status check).
  if (msg.includes("duplicate") || msg.includes("unique")) {
    return {
      ok: false,
      code: "already-accepted",
      message: "You are already a member of this organization.",
    };
  }
  throw new Error("Could not accept this invitation. Try again.");
}

// ---------------------------------------------------------------------------
// Invite issuance (privileged)
// ---------------------------------------------------------------------------

interface InviteIssueInput {
  emails: string[];
  roleId: string;
  teamIds: string[];
  message?: string;
  source: "manual" | "bulk";
  /** Full names from CSV rows — stored in audit metadata only (no column). */
  fullNames?: Record<string, string>;
}

async function issueInvitations(
  orgId: string,
  input: InviteIssueInput,
): Promise<{ sent: SendResult[]; actorId: string }> {
  const { user, membership, supabase } = await requireOrgAccess(orgId, "members:invite");

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, slug, invite_policy, allowed_domains, default_role_id")
    .eq("id", orgId)
    .single();
  if (!org) throw new Error("Organization not found.");

  const invitePolicy = (org.invite_policy ?? "admins") as InvitePolicy;
  if (!canInviteUnderPolicy({ invitePolicy, viewerSystemKey: membership.role_system_key })) {
    throw new Error("Your role is not allowed to send invitations in this organization.");
  }

  const allowedDomains = org.allowed_domains ?? [];

  // Role + teams must belong to this org (defense in depth with the trigger).
  const { data: role } = await supabase
    .from("roles")
    .select("id, name")
    .eq("id", input.roleId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!role) throw new Error("Choose a valid role for this organization.");

  const { data: teams } = input.teamIds.length
    ? await supabase.from("teams").select("id").eq("org_id", orgId).in("id", input.teamIds)
    : { data: [] as { id: string }[] | null };
  const validTeamIds = new Set((teams ?? []).map((t) => t.id));

  // Daily rate limit: max 50 invitations issued per org per calendar day.
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const { count: issuedToday } = await supabase
    .from("invitations")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .gte("created_at", dayStart.toISOString());
  if ((issuedToday ?? 0) + input.emails.length > MAX_INVITES_PER_DAY) {
    throw new Error(
      `Daily invitation limit reached (${MAX_INVITES_PER_DAY} per day). Try again tomorrow.`,
    );
  }

  const inviterName =
    (await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()).data
      ?.full_name ?? "A teammate";

  const results: SendResult[] = [];
  for (const rawEmail of input.emails) {
    const email = normalizeEmail(rawEmail);
    const fail = (error: string, extra?: Partial<SendResult>): SendResult => ({
      email,
      ok: false,
      error,
      ...extra,
    });

    const emailError = validateInviteEmail(email);
    if (emailError) {
      results.push(fail(emailError));
      continue;
    }
    if (!isDomainAllowed(email, allowedDomains)) {
      results.push(
        fail(
          `Only ${allowedDomains.join(", ")} addresses can be invited to this organization.`,
        ),
      );
      continue;
    }

    // Already a member? Point at their profile instead of inviting.
    const { data: existingMemberId } = await supabase.rpc("org_member_id_by_email", {
      p_org_id: orgId,
      p_email: email,
    });
    if (existingMemberId) {
      results.push(
        fail("That email is already a member — view their profile.", {
          memberId: existingMemberId,
        }),
      );
      continue;
    }

    // Already invited and still pending? Offer a resend instead of a duplicate.
    const { data: existingInvite } = await supabase
      .from("invitations")
      .select("id")
      .eq("org_id", orgId)
      .eq("email", email)
      .eq("status", "pending")
      .maybeSingle();
    if (existingInvite) {
      results.push(
        fail("This email already has a pending invite — resend it instead.", {
          existingInvitationId: existingInvite.id,
        }),
      );
      continue;
    }

    const { raw, tokenHash } = issueInvitationToken();
    const expiresAt = invitationExpiresAt();
    const { data: inserted, error: insertError } = await supabase
      .from("invitations")
      .insert({
        org_id: orgId,
        email,
        role_id: role.id,
        team_ids: input.teamIds.filter((id) => validTeamIds.has(id)),
        token_hash: tokenHash,
        invited_by: user.id,
        message: input.message?.trim() || null,
        source: input.source,
        expires_at: expiresAt.toISOString(),
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      results.push(fail("Could not create this invitation. Try again."));
      continue;
    }

    await writeAudit(orgId, user.id, "invitation.sent", {
      targetType: "invitation",
      targetId: inserted.id,
      targetLabel: email,
      diff: {
        role: role.name,
        teams: input.teamIds.filter((id) => validTeamIds.has(id)).length,
        source: input.source,
      },
      metadata: { fullName: input.fullNames?.[email] ?? null },
    });

    await sendInvitationEmail({
      to: email,
      orgName: org.name,
      inviterName,
      roleName: role.name,
      acceptUrl: invitationAcceptUrl(raw, appUrl()),
      expiresAt,
      message: input.message,
    });

    results.push({ email, ok: true });
  }

  return { sent: results, actorId: user.id };
}

/** Single/batch invite from the "Invite members" dialog. */
export async function sendInvitations(
  orgId: string,
  input: { emails: string[]; roleId: string; teamIds: string[]; message?: string },
): Promise<{ sent: SendResult[] }> {
  if (!input.emails.length) throw new Error("Add at least one email address.");
  return issueInvitations(orgId, { ...input, source: "manual" });
}

/** Bulk CSV import — inserts valid rows one by one, collecting per-row results. */
export async function bulkInvite(
  orgId: string,
  rows: { email: string; fullName: string; roleId: string; teamIds: string[] }[],
): Promise<{ sent: SendResult[] }> {
  if (!rows.length) throw new Error("No valid rows to send.");
  const fullNames: Record<string, string> = {};
  for (const r of rows) {
    if (r.fullName.trim()) fullNames[normalizeEmail(r.email)] = r.fullName.trim();
  }

  // Group rows by role — each role batch keeps its own audit trail.
  const byRole = new Map<string, { email: string; teamIds: string[] }[]>();
  for (const r of rows) {
    const group = byRole.get(r.roleId) ?? [];
    group.push({ email: r.email, teamIds: r.teamIds });
    byRole.set(r.roleId, group);
  }

  const allSent: SendResult[] = [];
  let actorId = "";
  for (const [roleId, group] of byRole) {
    const result = await issueInvitations(orgId, {
      emails: group.map((g) => g.email),
      roleId,
      teamIds: [...new Set(group.flatMap((g) => g.teamIds))],
      source: "bulk",
      fullNames,
    });
    allSent.push(...result.sent);
    actorId = result.actorId;
  }

  // Summary event for the batch itself.
  const okCount = allSent.filter((r) => r.ok).length;
  await writeAudit(orgId, actorId, "invitation.bulk_sent", {
    targetLabel: `${okCount} of ${rows.length} invitations`,
    diff: { attempted: rows.length, sent: okCount, failed: rows.length - okCount },
  });
  return { sent: allSent };
}

// ---------------------------------------------------------------------------
// Resend / revoke (privileged)
// ---------------------------------------------------------------------------

/**
 * Resends an invitation: issues a NEW token + fresh 7-day expiry, increments
 * resend_count, and (once wired) re-sends the email. Returns the new accept
 * URL so the UI can also offer "copy link".
 */
export async function resendInvitation(
  orgId: string,
  invitationId: string,
): Promise<{ ok: true; acceptUrl: string; expiresAt: string }> {
  const { user, supabase } = await requireOrgAccess(orgId, "invitations:manage");

  const { data: invitation } = await supabase
    .from("invitations")
    .select("id, email, status, role_id, resend_count")
    .eq("id", invitationId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!invitation) throw new Error("Invitation not found.");
  if (invitation.status === "accepted") {
    throw new Error("This invitation was already accepted — nothing to resend.");
  }
  if (invitation.status === "revoked") {
    throw new Error("Revoked invitations cannot be resent. Send a new invitation instead.");
  }

  const { raw, tokenHash } = issueInvitationToken();
  const expiresAt = invitationExpiresAt();
  const { error } = await supabase
    .from("invitations")
    .update({
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
      status: "pending",
      resend_count: invitation.resend_count + 1,
    })
    .eq("id", invitation.id);
  if (error) throw new Error("Could not resend this invitation. Try again.");

  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .single();
  const { data: role } = await supabase.from("roles").select("name").eq("id", invitation.role_id).single();
  const inviterName =
    (await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()).data
      ?.full_name ?? "A teammate";

  await writeAudit(orgId, user.id, "invitation.resent", {
    targetType: "invitation",
    targetId: invitation.id,
    targetLabel: invitation.email,
    diff: { resend_count: { from: invitation.resend_count, to: invitation.resend_count + 1 } },
  });

  const acceptUrl = invitationAcceptUrl(raw, appUrl());
  await sendInvitationEmail({
    to: invitation.email,
    orgName: org?.name ?? "your organization",
    inviterName,
    roleName: role?.name ?? "Member",
    acceptUrl,
    expiresAt,
  });

  return { ok: true, acceptUrl, expiresAt: expiresAt.toISOString() };
}

/** Revokes a pending (or expired) invitation — it can never be accepted. */
export async function revokeInvitation(orgId: string, invitationId: string): Promise<{ ok: true }> {
  const { user, supabase } = await requireOrgAccess(orgId, "invitations:manage");

  const { data: invitation } = await supabase
    .from("invitations")
    .select("id, email, status")
    .eq("id", invitationId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!invitation) throw new Error("Invitation not found.");
  if (invitation.status === "accepted") {
    throw new Error("This invitation was already accepted — deactivate the member instead.");
  }
  if (invitation.status === "revoked") {
    return { ok: true };
  }

  const { error } = await supabase
    .from("invitations")
    .update({ status: "revoked" })
    .eq("id", invitation.id);
  if (error) throw new Error("Could not revoke this invitation. Try again.");

  await writeAudit(orgId, user.id, "invitation.revoked", {
    targetType: "invitation",
    targetId: invitation.id,
    targetLabel: invitation.email,
    diff: { status: { from: invitation.status, to: "revoked" } },
  });

  return { ok: true };
}
