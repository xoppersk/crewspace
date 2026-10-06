import { notFound } from "next/navigation";
import { Suspense } from "react";

import { requireOrgAccess } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { TeamsClient } from "@/components/teams/teams-client";
import type { TeamCardData } from "@/components/teams/team-card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Teams list — card grid with lead avatar, member avatar stack, archived
 * badge, and the All/Active/Archived filter (APP-FLOW §3).
 */
export default async function TeamsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", orgSlug)
    .maybeSingle();
  if (!org) notFound();

  const { permissions } = await requireOrgAccess(org.id, "org:read");
  const canCreate = permissions.includes("teams:create");

  const { data: teamRows } = await supabase
    .from("teams")
    .select("id, name, description, lead_membership_id, is_archived")
    .eq("org_id", org.id)
    .order("name");
  const teams = teamRows ?? [];

  // Memberships per team (counts + avatar previews) in two queries.
  const teamIds = teams.map((t) => t.id);
  const { data: tmRows } =
    teamIds.length > 0
      ? await supabase
          .from("team_memberships")
          .select(
            "team_id, membership_id, memberships!inner(user_id, profiles!inner(full_name, avatar_url))",
          )
          .in("team_id", teamIds)
      : { data: [] as { team_id: string; membership_id: string; memberships: unknown }[] };

  const membersByTeam = new Map<
    string,
    { membershipId: string; userId: string; fullName: string; avatarUrl: string | null }[]
  >();
  for (const row of tmRows ?? []) {
    const m = row.memberships as unknown as {
      user_id: string;
      profiles: { full_name: string; avatar_url: string | null };
    };
    const list = membersByTeam.get(row.team_id) ?? [];
    list.push({
      membershipId: row.membership_id,
      userId: m.user_id,
      fullName: m.profiles.full_name,
      avatarUrl: m.profiles.avatar_url,
    });
    membersByTeam.set(row.team_id, list);
  }

  const teamCards: TeamCardData[] = teams.map((team) => {
    const members = membersByTeam.get(team.id) ?? [];
    const leadEntry = team.lead_membership_id
      ? members.find((m) => m.membershipId === team.lead_membership_id)
      : undefined;
    return {
      id: team.id,
      name: team.name,
      description: team.description,
      isArchived: team.is_archived,
      memberCount: members.length,
      lead: leadEntry
        ? {
            userId: leadEntry.userId,
            fullName: leadEntry.fullName,
            avatarUrl: leadEntry.avatarUrl,
          }
        : null,
      previewMembers: members.map((m) => ({
        userId: m.userId,
        fullName: m.fullName,
        avatarUrl: m.avatarUrl,
      })),
    };
  });

  // Lead candidates for the New-team dialog: active org members.
  const { data: candidateRows } = await supabase
    .from("memberships")
    .select("id, profiles!inner(full_name)")
    .eq("org_id", org.id)
    .eq("is_active", true)
    .order("joined_at");
  const leadCandidates = (candidateRows ?? []).map((c) => ({
    membershipId: c.id,
    fullName: (c.profiles as unknown as { full_name: string }).full_name,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Teams</h1>
        <p className="text-sm text-muted-foreground">
          {teams.length} team{teams.length === 1 ? "" : "s"} in this organization
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-lg" />}>
        <TeamsClient
          orgId={org.id}
          orgSlug={orgSlug}
          teams={teamCards}
          canCreate={canCreate}
          leadCandidates={leadCandidates}
        />
      </Suspense>
    </div>
  );
}
