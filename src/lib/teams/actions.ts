"use server";

import { revalidatePath } from "next/cache";

import { writeAudit } from "@/lib/audit";
import { ForbiddenError, requireOrgAccess } from "@/lib/permissions";
import { createTeamSchema, updateTeamSchema } from "@/lib/validations/team";

import { validateLeadRemoval } from "./validation";

type Supabase = Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;

export type ActionResult = { ok: true; teamId?: string } | { ok: false; error: string };

function fail(error: unknown): ActionResult {
  if (error instanceof ForbiddenError) {
    return { ok: false, error: "You don't have permission to do that." };
  }
  return { ok: false, error: error instanceof Error ? error.message : "Something went wrong." };
}

function orgPath(orgSlug: string, suffix = ""): string {
  return `/${orgSlug}${suffix}`;
}

/** Load a team inside the org. Throws when missing. */
async function loadTeam(supabase: Supabase, orgId: string, teamId: string) {
  const { data, error } = await supabase
    .from("teams")
    .select("id, name, description, lead_membership_id, is_archived")
    .eq("org_id", orgId)
    .eq("id", teamId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Team not found in this organization.");
  return data;
}

/** Active org memberships for a list of membership ids (all must match). */
async function assertActiveOrgMemberships(
  supabase: Supabase,
  orgId: string,
  membershipIds: string[],
  label: string,
): Promise<void> {
  if (membershipIds.length === 0) return;
  const { data, error } = await supabase
    .from("memberships")
    .select("id, is_active")
    .eq("org_id", orgId)
    .in("id", membershipIds);
  if (error) throw error;
  const byId = new Map((data ?? []).map((m) => [m.id, m.is_active]));
  for (const id of membershipIds) {
    const active = byId.get(id);
    if (active === undefined) throw new Error(`${label}: a selected member isn't in this organization.`);
    if (!active) throw new Error(`${label}: a selected member is deactivated.`);
  }
}

export async function createTeam(
  orgId: string,
  orgSlug: string,
  input: { name: string; description?: string; leadMembershipId?: string },
): Promise<ActionResult> {
  try {
    const parsed = createTeamSchema.parse(input);
    const { user, supabase } = await requireOrgAccess(orgId, "teams:create");

    if (parsed.leadMembershipId) {
      await assertActiveOrgMemberships(supabase, orgId, [parsed.leadMembershipId], "Lead");
    }

    const { data, error } = await supabase
      .from("teams")
      .insert({
        org_id: orgId,
        name: parsed.name,
        description: parsed.description ?? null,
        lead_membership_id: parsed.leadMembershipId ?? null,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error) throw error;

    // A lead is always a team member: add them if not already.
    if (parsed.leadMembershipId) {
      const { error: tmError } = await supabase.from("team_memberships").upsert(
        {
          team_id: data.id,
          membership_id: parsed.leadMembershipId,
          added_by: user.id,
        },
        { onConflict: "team_id,membership_id" },
      );
      if (tmError) throw tmError;
    }

    await writeAudit(orgId, user.id, "team.created", {
    targetType: "team",
    targetId: data.id,
    targetLabel: parsed.name,
  });

    revalidatePath(orgPath(orgSlug, "/teams"));
    revalidatePath(orgPath(orgSlug, "/dashboard"));
    return { ok: true, teamId: data.id };
  } catch (error) {
    return fail(error);
  }
}

export async function updateTeam(
  orgId: string,
  orgSlug: string,
  teamId: string,
  input: { name: string; description?: string | null },
): Promise<ActionResult> {
  try {
    const parsed = updateTeamSchema.parse(input);
    const { user, supabase } = await requireOrgAccess(orgId, "teams:manage");

    const team = await loadTeam(supabase, orgId, teamId);

    const { error } = await supabase
      .from("teams")
      .update({ name: parsed.name, description: parsed.description ?? null })
      .eq("id", teamId);
    if (error) throw error;

    await writeAudit(orgId, user.id, "team.updated", {
    targetType: "team",
    targetId: teamId,
    targetLabel: parsed.name,
    diff: {
        name: { from: team.name, to: parsed.name },
        description: { from: team.description, to: parsed.description ?? null },
      },
  });

    revalidatePath(orgPath(orgSlug, "/teams"));
    revalidatePath(orgPath(orgSlug, `/teams/${teamId}`));
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function archiveTeam(
  orgId: string,
  orgSlug: string,
  teamId: string,
  archive: boolean,
): Promise<ActionResult> {
  try {
    const { user, supabase } = await requireOrgAccess(orgId, "teams:manage");
    const team = await loadTeam(supabase, orgId, teamId);

    const { error } = await supabase
      .from("teams")
      .update({ is_archived: archive })
      .eq("id", teamId);
    if (error) throw error;

    await writeAudit(orgId, user.id, archive ? "team.archived" : "team.unarchived", {
      targetType: "team",
      targetId: teamId,
      targetLabel: team.name,
    });

    revalidatePath(orgPath(orgSlug, "/teams"));
    revalidatePath(orgPath(orgSlug, `/teams/${teamId}`));
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Change the team lead. The new lead must be an active org member; they are
 * added to the team automatically when not already a member.
 */
export async function setTeamLead(
  orgId: string,
  orgSlug: string,
  teamId: string,
  membershipId: string | null,
): Promise<ActionResult> {
  try {
    const { user, supabase } = await requireOrgAccess(orgId, "teams:manage");
    const team = await loadTeam(supabase, orgId, teamId);

    if (membershipId) {
      await assertActiveOrgMemberships(supabase, orgId, [membershipId], "Lead");
      const { error: tmError } = await supabase.from("team_memberships").upsert(
        { team_id: teamId, membership_id: membershipId, added_by: user.id },
        { onConflict: "team_id,membership_id" },
      );
      if (tmError) throw tmError;
    }

    const { error } = await supabase
      .from("teams")
      .update({ lead_membership_id: membershipId })
      .eq("id", teamId);
    if (error) throw error;

    await writeAudit(orgId, user.id, "team.lead_changed", {
    targetType: "team",
    targetId: teamId,
    targetLabel: team.name,
    diff: { lead: { from: team.lead_membership_id, to: membershipId } },
  });

    revalidatePath(orgPath(orgSlug, "/teams"));
    revalidatePath(orgPath(orgSlug, `/teams/${teamId}`));
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function addTeamMembers(
  orgId: string,
  orgSlug: string,
  teamId: string,
  membershipIds: string[],
): Promise<ActionResult & { added: number }> {
  try {
    const { user, supabase } = await requireOrgAccess(orgId, "teams:manage");
    const team = await loadTeam(supabase, orgId, teamId);
    await assertActiveOrgMemberships(supabase, orgId, membershipIds, "Add members");

    // De-dup against existing team memberships.
    const { data: existing, error: existingError } = await supabase
      .from("team_memberships")
      .select("membership_id")
      .eq("team_id", teamId);
    if (existingError) throw existingError;
    const existingIds = new Set((existing ?? []).map((e) => e.membership_id));
    const fresh = [...new Set(membershipIds)].filter((id) => !existingIds.has(id));

    if (fresh.length > 0) {
      const { error } = await supabase.from("team_memberships").insert(
        fresh.map((membership_id) => ({
          team_id: teamId,
          membership_id,
          added_by: user.id,
        })),
      );
      if (error) throw error;

      await writeAudit(orgId, user.id, "team.member_added", {
      targetType: "team",
      targetId: teamId,
      targetLabel: team.name,
      metadata: { membership_ids: fresh, count: fresh.length },
    });
    }

    revalidatePath(orgPath(orgSlug, "/teams"));
    revalidatePath(orgPath(orgSlug, `/teams/${teamId}`));
    revalidatePath(orgPath(orgSlug, "/directory"));
    return { ok: true, added: fresh.length };
  } catch (error) {
    return { ...fail(error), added: 0 };
  }
}

/**
 * Remove a member from a team. When the removed member is the lead, the
 * caller must supply a successor (the UI enforces this first; the pure
 * validateLeadRemoval() re-checks here).
 */
export async function removeTeamMember(
  orgId: string,
  orgSlug: string,
  teamId: string,
  membershipId: string,
  successorMembershipId?: string | null,
): Promise<ActionResult> {
  try {
    const { user, supabase } = await requireOrgAccess(orgId, "teams:manage");
    const team = await loadTeam(supabase, orgId, teamId);

    const { data: members, error: membersError } = await supabase
      .from("team_memberships")
      .select("membership_id, memberships!inner(profiles!inner(full_name))")
      .eq("team_id", teamId);
    if (membersError) throw membersError;
    const rows = (members ?? []).map((m) => ({
      membershipId: m.membership_id,
      fullName: (m.memberships as unknown as { profiles: { full_name: string } }).profiles.full_name,
    }));
    const target = rows.find((r) => r.membershipId === membershipId);
    if (!target) throw new Error("That member isn't on this team.");

    const remaining = rows
      .filter((r) => r.membershipId !== membershipId)
      .map((r) => r.membershipId);

    const leadCheck = validateLeadRemoval({
      teamLeadMembershipId: team.lead_membership_id,
      removingMembershipId: membershipId,
      successorMembershipId,
      remainingMemberIds: remaining,
      teamName: team.name,
      memberName: target.fullName,
    });
    if (!leadCheck.ok) throw new Error(leadCheck.error);

    const { error: deleteError } = await supabase
      .from("team_memberships")
      .delete()
      .eq("team_id", teamId)
      .eq("membership_id", membershipId);
    if (deleteError) throw deleteError;

    if (leadCheck.newLeadMembershipId !== team.lead_membership_id) {
      const { error: leadError } = await supabase
        .from("teams")
        .update({ lead_membership_id: leadCheck.newLeadMembershipId })
        .eq("id", teamId);
      if (leadError) throw leadError;
    }

    await writeAudit(orgId, user.id, "team.member_removed", {
    targetType: "team",
    targetId: teamId,
    targetLabel: team.name,
    metadata: { membership_id: membershipId, member_name: target.fullName },
    diff:
        leadCheck.newLeadMembershipId !== team.lead_membership_id
          ? { lead: { from: team.lead_membership_id, to: leadCheck.newLeadMembershipId } }
          : {},
  });

    revalidatePath(orgPath(orgSlug, "/teams"));
    revalidatePath(orgPath(orgSlug, `/teams/${teamId}`));
    revalidatePath(orgPath(orgSlug, "/directory"));
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
