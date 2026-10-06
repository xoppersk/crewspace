import { notFound } from "next/navigation";

import { requireOrgAccess } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{org.name}</h1>
          <p className="text-sm text-muted-foreground">Here&rsquo;s what&rsquo;s happening in your workspace.</p>
        </div>
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
            <ActivityFeed orgId={org.id} initialEvents={initialActivity} />
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
    </div>
  );
}
