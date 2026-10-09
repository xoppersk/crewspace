import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { requireOrgAccess } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import type { RoleOption } from "@/components/roles/role-select";
import type { TeamMemberEntry } from "@/components/directory/member-teams-editor";
import { MemberDetailClient } from "@/components/directory/member-detail-client";
import { Button } from "@/components/ui/button";

/**
 * Member detail — full profile with About, Teams, Role & access (effective
 * permissions + assignment history from audit_log), and the gated Admin
 * actions card. Non-admins get the read-only variant (no actions card).
 */
export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; memberId: string }>;
}) {
  const { orgSlug, memberId } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", orgSlug)
    .maybeSingle();
  if (!org) notFound();

  const { user, permissions } = await requireOrgAccess(org.id, "members:read");

  const { data: memberRow, error } = await supabase
    .from("memberships")
    .select(
      `id, user_id, role_id, is_active, deactivated_at, last_active_at, joined_at,
       profiles!inner(id, full_name, avatar_url, title, bio, timezone),
       roles!inner(id, name, system_key, color)`,
    )
    .eq("org_id", org.id)
    .eq("id", memberId)
    .maybeSingle();
  if (error) throw error;
  if (!memberRow) notFound();

  const member = memberRow as unknown as {
    id: string;
    user_id: string;
    role_id: string;
    is_active: boolean;
    deactivated_at: string | null;
    last_active_at: string | null;
    joined_at: string;
    profiles: {
      full_name: string;
      avatar_url: string | null;
      title: string | null;
      bio: string | null;
      timezone: string;
    };
    roles: { id: string; name: string; system_key: string | null; color: string };
  };

  // Member's teams (with lead flags) + all active teams for the add picker.
  const [{ data: memberTeams }, { data: allTeams }] = await Promise.all([
    supabase
      .from("team_memberships")
      .select("team_id, teams!inner(id, name, lead_membership_id)")
      .eq("membership_id", member.id),
    supabase
      .from("teams")
      .select("id, name")
      .eq("org_id", org.id)
      .eq("is_archived", false)
      .order("name"),
  ]);

  const teams = (memberTeams ?? []).map((tm) => {
    const t = tm.teams as unknown as { id: string; name: string; lead_membership_id: string | null };
    return { id: t.id, name: t.name, isLead: t.lead_membership_id === member.id };
  });
  const memberTeamIds = teams.map((t) => t.id);

  // Rosters for the successor picker.
  const teamMembers: Record<string, TeamMemberEntry[]> = {};
  if (memberTeamIds.length > 0) {
    const { data: rosterData } = await supabase
      .from("team_memberships")
      .select("team_id, membership_id, memberships!inner(profiles!inner(full_name))")
      .in("team_id", memberTeamIds);
    for (const r of rosterData ?? []) {
      const fullName = (r.memberships as unknown as { profiles: { full_name: string } }).profiles
        .full_name;
      const list = teamMembers[r.team_id] ?? [];
      list.push({ membershipId: r.membership_id, fullName });
      teamMembers[r.team_id] = list;
    }
  }

  // Roles (for the change-role dialog) with permission counts.
  const { data: roleRows } = await supabase
    .from("roles")
    .select("id, name, system_key")
    .eq("org_id", org.id)
    .order("name");
  const roles = roleRows ?? [];
  const { data: rolePermRows } = await supabase
    .from("role_permissions")
    .select("role_id")
    .in("role_id", roles.map((r) => r.id));
  const permCountByRole = new Map<string, number>();
  for (const row of rolePermRows ?? []) {
    permCountByRole.set(row.role_id, (permCountByRole.get(row.role_id) ?? 0) + 1);
  }
  const roleOptions: RoleOption[] = roles.map((r) => ({
    id: r.id,
    name: r.name,
    systemKey: r.system_key,
    permissionCount: permCountByRole.get(r.id) ?? 0,
  }));

  // Effective permissions for the member's role, grouped by resource.
  const { data: effectiveRows } = await supabase
    .from("role_permissions")
    .select("permission_key, permissions!inner(key, resource, label, description)")
    .eq("role_id", member.role_id);
  const effectivePermissions = (effectiveRows ?? []).map((row) => {
    const p = row.permissions as unknown as {
      key: string;
      resource: string;
      label: string;
      description: string | null;
    };
    return { key: p.key, resource: p.resource, label: p.label, description: p.description };
  });

  // Assignment history from the audit log.
  const { data: historyRows } = await supabase
    .from("audit_log")
    .select("id, action, actor_id, target_label, diff, created_at")
    .eq("org_id", org.id)
    .eq("target_type", "membership")
    .eq("target_id", member.id)
    .in("action", ["membership.role_changed", "membership.created", "membership.deactivated", "membership.reactivated", "membership.removed"])
    .order("created_at", { ascending: false })
    .limit(20);

  const actorIds = [...new Set((historyRows ?? []).map((h) => h.actor_id))];
  const { data: actorProfiles } =
    actorIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
      : { data: [] as { id: string; full_name: string }[] };
  const actorNameById = new Map((actorProfiles ?? []).map((p) => [p.id, p.full_name]));

  const history = (historyRows ?? []).map((h) => ({
    id: h.id,
    action: h.action,
    actorName: actorNameById.get(h.actor_id) ?? "Someone",
    diff: h.diff as Record<string, unknown>,
    createdAt: h.created_at,
  }));

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" className="w-fit min-h-11 gap-1 pl-0 sm:min-h-9">
        <Link href={`/${orgSlug}/directory`}>
          <ChevronLeft className="size-4" aria-hidden /> Directory
        </Link>
      </Button>

      <MemberDetailClient
        orgId={org.id}
        orgSlug={orgSlug}
        currentUserId={user.id}
        permissions={permissions}
        member={{
          membershipId: member.id,
          userId: member.user_id,
          fullName: member.profiles.full_name,
          avatarUrl: member.profiles.avatar_url,
          title: member.profiles.title,
          bio: member.profiles.bio,
          timezone: member.profiles.timezone,
          isActive: member.is_active,
          lastActiveAt: member.last_active_at,
          joinedAt: member.joined_at,
          deactivatedAt: member.deactivated_at,
          roleId: member.role_id,
          roleName: member.roles.name,
          roleSystemKey: member.roles.system_key,
        }}
        teams={teams}
        allTeams={(allTeams ?? []).map((t) => ({ id: t.id, name: t.name }))}
        teamMembers={teamMembers}
        roles={roleOptions}
        effectivePermissions={effectivePermissions}
        history={history}
      />
    </div>
  );
}
