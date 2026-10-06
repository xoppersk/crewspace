import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { requireOrgAccess } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  TeamDetailClient,
  type TeamActivityEntry,
  type TeamDetailMember,
} from "@/components/teams/team-detail-client";
import type { MemberCandidate } from "@/components/teams/add-members-picker";
import { Button } from "@/components/ui/button";

const ACTIVITY_LABELS: Record<string, string> = {
  "team.created": "created this team",
  "team.updated": "updated this team",
  "team.archived": "archived this team",
  "team.unarchived": "unarchived this team",
  "team.lead_changed": "changed the team lead",
  "team.member_added": "joined the team",
  "team.member_removed": "left the team",
};

/**
 * Team detail — header, Members (scoped table + add/remove with successor
 * handling), Settings (name/description/lead/archive), Activity (audit
 * filtered to this team). APP-FLOW §3.
 */
export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", orgSlug)
    .maybeSingle();
  if (!org) notFound();

  const { permissions } = await requireOrgAccess(org.id, "org:read");
  const canManage = permissions.includes("teams:manage");
  const canReadAudit = permissions.includes("audit:read");

  const { data: team, error } = await supabase
    .from("teams")
    .select("id, name, description, lead_membership_id, is_archived")
    .eq("org_id", org.id)
    .eq("id", teamId)
    .maybeSingle();
  if (error) throw error;
  if (!team) notFound();

  // Team members with profiles.
  const { data: tmRows } = await supabase
    .from("team_memberships")
    .select(
      "membership_id, added_at, memberships!inner(user_id, is_active, profiles!inner(full_name, avatar_url, title))",
    )
    .eq("team_id", team.id)
    .order("added_at");

  const members: TeamDetailMember[] = (tmRows ?? []).map((row) => {
    const m = row.memberships as unknown as {
      user_id: string;
      profiles: { full_name: string; avatar_url: string | null; title: string | null };
    };
    return {
      membershipId: row.membership_id,
      userId: m.user_id,
      fullName: m.profiles.full_name,
      avatarUrl: m.profiles.avatar_url,
      title: m.profiles.title,
      isLead: team.lead_membership_id === row.membership_id,
    };
  });
  members.sort((a, b) => a.fullName.localeCompare(b.fullName));

  // Candidates: active org members not already on the team.
  const memberIds = new Set(members.map((m) => m.membershipId));
  const { data: orgMembers } = await supabase
    .from("memberships")
    .select("id, user_id, profiles!inner(full_name, avatar_url, title)")
    .eq("org_id", org.id)
    .eq("is_active", true)
    .order("joined_at");
  const candidates: MemberCandidate[] = (orgMembers ?? [])
    .filter((m) => !memberIds.has(m.id))
    .map((m) => {
      const p = m.profiles as unknown as {
        full_name: string;
        avatar_url: string | null;
        title: string | null;
      };
      return {
        membershipId: m.id,
        userId: m.user_id,
        fullName: p.full_name,
        avatarUrl: p.avatar_url,
        title: p.title,
      };
    });

  // Activity: audit events targeting this team.
  let activity: TeamActivityEntry[] = [];
  if (canReadAudit) {
    const { data: auditRows } = await supabase
      .from("audit_log")
      .select("id, action, actor_id, metadata, created_at")
      .eq("org_id", org.id)
      .eq("target_type", "team")
      .eq("target_id", team.id)
      .order("created_at", { ascending: false })
      .limit(20);

    const actorIds = [...new Set((auditRows ?? []).map((r) => r.actor_id))];
    const { data: actorProfiles } =
      actorIds.length > 0
        ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
        : { data: [] as { id: string; full_name: string }[] };
    const actorNameById = new Map((actorProfiles ?? []).map((p) => [p.id, p.full_name]));

    activity = (auditRows ?? []).map((r) => {
      const metadata = r.metadata as { member_name?: string };
      const suffix = metadata?.member_name ? `: ${metadata.member_name}` : "";
      return {
        id: r.id,
        action: r.action,
        actorName: actorNameById.get(r.actor_id) ?? "Someone",
        label: `${ACTIVITY_LABELS[r.action] ?? r.action}${suffix}`,
        createdAt: r.created_at,
      };
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Button asChild variant="ghost" className="w-fit min-h-11 gap-1 pl-0 sm:min-h-9">
        <Link href={`/${orgSlug}/teams`}>
          <ChevronLeft className="size-4" aria-hidden /> Teams
        </Link>
      </Button>
      <TeamDetailClient
        orgId={org.id}
        orgSlug={orgSlug}
        team={{
          id: team.id,
          name: team.name,
          description: team.description,
          isArchived: team.is_archived,
        }}
        members={members}
        candidates={candidates}
        activity={activity}
        canManage={canManage}
        canReadAudit={canReadAudit}
      />
    </div>
  );
}
