"use server";

import { revalidatePath } from "next/cache";

import { writeAudit } from "@/lib/audit";
import { requireOrgAccess } from "@/lib/permissions";
import {
  diffPermissionStates,
  isStateDiffEmpty,
  type PermissionDecisions,
  type PermissionDiff,
  type PermissionStateDiff,
} from "@/lib/roles/diff";
import {
  assignRoleSchema,
  createRoleSchema,
  permissionDecisionsSchema,
  roleNameSchema,
  updateRoleMetaSchema,
} from "@/lib/roles/validation";

/**
 * Role-management server actions (Worker 3 — RBAC track).
 *
 * Every action:
 *   1. goes through requireOrgAccess(orgId, <key>) — the single choke
 *      point (layer 2; UI gating via usePermissions() is only layer 1),
 *   2. uses the RLS-scoped client requireOrgAccess returns — no raw
 *      Supabase client creation here,
 *   3. writes an audit row for privileged mutations,
 *   4. returns a serializable { ok } / { ok: false, error } result —
 *      never throws domain errors to the client.
 *
 * Plain-language errors are deliberate: the trigger/RLS layer keeps the
 * security guarantees; these messages explain what to do next.
 */

export type ActionOk<T extends object = object> = { ok: true } & T;
export type ActionErr = { ok: false; error: string };
export type RoleActionResult<T extends object = object> = ActionOk<T> | ActionErr;

/** deleteRole names the blocking members so the UI can tell the admin who to reassign. */
export type DeleteRoleResult =
  | { ok: true; memberNames: string[] }
  | { ok: false; error: string; memberNames?: string[] };

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "23505";
}

/** Matches the prevent_last_owner_loss() trigger raise (00006). */
function isLastOwnerError(error: unknown): boolean {
  return /last active owner/i.test(toErrorMessage(error));
}

const LAST_OWNER_MESSAGE =
  "This would remove the last owner of the organization. Transfer ownership to another member first.";

/** Loads a role and asserts it belongs to the org (T6, cross-tenant guard). */
async function getOrgRole(
  supabase: Awaited<ReturnType<typeof requireOrgAccess>>["supabase"],
  orgId: string,
  roleId: string,
) {
  const { data: role, error } = await supabase
    .from("roles")
    .select("id, org_id, name, description, is_system, system_key")
    .eq("id", roleId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw error;
  return role;
}

function rejectSystemRole(action: "edit" | "delete"): ActionErr {
  return {
    ok: false,
    error:
      action === "edit"
        ? "System roles can't be edited. Clone this role to customize it."
        : "System roles can't be deleted.",
  };
}

// ---------------------------------------------------------------------------
// createRole
// ---------------------------------------------------------------------------

export async function createRole(
  orgId: string,
  orgSlug: string,
  rawInput: unknown,
): Promise<RoleActionResult<{ roleId: string; assignedCount: number }>> {
  const { user, supabase } = await requireOrgAccess(orgId, "roles:create");

  const parsed = createRoleSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid role details." };
  }
  const { name, description, permissionKeys, denyKeys, assignMembershipIds } = parsed.data;

  // Assignment is a separate privilege — check it before writing anything.
  if (assignMembershipIds.length > 0) {
    await requireOrgAccess(orgId, "roles:assign");
  }

  const { data: role, error: roleError } = await supabase
    .from("roles")
    .insert({
      org_id: orgId,
      name,
      description: description ?? null,
      is_system: false,
      created_by: user.id,
    })
    .select("id, name")
    .single();
  if (roleError) {
    if (isUniqueViolation(roleError)) {
      return { ok: false, error: `A role named "${name}" already exists in this organization.` };
    }
    return { ok: false, error: toErrorMessage(roleError) };
  }

  if (permissionKeys.length > 0) {
    const { error: permError } = await supabase.from("role_permissions").insert(
      permissionKeys.map((permission_key) => ({
        role_id: role.id,
        permission_key,
        granted_by: user.id,
      })),
    );
    if (permError) return { ok: false, error: toErrorMessage(permError) };
  }

  if (denyKeys.length > 0) {
    const { error: denyError } = await supabase.from("role_permission_denies").insert(
      denyKeys.map((permission_key) => ({
        role_id: role.id,
        permission_key,
        denied_by: user.id,
      })),
    );
    if (denyError) return { ok: false, error: toErrorMessage(denyError) };
  }

  let assignedCount = 0;
  for (const membershipId of assignMembershipIds) {
    const result = await assignMembershipToRole(supabase, orgId, user.id, membershipId, role.id);
    if (!result.ok) return { ok: false, error: result.error };
    assignedCount += 1;
  }

  await writeAudit(orgId, user.id, "role.created", {
    targetType: "role",
    targetId: role.id,
    targetLabel: role.name,
    metadata: {
      permissionCount: permissionKeys.length,
      denyCount: denyKeys.length,
      assignedCount,
    },
  });

  revalidatePath(`/${orgSlug}/roles`);
  return { ok: true, roleId: role.id, assignedCount };
}

// ---------------------------------------------------------------------------
// updateRolePermissions
// ---------------------------------------------------------------------------

// updateRolePermissionStates (tri-state: Allow / Deny / Inherit)
// ---------------------------------------------------------------------------
// The register's decision model (Flagship UI Designs artifact — Crewspace
// signature UI): Allow grants the key (role_permissions), Deny records an
// explicit denial (role_permission_denies), Inherit leaves the key in
// neither table so the organization baseline applies.

export async function updateRolePermissionStates(
  orgId: string,
  orgSlug: string,
  roleId: string,
  decisions: PermissionDecisions,
): Promise<RoleActionResult<{ diff: PermissionStateDiff; affectedCount: number }>> {
  const { user, supabase } = await requireOrgAccess(orgId, "roles:update");

  const parsed = permissionDecisionsSchema.safeParse({ roleId, ...decisions });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid permissions." };
  }

  const role = await getOrgRole(supabase, orgId, roleId);
  if (!role) return { ok: false, error: "Role not found." };
  if (role.is_system) return rejectSystemRole("edit");

  const [{ data: existingAllow, error: allowError }, { data: existingDeny, error: denyError }] =
    await Promise.all([
      supabase.from("role_permissions").select("permission_key").eq("role_id", roleId),
      supabase.from("role_permission_denies").select("permission_key").eq("role_id", roleId),
    ]);
  if (allowError) return { ok: false, error: toErrorMessage(allowError) };
  if (denyError) return { ok: false, error: toErrorMessage(denyError) };

  const baseline: PermissionDecisions = {
    allow: (existingAllow ?? []).map((row) => row.permission_key),
    deny: (existingDeny ?? []).map((row) => row.permission_key),
  };
  const diff = diffPermissionStates(baseline, {
    allow: parsed.data.allow,
    deny: parsed.data.deny,
  });

  const { count: affectedCount } = await supabase
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("role_id", roleId)
    .eq("is_active", true);

  if (isStateDiffEmpty(diff)) {
    return { ok: true, diff, affectedCount: affectedCount ?? 0 };
  }

  const { error: deleteAllowError } = await supabase
    .from("role_permissions")
    .delete()
    .eq("role_id", roleId);
  if (deleteAllowError) return { ok: false, error: toErrorMessage(deleteAllowError) };

  const { error: deleteDenyError } = await supabase
    .from("role_permission_denies")
    .delete()
    .eq("role_id", roleId);
  if (deleteDenyError) return { ok: false, error: toErrorMessage(deleteDenyError) };

  if (parsed.data.allow.length > 0) {
    const { error: insertError } = await supabase.from("role_permissions").insert(
      parsed.data.allow.map((permission_key) => ({
        role_id: roleId,
        permission_key,
        granted_by: user.id,
      })),
    );
    if (insertError) return { ok: false, error: toErrorMessage(insertError) };
  }

  if (parsed.data.deny.length > 0) {
    const { error: insertError } = await supabase.from("role_permission_denies").insert(
      parsed.data.deny.map((permission_key) => ({
        role_id: roleId,
        permission_key,
        denied_by: user.id,
      })),
    );
    if (insertError) return { ok: false, error: toErrorMessage(insertError) };
  }

  await writeAudit(orgId, user.id, "role.permissions_changed", {
    targetType: "role",
    targetId: roleId,
    targetLabel: role.name,
    diff: {
      added: diff.allowAdded,
      removed: diff.allowRemoved,
      denied: diff.denyAdded,
      undenied: diff.denyRemoved,
    },
    metadata: { affectedMemberCount: affectedCount ?? 0 },
  });

  revalidatePath(`/${orgSlug}/roles`);
  revalidatePath(`/${orgSlug}/roles/${roleId}`);
  return { ok: true, diff, affectedCount: affectedCount ?? 0 };
}

export async function updateRolePermissions(
  orgId: string,
  orgSlug: string,
  roleId: string,
  permissionKeys: string[],
): Promise<RoleActionResult<{ diff: PermissionDiff; affectedCount: number }>> {
  const result = await updateRolePermissionStates(orgId, orgSlug, roleId, {
    allow: permissionKeys,
    deny: [],
  });
  if (!result.ok) return result;
  return {
    ok: true,
    diff: {
      added: result.diff.allowAdded,
      removed: result.diff.allowRemoved,
    },
    affectedCount: result.affectedCount,
  };
}

// ---------------------------------------------------------------------------
// updateRoleMeta (name + description)
// ---------------------------------------------------------------------------

export async function updateRoleMeta(
  orgId: string,
  orgSlug: string,
  roleId: string,
  rawInput: { name: string; description?: string },
): Promise<RoleActionResult> {
  const { user, supabase } = await requireOrgAccess(orgId, "roles:update");

  const parsed = updateRoleMetaSchema.safeParse({ roleId, ...rawInput });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid role details." };
  }

  const role = await getOrgRole(supabase, orgId, roleId);
  if (!role) return { ok: false, error: "Role not found." };
  if (role.is_system) return rejectSystemRole("edit");

  const { error } = await supabase
    .from("roles")
    .update({ name: parsed.data.name, description: parsed.data.description ?? null })
    .eq("id", roleId);
  if (error) {
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        error: `A role named "${parsed.data.name}" already exists in this organization.`,
      };
    }
    return { ok: false, error: toErrorMessage(error) };
  }

  await writeAudit(orgId, user.id, "role.updated", {
    targetType: "role",
    targetId: roleId,
    targetLabel: parsed.data.name,
    diff: {
      name: { from: role.name, to: parsed.data.name },
      description: { from: role.description, to: parsed.data.description ?? null },
    },
  });

  revalidatePath(`/${orgSlug}/roles`);
  revalidatePath(`/${orgSlug}/roles/${roleId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// deleteRole — blocked while any active membership holds the role
// ---------------------------------------------------------------------------

export async function deleteRole(
  orgId: string,
  orgSlug: string,
  roleId: string,
): Promise<DeleteRoleResult> {
  const { user, supabase } = await requireOrgAccess(orgId, "roles:delete");

  const role = await getOrgRole(supabase, orgId, roleId);
  if (!role) return { ok: false, error: "Role not found." };
  if (role.is_system) return rejectSystemRole("delete");

  const { data: holders, error: holdersError } = await supabase
    .from("memberships")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("role_id", roleId)
    .eq("is_active", true);
  if (holdersError) return { ok: false, error: toErrorMessage(holdersError) };

  if (holders.length > 0) {
    const userIds = holders.map((h) => h.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    const names = (profiles ?? []).map((p) => p.full_name || "Unnamed member");
    return {
      ok: false,
      error: `This role is held by ${holders.length} member${holders.length === 1 ? "" : "s"} — reassign them to another role first.`,
      memberNames: names,
    };
  }

  const { error: deletePermsError } = await supabase
    .from("role_permissions")
    .delete()
    .eq("role_id", roleId);
  if (deletePermsError) return { ok: false, error: toErrorMessage(deletePermsError) };

  const { error: deleteError } = await supabase.from("roles").delete().eq("id", roleId);
  if (deleteError) return { ok: false, error: toErrorMessage(deleteError) };

  await writeAudit(orgId, user.id, "role.deleted", {
    targetType: "role",
    targetId: roleId,
    targetLabel: role.name,
  });

  revalidatePath(`/${orgSlug}/roles`);
  return { ok: true, memberNames: [] };
}

// ---------------------------------------------------------------------------
// assignRole — requires roles:assign; rejects self-targeting (T1, defense in
// depth on top of requireOrgAccess); last-owner loss is caught from the DB
// trigger and translated to plain language.
// ---------------------------------------------------------------------------

export async function assignRole(
  orgId: string,
  orgSlug: string,
  membershipId: string,
  roleId: string,
): Promise<RoleActionResult<{ unchanged: boolean }>> {
  const { user, supabase } = await requireOrgAccess(orgId, "roles:assign");

  const parsed = assignRoleSchema.safeParse({ membershipId, roleId });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid assignment." };
  }

  const result = await assignMembershipToRole(
    supabase,
    orgId,
    user.id,
    parsed.data.membershipId,
    parsed.data.roleId,
  );
  if (!result.ok) return result;

  revalidatePath(`/${orgSlug}/roles`);
  revalidatePath(`/${orgSlug}/directory`);
  return result;
}

/**
 * Shared assignment core used by assignRole and by createRole's optional
 * "assign to members" step. Not exported as an action — it takes the
 * already-scoped client and actor id.
 */
async function assignMembershipToRole(
  supabase: Awaited<ReturnType<typeof requireOrgAccess>>["supabase"],
  orgId: string,
  actorId: string,
  membershipId: string,
  roleId: string,
): Promise<RoleActionResult<{ unchanged: boolean }>> {
  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("id, org_id, user_id, role_id, is_active")
    .eq("id", membershipId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (membershipError) return { ok: false, error: toErrorMessage(membershipError) };
  if (!membership) return { ok: false, error: "Member not found in this organization." };
  if (!membership.is_active) {
    return { ok: false, error: "This member is deactivated — reactivate them before changing roles." };
  }

  // T1, defense in depth: the RLS policy and the membership_update_guard
  // trigger also forbid this, but the app rejects it first with a clear
  // message instead of a database error.
  if (membership.user_id === actorId) {
    return {
      ok: false,
      error: "You can't change your own role — ask another admin to do it.",
    };
  }

  const { data: role, error: roleError } = await supabase
    .from("roles")
    .select("id, name")
    .eq("id", roleId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (roleError) return { ok: false, error: toErrorMessage(roleError) };
  if (!role) return { ok: false, error: "Role not found in this organization." };

  if (membership.role_id === roleId) {
    return { ok: true, unchanged: true };
  }

  const { data: oldRole } = await supabase
    .from("roles")
    .select("name")
    .eq("id", membership.role_id)
    .maybeSingle();

  const { error: updateError } = await supabase
    .from("memberships")
    .update({ role_id: roleId })
    .eq("id", membershipId);
  if (updateError) {
    if (isLastOwnerError(updateError)) {
      return { ok: false, error: LAST_OWNER_MESSAGE };
    }
    return { ok: false, error: toErrorMessage(updateError) };
  }

  await writeAudit(orgId, actorId, "membership.role_changed", {
    targetType: "membership",
    targetId: membershipId,
    targetLabel: role.name,
    diff: { role: { from: oldRole?.name ?? "Unknown", to: role.name } },
  });

  return { ok: true, unchanged: false };
}

// ---------------------------------------------------------------------------
// cloneRole — copies a system or custom role's permissions into a new custom
// role. The "Clone to customize" path for read-only system roles.
// ---------------------------------------------------------------------------

export async function cloneRole(
  orgId: string,
  orgSlug: string,
  sourceRoleId: string,
  rawName: unknown,
): Promise<RoleActionResult<{ roleId: string }>> {
  const { user, supabase } = await requireOrgAccess(orgId, "roles:create");

  const nameParsed = roleNameSchema.safeParse(rawName);
  if (!nameParsed.success) {
    return { ok: false, error: nameParsed.error.issues[0]?.message ?? "Invalid role name." };
  }

  const source = await getOrgRole(supabase, orgId, sourceRoleId);
  if (!source) return { ok: false, error: "Role not found." };

  const { data: sourceKeys, error: keysError } = await supabase
    .from("role_permissions")
    .select("permission_key")
    .eq("role_id", sourceRoleId);
  if (keysError) return { ok: false, error: toErrorMessage(keysError) };

  const { data: role, error: roleError } = await supabase
    .from("roles")
    .insert({
      org_id: orgId,
      name: nameParsed.data,
      description: `Cloned from ${source.name}.`,
      is_system: false,
      created_by: user.id,
    })
    .select("id, name")
    .single();
  if (roleError) {
    if (isUniqueViolation(roleError)) {
      return {
        ok: false,
        error: `A role named "${nameParsed.data}" already exists in this organization.`,
      };
    }
    return { ok: false, error: toErrorMessage(roleError) };
  }

  const keys = (sourceKeys ?? []).map((row) => row.permission_key);
  if (keys.length > 0) {
    const { error: permError } = await supabase.from("role_permissions").insert(
      keys.map((permission_key) => ({
        role_id: role.id,
        permission_key,
        granted_by: user.id,
      })),
    );
    if (permError) return { ok: false, error: toErrorMessage(permError) };
  }

  await writeAudit(orgId, user.id, "role.created", {
    targetType: "role",
    targetId: role.id,
    targetLabel: role.name,
    metadata: { clonedFrom: source.name, clonedFromId: source.id, permissionCount: keys.length },
  });

  revalidatePath(`/${orgSlug}/roles`);
  return { ok: true, roleId: role.id };
}
