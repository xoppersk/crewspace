import { notFound } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { requireOrgAccess } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  buildDirectoryClauses,
  describeDirectoryFilters,
  directoryPageRange,
  DIRECTORY_PAGE_SIZE,
  parseDirectoryFilters,
  type DirectoryClause,
} from "@/lib/members/filters";
import type { DirectoryMember } from "@/lib/members/summaries";
import type { RoleOption } from "@/components/roles/role-select";
import { DirectoryClient } from "@/components/directory/directory-client";
import { DirectoryToolbar } from "@/components/directory/directory-toolbar";
import type { TeamMemberEntry } from "@/components/directory/member-teams-editor";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type MemberRow = {
  id: string;
  user_id: string;
  role_id: string;
  is_active: boolean;
  last_active_at: string | null;
  joined_at: string;
  profiles: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    title: string | null;
    timezone: string;
  };
  roles: { id: string; name: string; system_key: string | null; color: string };
};

/**
 * Member directory — the flagship screen (APP-FLOW §3, DESIGN-BRIEF §4).
 * Server Component: parses URL filters, runs the paginated query (25/page),
 * and hands rows to the client shell for table/cards, bulk select, and the
 * member drawer.
 */
export default async function DirectoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgSlug } = await params;
  const filters = parseDirectoryFilters(await searchParams);
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", orgSlug)
    .maybeSingle();
  if (!org) notFound();

  const { user, permissions } = await requireOrgAccess(org.id, "members:read");

  // Filter option data: roles (with permission + member counts for the
  // RoleSelect) and non-archived teams.
  const [{ data: roleRows }, { data: teamRows }] = await Promise.all([
    supabase
      .from("roles")
      .select("id, name, system_key, color")
      .eq("org_id", org.id)
      .order("name"),
    supabase
      .from("teams")
      .select("id, name, lead_membership_id")
      .eq("org_id", org.id)
      .eq("is_archived", false)
      .order("name"),
  ]);
  const roles = roleRows ?? [];
  const teams = teamRows ?? [];

  const roleIds = roles.map((r) => r.id);
  const [{ data: rolePermRows }, { data: roleMemberRows }] = await Promise.all([
    roleIds.length > 0
      ? supabase.from("role_permissions").select("role_id").in("role_id", roleIds)
      : Promise.resolve({ data: [] as { role_id: string }[] }),
    supabase.from("memberships").select("role_id").eq("org_id", org.id),
  ]);
  const permCountByRole = new Map<string, number>();
  for (const row of rolePermRows ?? []) {
    permCountByRole.set(row.role_id, (permCountByRole.get(row.role_id) ?? 0) + 1);
  }
  const memberCountByRole = new Map<string, number>();
  for (const row of roleMemberRows ?? []) {
    memberCountByRole.set(row.role_id, (memberCountByRole.get(row.role_id) ?? 0) + 1);
  }

  const roleOptions: RoleOption[] = roles.map((r) => ({
    id: r.id,
    name: r.name,
    systemKey: r.system_key,
    permissionCount: permCountByRole.get(r.id) ?? 0,
    memberCount: memberCountByRole.get(r.id) ?? 0,
  }));

  // Team filter needs the membership ids first (team_memberships join).
  let teamMemberIds: string[] | null = null;
  if (filters.teamId !== "all") {
    const { data: tmRows } = await supabase
      .from("team_memberships")
      .select("membership_id, teams!inner(id, org_id)")
      .eq("teams.org_id", org.id)
      .eq("team_id", filters.teamId);
    teamMemberIds = (tmRows ?? []).map((r) => r.membership_id);
  }
  const forceEmpty = teamMemberIds !== null && teamMemberIds.length === 0;

  // Build the member query from the pure clause list.
  const clauses = buildDirectoryClauses(filters);
  let query = supabase
    .from("memberships")
    .select(
      `id, user_id, role_id, is_active, last_active_at, joined_at,
       profiles!inner(id, full_name, avatar_url, title, timezone),
       roles!inner(id, name, system_key, color)`,
      { count: "exact" },
    )
    .eq("org_id", org.id);

  for (const clause of clauses) {
    query = applyClause(query, clause);
  }
  if (teamMemberIds && teamMemberIds.length > 0) {
    query = query.in("id", teamMemberIds);
  }

  const { from, to } = directoryPageRange(filters.page);
  const { data, count, error } = forceEmpty
    ? { data: [], count: 0, error: null }
    : await query.range(from, to);
  if (error) throw error;

  const rows = (data ?? []) as unknown as MemberRow[];
  const memberIds = rows.map((r) => r.id);

  // Team memberships for the page's members (pills) + lead map + names for
  // the drawer's successor picker.
  const { data: tmData } =
    memberIds.length > 0
      ? await supabase
          .from("team_memberships")
          .select("team_id, membership_id, teams!inner(id, name, lead_membership_id)")
          .in("membership_id", memberIds)
      : { data: [] as { team_id: string; membership_id: string; teams: unknown }[] };

  const teamIdsByMember = new Map<string, { id: string; name: string }[]>();
  const leadMembershipByTeam: Record<string, string | null> = {};
  const allTeamIds = new Set<string>();
  for (const tm of tmData ?? []) {
    const team = tm.teams as unknown as { id: string; name: string; lead_membership_id: string | null };
    allTeamIds.add(team.id);
    leadMembershipByTeam[team.id] = team.lead_membership_id;
    const list = teamIdsByMember.get(tm.membership_id) ?? [];
    list.push({ id: team.id, name: team.name });
    teamIdsByMember.set(tm.membership_id, list);
  }

  // All teams (incl. archived) for the lead map, so the drawer knows leads.
  const { data: allTeamsData } = await supabase
    .from("teams")
    .select("id, lead_membership_id")
    .eq("org_id", org.id);
  for (const t of allTeamsData ?? []) {
    if (!(t.id in leadMembershipByTeam)) leadMembershipByTeam[t.id] = t.lead_membership_id;
  }

  // Team rosters (for the successor picker): members of the page members' teams.
  const teamMembers: Record<string, TeamMemberEntry[]> = {};
  if (allTeamIds.size > 0) {
    const { data: rosterData } = await supabase
      .from("team_memberships")
      .select("team_id, membership_id, memberships!inner(profiles!inner(full_name))")
      .in("team_id", [...allTeamIds]);
    for (const r of rosterData ?? []) {
      const fullName = (
        r.memberships as unknown as { profiles: { full_name: string } }
      ).profiles.full_name;
      const list = teamMembers[r.team_id] ?? [];
      list.push({ membershipId: r.membership_id, fullName });
      teamMembers[r.team_id] = list;
    }
  }

  const members: DirectoryMember[] = rows.map((row) => {
    const memberTeams = teamIdsByMember.get(row.id) ?? [];
    return {
      membershipId: row.id,
      userId: row.user_id,
      fullName: row.profiles.full_name,
      avatarUrl: row.profiles.avatar_url,
      title: row.profiles.title,
      timezone: row.profiles.timezone,
      isActive: row.is_active,
      lastActiveAt: row.last_active_at,
      joinedAt: row.joined_at,
      roleId: row.role_id,
      roleName: row.roles.name,
      roleSystemKey: row.roles.system_key,
      roleColor: row.roles.color,
      teamIds: memberTeams.map((t) => t.id),
      teamNames: memberTeams.map((t) => t.name),
    };
  });

  // Sort is fully server-side (PostgREST orders on the joined profile row).
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / DIRECTORY_PAGE_SIZE));
  const teamName = teams.find((t) => t.id === filters.teamId)?.name;
  const roleName = roles.find((r) => r.id === filters.roleId)?.name;
  const resultSummary = `${totalCount} ${totalCount === 1 ? "member" : "members"}${filters.page > 1 ? ` · page ${filters.page} of ${totalPages}` : ""}`;

  const pageParams = (page: number) => {
    const next = new URLSearchParams();
    if (filters.q) next.set("q", filters.q);
    if (filters.teamId !== "all") next.set("team", filters.teamId);
    if (filters.roleId !== "all") next.set("role", filters.roleId);
    if (filters.status !== "all") next.set("status", filters.status);
    if (filters.onlineOnly) next.set("online", "1");
    if (filters.sort !== "name") next.set("sort", filters.sort);
    if (page > 1) next.set("page", String(page));
    const qs = next.toString();
    return `/${orgSlug}/directory${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Directory</h1>
        <p className="text-sm text-muted-foreground">
          {describeDirectoryFilters(filters, teamName, roleName)} — {resultSummary}
        </p>
      </div>

      <Suspense fallback={<Skeleton className="h-24 w-full rounded-lg" />}>
        <DirectoryToolbar
          teams={teams.map((t) => ({ id: t.id, name: t.name }))}
          roles={roles.map((r) => ({ id: r.id, name: r.name }))}
          resultSummary={resultSummary}
        />
      </Suspense>

      <Suspense
        key={JSON.stringify(filters)}
        fallback={<DirectorySkeleton />}
      >
        <DirectoryClient
          members={members}
          orgId={org.id}
          orgSlug={orgSlug}
          currentUserId={user.id}
          permissions={permissions}
          roles={roleOptions}
          teams={teams.map((t) => ({ id: t.id, name: t.name }))}
          teamMembers={teamMembers}
          leadMembershipByTeam={leadMembershipByTeam}
          onlineOnly={filters.onlineOnly}
        />
      </Suspense>

      {totalPages > 1 ? (
        <nav aria-label="Directory pages" className="flex items-center justify-between">
          <Button asChild variant="outline" disabled={filters.page <= 1} className="min-h-11 sm:min-h-9">
            <Link
              href={pageParams(filters.page - 1)}
              aria-disabled={filters.page <= 1}
              tabIndex={filters.page <= 1 ? -1 : undefined}
              className={filters.page <= 1 ? "pointer-events-none opacity-50" : undefined}
            >
              <ChevronLeft className="size-4" aria-hidden /> Previous
            </Link>
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            Page {filters.page} of {totalPages}
          </span>
          {filters.page < totalPages ? (
            <Button asChild variant="outline" className="min-h-11 sm:min-h-9">
              <Link href={pageParams(filters.page + 1)}>
                Next <ChevronRight className="size-4" aria-hidden />
              </Link>
            </Button>
          ) : (
            <span className="w-24" aria-hidden />
          )}
        </nav>
      ) : null}

      {/* Mobile "load more" replaces the pagination controls on small screens */}
      {totalPages > 1 && filters.page < totalPages ? (
        <Button asChild variant="outline" className="min-h-11 w-full md:hidden">
          <Link href={pageParams(filters.page + 1)}>Load more members</Link>
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Bind one pure clause to the Supabase query builder. Generic over the
 * builder type so chained calls keep their inferred types.
 */
function applyClause<TQuery>(query: TQuery, clause: DirectoryClause): TQuery {
  const q = query as unknown as {
    or: (filters: string, opts: { referencedTable: string }) => TQuery;
    eq: (column: string, value: string | boolean) => TQuery;
    order: (
      column: string,
      opts: { ascending: boolean; nullsFirst?: boolean; referencedTable?: string },
    ) => TQuery;
  };
  switch (clause.type) {
    case "search":
      // profiles.email (citext, 00013) is searchable under the same RLS as
      // the profile row itself — no extra policy needed.
      return q.or(
        `full_name.ilike.${clause.pattern},title.ilike.${clause.pattern},email.ilike.${clause.pattern}`,
        {
          referencedTable: "profiles",
        },
      );
    case "role":
      return q.eq("role_id", clause.roleId);
    case "isActive":
      return q.eq("is_active", clause.value);
    case "team":
      // Handled before the query (team_memberships join) — never reaches here.
      return query;
    case "order":
      if (clause.column === "name") {
        return q.order("full_name", { referencedTable: "profiles", ascending: true });
      }
      return q.order(clause.column, { ascending: clause.ascending, nullsFirst: false });
  }
}

function DirectorySkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-label="Loading members">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  );
}
