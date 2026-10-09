import { notFound } from "next/navigation";
import Link from "next/link";
import { UserPlus } from "lucide-react";

import { requireOrgAccess } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCards } from "@/components/dashboard/stat-cards";
import { GettingStartedChecklist } from "@/components/dashboard/getting-started-checklist";
import { PendingInvitations } from "@/components/dashboard/pending-invitations";
import { ActivityFeed, type ActivityEvent } from "@/components/dashboard/activity-feed";
import { MemberDashboard } from "@/components/dashboard/member-dashboard";

/**
 * Dashboard (APP-FLOW §3, DESIGN-BRIEF §4.5).
 *
 * Admin view (any admin-ish permission): stat cards, getting-started
 * checklist with a progress ring, top-5 pending invitations with quick
 * resend/revoke, and the live recent-activity feed.
 *
 * Member view: welcome header, "My access" summary, "Who's online" strip,
 * and the viewer's teams.
 */
const ADMIN_KEYS = [
  "members:invite",
  "members:change_role",
  "members:deactivate",
  "invitations:manage",
  "teams:create",
  "teams:manage",
  "roles:create",
  "roles:assign",
  "audit:read",
];

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("slug", orgSlug)
    .maybeSingle();
  if (!org) notFound();

  const { user, permissions, membership } = await requireOrgAccess(org.id, "org:read");
  const isAdminView = permissions.some((key) => ADMIN_KEYS.includes(key));

  if (!isAdminView) {
    return (
      <MemberDashboard
        orgId={org.id}
        orgSlug={orgSlug}
        orgName={org.name}
        userId={user.id}
        membershipId={membership.id}
        permissions={permissions}
      />
    );
  }

  // Stats (exact counts, single round-trip each — RLS narrows to this org).
  const [
    { count: memberCount },
    { count: pendingCount },
    { count: teamCount },
    { count: customRoleCount },
    { count: invitationCount },
    { count: acceptedCount },
  ] = await Promise.all([
    supabase.from("memberships").select("id", { count: "exact", head: true }).eq("org_id", org.id),
    supabase
      .from("invitations")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id)
      .eq("status", "pending"),
    supabase
      .from("teams")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id)
      .eq("is_archived", false),
    supabase
      .from("roles")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id)
      .eq("is_system", false),
    supabase.from("invitations").select("id", { count: "exact", head: true }).eq("org_id", org.id),
    supabase
      .from("invitations")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id)
      .eq("status", "accepted"),
  ]);

  // Top-5 pending invitations with role + inviter names.
  const { data: pendingRows } = await supabase
    .from("invitations")
    .select("id, email, role_id, invited_by, created_at, expires_at, resend_count")
    .eq("org_id", org.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(5);

  const roleIds = [...new Set((pendingRows ?? []).map((r) => r.role_id))];
  const inviterIds = [...new Set((pendingRows ?? []).map((r) => r.invited_by))];
  const [{ data: inviteRoles }, { data: inviterProfiles }] = await Promise.all([
    roleIds.length > 0
      ? supabase.from("roles").select("id, name").in("id", roleIds)
      : { data: [] as { id: string; name: string }[] },
    inviterIds.length > 0
      ? supabase.from("profiles").select("id, full_name").in("id", inviterIds)
      : { data: [] as { id: string; full_name: string }[] },
  ]);
  const roleNameById = new Map((inviteRoles ?? []).map((r) => [r.id, r.name]));
  const inviterNameById = new Map((inviterProfiles ?? []).map((p) => [p.id, p.full_name]));

  const pendingInvitations = (pendingRows ?? []).map((r) => ({
    id: r.id,
    email: r.email,
    roleName: roleNameById.get(r.role_id) ?? "—",
    invitedBy: inviterNameById.get(r.invited_by) ?? "Someone",
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    resendCount: r.resend_count,
  }));

  // Latest 8 audit events (initial feed state; the client subscribes live).
  const { data: auditRows } = await supabase
    .from("audit_log")
    .select("id, action, actor_id, target_label, created_at")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false })
    .limit(8);

  const actorIds = [...new Set((auditRows ?? []).map((r) => r.actor_id))];
  const { data: actorProfiles } =
    actorIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
      : { data: [] as { id: string; full_name: string }[] };
  const actorNameById = new Map((actorProfiles ?? []).map((p) => [p.id, p.full_name]));

  const initialActivity: ActivityEvent[] = (auditRows ?? []).map((r) => ({
    id: r.id,
    action: r.action,
    actorName: actorNameById.get(r.actor_id) ?? "Someone",
    targetLabel: r.target_label,
    createdAt: r.created_at,
  }));

  const canReadAudit = permissions.includes("audit:read");
  const canManageInvitations = permissions.includes("invitations:manage");
  const canInvite = permissions.includes("members:invite");

  // Team sizes for the mini bar chart (pure CSS bars, no chart lib).
  const { data: teamRows } = await supabase
    .from("teams")
    .select("id, name")
    .eq("org_id", org.id)
    .eq("is_archived", false)
    .order("name");
  const teamIds = (teamRows ?? []).map((t) => t.id);
  const { data: teamMemberRows } =
    teamIds.length > 0
      ? await supabase.from("team_memberships").select("team_id").in("team_id", teamIds)
      : { data: [] as { team_id: string }[] };
  const teamSizeById = new Map<string, number>();
  for (const row of teamMemberRows ?? []) {
    teamSizeById.set(row.team_id, (teamSizeById.get(row.team_id) ?? 0) + 1);
  }
  const teamSizes = (teamRows ?? []).map((t) => ({
    name: t.name,
    size: teamSizeById.get(t.id) ?? 0,
  }));
  const maxTeamSize = Math.max(1, ...teamSizes.map((t) => t.size));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{org.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Here&rsquo;s what&rsquo;s happening in your workspace.</p>
        </div>
        {canInvite ? (
          <Button asChild>
            <Link href={`/${orgSlug}/invitations`}>
              <UserPlus className="size-4" /> Invite members
            </Link>
          </Button>
        ) : null}
      </div>

      <StatCards
        stats={[
          { label: "Members", value: memberCount ?? 0, href: `/${orgSlug}/directory` },
          { label: "Pending invitations", value: pendingCount ?? 0, href: `/${orgSlug}/invitations` },
          { label: "Teams", value: teamCount ?? 0, href: `/${orgSlug}/teams` },
          { label: "Custom roles", value: customRoleCount ?? 0, href: `/${orgSlug}/roles` },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <PendingInvitations
            orgId={org.id}
            orgSlug={orgSlug}
            invitations={pendingInvitations}
            canManage={canManageInvitations}
          />
          {canReadAudit ? (
            <ActivityFeed orgId={org.id} orgSlug={orgSlug} initialEvents={initialActivity} />
          ) : null}
        </div>
        <GettingStartedChecklist
          orgId={org.id}
          items={[
            {
              id: "invite",
              label: "Invite your first teammate",
              description: "Send an invitation from the Invitations page.",
              done: (invitationCount ?? 0) > 0,
              href: `/${orgSlug}/invitations`,
            },
            {
              id: "team",
              label: "Create your first team",
              description: "Group members so the directory stays organized.",
              done: (teamCount ?? 0) > 0,
              href: `/${orgSlug}/teams`,
            },
            {
              id: "role",
              label: "Create a custom role",
              description: "Tailor permissions beyond the five system roles.",
              done: (customRoleCount ?? 0) > 0,
              href: `/${orgSlug}/roles/new`,
            },
            {
              id: "accepted",
              label: "Get your first invite accepted",
              description: "A teammate joins and appears in the directory.",
              done: (acceptedCount ?? 0) > 0 || (memberCount ?? 0) > 1,
              href: `/${orgSlug}/directory`,
            },
          ]}
        />
      </div>

      {/* Team sizes — mini bar chart, pure CSS (UI-DESIGN.md §2.6) */}
      {teamSizes.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Team sizes</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2.5">
              {teamSizes.map((team) => (
                <li key={team.name} className="grid grid-cols-[10rem_1fr_auto] items-center gap-3">
                  <span className="truncate text-sm font-medium">{team.name}</span>
                  <span
                    className="h-2.5 bg-primary-soft"
                    role="img"
                    aria-label={`${team.name}: ${team.size} members`}
                  >
                    <span
                      className="block h-full bg-primary"
                      style={{ width: `${Math.max(4, (team.size / maxTeamSize) * 100)}%` }}
                    />
                  </span>
                  <span className="text-sm text-muted-foreground tnum">
                    {team.size} member{team.size === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
