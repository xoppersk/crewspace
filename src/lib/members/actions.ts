"use server";

import { revalidatePath } from "next/cache";

import { writeAudit } from "@/lib/audit";
import { ForbiddenError, requireOrgAccess } from "@/lib/permissions";

import { computeDeactivationEffect } from "./summaries";
import { toPlainTransferError, validateTransferTarget } from "./transfer";

type Supabase = Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;

export type ActionResult = { ok: true } | { ok: false; error: string };

function fail(error: unknown): ActionResult {
  if (error instanceof ForbiddenError) {
    return { ok: false, error: "You don't have permission to do that." };
  }
  return { ok: false, error: error instanceof Error ? error.message : "Something went wrong." };
}

function orgPath(orgSlug: string, suffix = ""): string {
  return `/${orgSlug}${suffix}`;
}

/** Load the target membership + profile + role inside the org. Throws when missing. */
async function loadMember(
  supabase: Supabase,
  orgId: string,
  membershipId: string,
) {
  const { data, error } = await supabase
    .from("memberships")
    .select(
      "id, user_id, role_id, is_active, profiles!inner(full_name), roles!inner(name, system_key)",
    )
    .eq("org_id", orgId)
    .eq("id", membershipId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Member not found in this organization.");
  return {
    id: data.id,
    userId: data.user_id,
    roleId: data.role_id,
    isActive: data.is_active,
    fullName: (data.profiles as unknown as { full_name: string }).full_name,
    roleName: (data.roles as unknown as { name: string; system_key: string | null }).name,
    roleSystemKey: (data.roles as unknown as { name: string; system_key: string | null })
      .system_key,
  };
}

/** The last active owner can never be demoted/deactivated/removed. */
async function assertNotLastOwner(
  supabase: Supabase,
  orgId: string,
  target: { roleSystemKey: string | null; userId: string },
  verb: string,
): Promise<void> {
  if (target.roleSystemKey !== "owner") return;
  const { count, error } = await supabase
    .from("memberships")
    .select("id, roles!inner(system_key)", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("is_active", true)
    .eq("roles.system_key", "owner");
  if (error) throw error;
  if ((count ?? 0) <= 1) {
    throw new Error(
      `You can't ${verb} the last owner. Transfer ownership first.`,
    );
  }
}

/**
 * Change a member's role.
 * Layer 2: requireOrgAccess (members:change_role) + self-target rejection.
 * Layer 3: RLS (memberships_update_role) + membership_update_guard trigger.
 */
export async function updateMemberRole(
  orgId: string,
  orgSlug: string,
  membershipId: string,
  roleId: string,
): Promise<ActionResult> {
  try {
    const { user, supabase } = await requireOrgAccess(orgId, "members:change_role");

    const target = await loadMember(supabase, orgId, membershipId);

    // Role must belong to this org.
    const { data: role, error: roleError } = await supabase
      .from("roles")
      .select("id, name")
      .eq("org_id", orgId)
      .eq("id", roleId)
      .maybeSingle();
    if (roleError) throw roleError;
    if (!role) throw new Error("That role doesn't belong to this organization.");

    await assertNotLastOwner(supabase, orgId, target, "demote");
    if (target.roleId === roleId) return { ok: true };

    const { error } = await supabase
      .from("memberships")
      .update({ role_id: roleId })
      .eq("id", membershipId);
    if (error) throw error;

    await writeAudit(orgId, user.id, "membership.role_changed", {
    targetType: "membership",
    targetId: membershipId,
    targetLabel: target.fullName,
    diff: { role: { from: target.roleName, to: role.name } },
  });

    revalidatePath(orgPath(orgSlug, "/directory"));
    revalidatePath(orgPath(orgSlug, `/directory/${membershipId}`));
    revalidatePath(orgPath(orgSlug, "/dashboard"));
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deactivateMember(
  orgId: string,
  orgSlug: string,
  membershipId: string,
): Promise<ActionResult> {
  try {
    const { user, supabase } = await requireOrgAccess(orgId, "members:deactivate");

    const target = await loadMember(supabase, orgId, membershipId);
    await assertNotLastOwner(supabase, orgId, target, "deactivate");

    const effect = computeDeactivationEffect({
      currentlyActive: target.isActive,
      targetActive: false,
      actorId: user.id,
      memberName: target.fullName,
    });

    const { error } = await supabase
      .from("memberships")
      .update(effect.patch)
      .eq("id", membershipId);
    if (error) throw error;

    await writeAudit(orgId, user.id, effect.auditAction, {
      targetType: "membership",
      targetId: membershipId,
      targetLabel: target.fullName,
    });

    revalidatePath(orgPath(orgSlug, "/directory"));
    revalidatePath(orgPath(orgSlug, `/directory/${membershipId}`));
    revalidatePath(orgPath(orgSlug, "/dashboard"));
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function reactivateMember(
  orgId: string,
  orgSlug: string,
  membershipId: string,
): Promise<ActionResult> {
  try {
    const { user, supabase } = await requireOrgAccess(orgId, "members:deactivate");

    const target = await loadMember(supabase, orgId, membershipId);
    const effect = computeDeactivationEffect({
      currentlyActive: target.isActive,
      targetActive: true,
      actorId: user.id,
      memberName: target.fullName,
    });

    const { error } = await supabase
      .from("memberships")
      .update(effect.patch)
      .eq("id", membershipId);
    if (error) throw error;

    await writeAudit(orgId, user.id, effect.auditAction, {
      targetType: "membership",
      targetId: membershipId,
      targetLabel: target.fullName,
    });

    revalidatePath(orgPath(orgSlug, "/directory"));
    revalidatePath(orgPath(orgSlug, `/directory/${membershipId}`));
    revalidatePath(orgPath(orgSlug, "/dashboard"));
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Permanently remove a member from the org. The typed confirmation is
 * enforced client-side AND re-verified here (defense in depth): the caller
 * must echo the member's full name exactly.
 */
export async function removeMember(
  orgId: string,
  orgSlug: string,
  membershipId: string,
  typedName: string,
): Promise<ActionResult> {
  try {
    const { user, supabase } = await requireOrgAccess(orgId, "members:deactivate");

    const target = await loadMember(supabase, orgId, membershipId);
    await assertNotLastOwner(supabase, orgId, target, "remove");

    if (typedName.trim() !== target.fullName) {
      throw new Error("The typed name doesn't match. Removal cancelled.");
    }

    // Never strand a team without a lead: reassign first.
    const { data: ledTeams, error: ledError } = await supabase
      .from("teams")
      .select("id, name")
      .eq("org_id", orgId)
      .eq("lead_membership_id", membershipId);
    if (ledError) throw ledError;
    if (ledTeams && ledTeams.length > 0) {
      throw new Error(
        `Pick a successor lead for ${ledTeams.map((t) => `“${t.name}”`).join(", ")} before removing ${target.fullName}.`,
      );
    }

    const { error } = await supabase.from("memberships").delete().eq("id", membershipId);
    if (error) throw error;

    await writeAudit(orgId, user.id, "membership.removed", {
    targetType: "membership",
    targetId: membershipId,
    targetLabel: target.fullName,
    diff: { role: target.roleName },
  });

    revalidatePath(orgPath(orgSlug, "/directory"));
    revalidatePath(orgPath(orgSlug, "/teams"));
    revalidatePath(orgPath(orgSlug, "/dashboard"));
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export type BulkMemberAction =
  | { kind: "change-role"; roleId: string }
  | { kind: "change-team"; teamId: string }
  | { kind: "deactivate" }
  | { kind: "reactivate" };/**
 * Bulk member update. Asserts the permission for the action kind, skips
 * self-targets and the last owner, applies per-member, and writes one audit
 * row per affected member (security events stay individually attributable).
 */
export async function bulkUpdateMembers(
  orgId: string,
  orgSlug: string,
  membershipIds: string[],
  action: BulkMemberAction,
): Promise<ActionResult & { affected: number }> {
  try {
    const permission =
      action.kind === "change-team" ? "teams:manage" : action.kind === "change-role" ? "members:change_role" : "members:deactivate";
    const { user, supabase } = await requireOrgAccess(orgId, permission);

    let roleName: string | undefined;
    if (action.kind === "change-role") {
      const { data: role } = await supabase
        .from("roles")
        .select("id, name")
        .eq("org_id", orgId)
        .eq("id", action.roleId)
        .maybeSingle();
      if (!role) throw new Error("That role doesn't belong to this organization.");
      roleName = role.name;
    }

    let teamName: string | undefined;
    if (action.kind === "change-team") {
      const { data: team } = await supabase
        .from("teams")
        .select("id, name")
        .eq("org_id", orgId)
        .eq("id", action.teamId)
        .maybeSingle();
      if (!team) throw new Error("That team doesn't belong to this organization.");
      teamName = team.name;
    }

    let affected = 0;
    for (const membershipId of membershipIds) {
      const target = await loadMember(supabase, orgId, membershipId);
      if (target.userId === user.id) continue; // self-targets never apply in bulk
      if (target.roleSystemKey === "owner") {
        // Bulk never touches the last owner; a sole-owner edge is skipped, not errored.
        const { count } = await supabase
          .from("memberships")
          .select("id, roles!inner(system_key)", { count: "exact", head: true })
          .eq("org_id", orgId)
          .eq("is_active", true)
          .eq("roles.system_key", "owner");
        if ((count ?? 0) <= 1) continue;
      }

      if (action.kind === "change-role") {
        if (target.roleId === action.roleId) continue;
        const { error } = await supabase
          .from("memberships")
          .update({ role_id: action.roleId })
          .eq("id", membershipId);
        if (error) throw error;
        await writeAudit(orgId, user.id, "membership.role_changed", {
        targetType: "membership",
        targetId: membershipId,
        targetLabel: target.fullName,
        diff: { role: { from: target.roleName, to: roleName } },
        metadata: { bulk: true },
      });
        affected += 1;
      } else if (action.kind === "change-team") {
        const { error } = await supabase.from("team_memberships").upsert(
          { team_id: action.teamId, membership_id: membershipId, added_by: user.id },
          { onConflict: "team_id,membership_id" },
        );
        if (error) throw error;
        await writeAudit(orgId, user.id, "team.member_added", {
        targetType: "team",
        targetId: action.teamId,
        targetLabel: teamName,
        metadata: { membership_id: membershipId, member_name: target.fullName, bulk: true },
      });
        affected += 1;
      } else {
        const wantActive = action.kind === "reactivate";
        if (target.isActive === wantActive) continue;
        const effect = computeDeactivationEffect({
          currentlyActive: target.isActive,
          targetActive: wantActive,
          actorId: user.id,
          memberName: target.fullName,
        });
        const { error } = await supabase
          .from("memberships")
          .update(effect.patch)
          .eq("id", membershipId);
        if (error) throw error;
        await writeAudit(orgId, user.id, effect.auditAction, {
          targetType: "membership",
          targetId: membershipId,
          targetLabel: target.fullName,
          metadata: { bulk: true },
        });
        affected += 1;
      }
    }

    revalidatePath(orgPath(orgSlug, "/directory"));
    revalidatePath(orgPath(orgSlug, "/dashboard"));
    return { ok: true, affected };
  } catch (error) {
    return { ...fail(error), affected: 0 };
  }
}

/**
 * Transfer organization ownership to another active member.
 *
 * Layer 2: requireOrgAccess(org:transfer_ownership) — only owners hold that
 * permission, so anyone else gets the plain "no permission" message.
 * Layer 3: the transfer_org_ownership() SECURITY DEFINER function performs
 * the promote-then-demote in one transaction and re-validates actor/target
 * itself (defense in depth). The prevent_last_owner_loss trigger stays as
 * the final backstop.
 *
 * Writes an org.ownership_transferred audit row with the from/to names.
 */
export async function transferOwnership(
  orgId: string,
  orgSlug: string,
  targetMembershipId: string,
): Promise<ActionResult> {
  try {
    const { user, membership, supabase } = await requireOrgAccess(
      orgId,
      "org:transfer_ownership",
    );

    // Target must be an active member of THIS org (loadMember is org-scoped)
    // and must not be the caller.
    const target = await loadMember(supabase, orgId, targetMembershipId);
    const problem = validateTransferTarget({
      actorUserId: user.id,
      actorIsOwner: membership.role_system_key === "owner",
      targetUserId: target.userId,
      targetIsActive: target.isActive,
      targetName: target.fullName,
    });
    if (problem) throw new Error(problem);

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .single();
    if (orgError) throw orgError;
    if (!org) throw new Error("Organization not found.");

    // Atomic swap in the DB (promote-then-demote); the
    // prevent_last_owner_loss trigger stays as the backstop.
    const { data: names, error } = await supabase.rpc("transfer_org_ownership", {
      p_org_id: orgId,
      p_target_membership_id: targetMembershipId,
    });
    if (error) throw new Error(toPlainTransferError(error.message));

    await writeAudit(orgId, user.id, "org.ownership_transferred", {
      targetType: "organization",
      targetId: orgId,
      targetLabel: names?.target_name ?? target.fullName,
      diff: {
        from: names?.actor_name ?? "Unknown member",
        to: names?.target_name ?? target.fullName,
        organization: org.name,
      },
    });

    revalidatePath(orgPath(orgSlug, "/settings"));
    revalidatePath(orgPath(orgSlug, "/dashboard"));
    revalidatePath(orgPath(orgSlug, "/directory"));
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
