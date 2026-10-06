import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requireOrgAccess } from "@/lib/permissions";
import { FREE_PLAN } from "@/lib/plan";
import { SettingsForm, type SettingsInitial } from "@/components/settings/settings-form";
import type { TransferCandidate } from "@/components/settings/ownership-transfer-card";

export const metadata: Metadata = { title: "Organization settings" };

/**
 * Settings page — tabs: General | Member policy | Security | Plan.
 * Server loads the org settings, role options, and plan usage; the client
 * form owns dirty state and the sticky save bar.
 * Gate: `settings:manage` (layer 2).
 */
export default async function SettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select(
      "id, slug, name, logo_url, default_role_id, invite_policy, allowed_domains, require_email_verification, session_timeout_minutes, require_reauth_destructive",
    )
    .eq("slug", orgSlug)
    .maybeSingle();
  if (!org) notFound();

  await requireOrgAccess(org.id, "settings:manage");

  const [{ data: roles }, { count: memberCount }, { count: teamCount }] = await Promise.all([
    supabase
      .from("roles")
      .select("id, name, is_system")
      .eq("org_id", org.id)
      .order("name"),
    supabase
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id)
      .eq("is_active", true),
    supabase
      .from("teams")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id)
      .eq("is_archived", false),
  ]);

  // Ownership transfer (owners only): the viewer needs org:transfer_ownership,
  // which only the owner system role holds. Candidates are the other active
  // members of this org. Loaded here so the Ownership card can render
  // entirely client-side afterwards.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: myPermissions } = await supabase.rpc("user_permissions", {
    p_org_id: org.id,
    p_user_id: user?.id ?? "",
  });
  const canTransferOwnership = ((myPermissions ?? []) as string[]).includes(
    "org:transfer_ownership",
  );

  let transferCandidates: TransferCandidate[] = [];
  if (canTransferOwnership && user) {
    const { data: candidates } = await supabase
      .from("memberships")
      .select("id, profiles!inner(full_name), roles!inner(name)")
      .eq("org_id", org.id)
      .eq("is_active", true)
      .neq("user_id", user.id)
      .order("full_name", { foreignTable: "profiles", ascending: true });
    transferCandidates = (candidates ?? []).map((c) => ({
      membershipId: c.id,
      fullName:
        (c.profiles as unknown as { full_name: string | null })?.full_name ?? "Unknown member",
      roleName: (c.roles as unknown as { name: string })?.name ?? "Unknown",
    }));
  }

  const roleOptions = (roles ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    isSystem: r.is_system,
  }));
  const customRoleCount = roleOptions.filter((r) => !r.isSystem).length;

  const initial: SettingsInitial = {
    name: org.name,
    slug: org.slug,
    logo_url: org.logo_url,
    default_role_id: org.default_role_id ?? "",
    invite_policy: org.invite_policy,
    allowed_domains: org.allowed_domains ?? [],
    require_email_verification: org.require_email_verification,
    session_timeout_minutes:
      org.session_timeout_minutes === null ? "never" : String(org.session_timeout_minutes),
    require_reauth_destructive: org.require_reauth_destructive,
  };

  return (
    <SettingsForm
      orgId={org.id}
      orgSlug={org.slug}
      initial={initial}
      roleOptions={roleOptions}
      usage={{
        members: memberCount ?? 0,
        membersLimit: FREE_PLAN.limits.members,
        teams: teamCount ?? 0,
        teamsLimit: FREE_PLAN.limits.teams,
        customRoles: customRoleCount,
        customRolesLimit: FREE_PLAN.limits.customRoles,
        auditRetentionMonths: FREE_PLAN.limits.auditRetentionMonths,
      }}
      ownership={{
        canTransfer: canTransferOwnership,
        orgName: org.name,
        candidates: transferCandidates,
      }}
    />
  );
}
