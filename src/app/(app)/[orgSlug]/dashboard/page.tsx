import { notFound } from "next/navigation";
import Link from "next/link";
import { UserPlus } from "lucide-react";

import { requireOrgAccess } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { formatAuditSentence } from "@/lib/audit/sentences";
import { formatRegisterNo } from "@/lib/members/register";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MemberDashboard } from "@/components/dashboard/member-dashboard";

/**
 * Dashboard — "Membership overview" (Flagship UI Designs artifact, Crewspace).
 *
 * Admin view (any admin-ish permission): the organization register at a
 * glance — four KPI cards (Active members / Appointed roles / Pending
 * invitations / Deactivated), the membership-composition stacked bar with
 * its register ledger, and the recent register changes feed drawn from the
 * live audit log.
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

/** Fallback role colors from the artifact's membership chart. */
const ROLE_COLOR_FALLBACKS = ["#1e2530", "#334fc7", "#60739a", "#8a94a4", "#c6cbd2"];

/** "October 6 · 3:18 PM" — the artifact's feed timestamp. */
function formatFeedTime(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}

/** Short category label for an audit action ("3:18 PM · Role assignment"). */
function auditCategory(action: string): string {
  const [domain, event] = action.split(".");
  const words: Record<string, string> = {
    membership: "Membership",
    invitation: "Invitation",
    role: "Role",
    team: "Team",
    audit: "Audit",
    org: "Organization",
    settings: "Settings",
  };
  const domainLabel = words[domain as keyof typeof words] ?? domain;
  const eventLabel = event ? event.replace(/_/g, " ") : "";
  return `${domainLabel}${eventLabel ? ` ${eventLabel}` : ""}`;
}

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

  // Register numbers are org-wide: position in the full membership ordered
  // by join date (the numbered civic register).
  const { data: orgMembershipRows } = await supabase
    .from("memberships")
    .select("id, is_active")
    .eq("org_id", org.id)
    .order("joined_at", { ascending: true });
  const activeMemberships = (orgMembershipRows ?? []).filter((m) => m.is_active);
  const activeCount = activeMemberships.length;
  const deactivatedCount = (orgMembershipRows ?? []).length - activeCount;
  const lastRegisterNo = formatRegisterNo(Math.max(1, (orgMembershipRows ?? []).length));

  const [{ count: pendingCount }, { data: roleRows }, { data: activeRoleRows }] =
    await Promise.all([
      supabase
        .from("invitations")
        .select("id", { count: "exact", head: true })
        .eq("org_id", org.id)
        .eq("status", "pending"),
      supabase.from("roles").select("id, name, system_key, color").eq("org_id", org.id),
      supabase.from("memberships").select("role_id").eq("org_id", org.id).eq("is_active", true),
    ]);

  const memberCountByRole = new Map<string, number>();
  for (const row of activeRoleRows ?? []) {
    memberCountByRole.set(row.role_id, (memberCountByRole.get(row.role_id) ?? 0) + 1);
  }
  const roles = (roleRows ?? [])
    .map((r, index) => ({
      id: r.id,
      name: r.name,
      systemKey: r.system_key,
      color: r.color || ROLE_COLOR_FALLBACKS[index % ROLE_COLOR_FALLBACKS.length],
      count: memberCountByRole.get(r.id) ?? 0,
    }))
    .sort((a, b) => {
      if (a.systemKey === "owner") return -1;
      if (b.systemKey === "owner") return 1;
      return b.count - a.count;
    });
  const baselineRole = roles.find((r) => r.name.toLowerCase() === "member") ?? roles[roles.length - 1];

  // Latest 6 audit events for the recent register changes feed.
  const { data: auditRows } = await supabase
    .from("audit_log")
    .select("id, action, actor_id, target_label, diff, metadata, created_at")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false })
    .limit(6);

  const actorIds = [...new Set((auditRows ?? []).map((r) => r.actor_id))];
  const { data: actorProfiles } =
    actorIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
      : { data: [] as { id: string; full_name: string }[] };
  const actorNameById = new Map((actorProfiles ?? []).map((p) => [p.id, p.full_name]));

  const feed = (auditRows ?? []).map((r, index) => ({
    id: r.id,
    badge: String(index + 1).padStart(2, "0"),
    sentence: formatAuditSentence(actorNameById.get(r.actor_id) ?? "Someone", {
      action: r.action,
      targetLabel: r.target_label,
      diff: r.diff as Record<string, unknown> | null,
      metadata: r.metadata as Record<string, unknown> | null,
    }),
    category: auditCategory(r.action),
    time: formatFeedTime(r.created_at),
  }));

  const canInvite = permissions.includes("members:invite");

  const kpis = [
    {
      label: "Active members",
      value: activeCount,
      caption: `Register 001–${lastRegisterNo}`,
      href: `/${orgSlug}/directory`,
    },
    {
      label: "Appointed roles",
      value: roles.length,
      caption: "Every member accounted for",
      href: `/${orgSlug}/roles`,
    },
    {
      label: "Pending invitations",
      value: pendingCount ?? 0,
      caption: "Outside active headcount",
      href: `/${orgSlug}/invitations`,
    },
    {
      label: "Deactivated",
      value: deactivatedCount,
      caption: "History preserved",
      href: `/${orgSlug}/directory?status=deactivated`,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header — the organization register */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-foreground pb-4">
        <div>
          <p className="type-label uppercase tracking-[0.17em] text-muted-foreground">
            Crewspace / Organization register
          </p>
          <h1 className="type-display mt-1">Membership overview</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Headcount and appointed roles are reconciled to the same active directory that ends
            at Member {lastRegisterNo}.
          </p>
        </div>
        {canInvite ? (
          <Button asChild>
            <Link href={`/${orgSlug}/invitations`}>
              <UserPlus className="size-4" /> Invite member
            </Link>
          </Button>
        ) : null}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-px border bg-border lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Link
            key={kpi.label}
            href={kpi.href}
            className="flex flex-col gap-1 bg-card p-4 transition-colors hover:bg-primary-soft"
          >
            <span className="type-label uppercase tracking-wide text-muted-foreground">
              {kpi.label}
            </span>
            <span className="font-mono text-2xl font-medium tnum">{kpi.value}</span>
            <span className="text-xs text-muted-foreground">{kpi.caption}</span>
          </Link>
        ))}
      </div>

      {/* Membership composition */}
      <Card className="rounded-none border-t-[3px] border-t-foreground">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.08em]">
                Membership composition
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Active directory · members by appointed role
              </p>
            </div>
            <span className="font-mono text-xs text-muted-foreground tnum">
              Members · {activeCount}
            </span>
          </div>

          {roles.length > 0 ? (
            <>
              <div
                className="mt-4 flex h-[42px] w-full overflow-hidden"
                role="img"
                aria-label={roles.map((r) => `${r.name} ${r.count}`).join(", ")}
              >
                {roles.map((role) => (
                  <span
                    key={role.id}
                    title={`${role.name}: ${role.count} members`}
                    className="h-full"
                    style={{
                      width: `${activeCount > 0 ? (role.count / activeCount) * 100 : 0}%`,
                      backgroundColor: role.color,
                    }}
                  />
                ))}
              </div>
              <div className="mt-2 flex justify-between font-mono text-[11px] text-muted-foreground tnum">
                <span>0</span>
                <span>{activeCount} members</span>
              </div>
              <ul className="mt-3 flex flex-col divide-y divide-border">
                {roles.map((role) => (
                  <li
                    key={role.id}
                    className="flex items-center gap-3 py-2 text-sm"
                  >
                    <span
                      className="size-2.5 shrink-0"
                      style={{ backgroundColor: role.color }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">{role.name}</span>
                    <span className="font-mono text-sm tnum">{role.count}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-border pt-4 text-sm">
                <strong className="font-semibold">
                  Member {lastRegisterNo} closes a {activeCount}-person register
                  {baselineRole ? `; ${baselineRole.count} hold the baseline ${baselineRole.name} role` : ""}.
                </strong>
                <span className="mt-1 block font-mono text-xs text-muted-foreground tnum">
                  {roles.map((r) => r.count).join(" + ")} = {activeCount} active members
                </span>
              </p>
            </>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              No roles defined yet — create one to start composing the register.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recent register changes */}
      <div>
        <div className="flex items-baseline justify-between border-b border-foreground pb-2">
          <h2 className="text-sm font-bold uppercase tracking-[0.17em]">
            Recent register changes
          </h2>
          <span className="text-xs text-muted-foreground">Permanent audit record</span>
        </div>
        <Card className="mt-4 rounded-none">
          <CardContent className="pt-2">
            {feed.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No register changes yet — invitations, role assignments, and permission
                updates will appear here.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {feed.map((item) => (
                  <li key={item.id} className="grid grid-cols-[2.5rem_1fr_auto] items-start gap-3 py-3">
                    <span
                      className="grid size-8 place-items-center border-b-2 border-primary font-mono text-[11px] font-bold text-foreground"
                      aria-hidden
                    >
                      {item.badge}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold leading-snug">
                        {item.sentence}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {item.category}
                      </span>
                    </span>
                    <time className="shrink-0 font-mono text-[11px] text-muted-foreground tnum">
                      {item.time}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
