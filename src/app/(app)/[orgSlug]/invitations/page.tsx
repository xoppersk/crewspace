import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requireOrgAccess } from "@/lib/permissions";
import { getInvitePageData } from "@/lib/invitations/actions";
import { InvitationsManager } from "@/components/invitations/invitations-manager";
import { PermissionDenied } from "@/components/crew/permission-denied";

export const metadata: Metadata = { title: "Invitations" };

/**
 * /[orgSlug]/invitations — invitation management (APP-FLOW §3).
 * Server-fetches the full page payload (getInvitePageData asserts
 * members:read); the client manager owns tabs, dialogs, and the drawer.
 * The [orgSlug] layout already verified the viewer's active membership.
 *
 * The whole page is gated on `members:invite` or `invitations:manage`
 * (UI-DESIGN.md §2.14) — direct navigation without either renders the
 * PermissionDenied inline state (the nav item was already hidden).
 */
export default async function InvitationsPage({
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
  const canView =
    permissions.includes("members:invite") || permissions.includes("invitations:manage");

  if (!canView) {
    const { data: ownerMemberships } = await supabase
      .from("memberships")
      .select("user_id, roles!inner(system_key)")
      .eq("org_id", org.id)
      .eq("is_active", true)
      .eq("roles.system_key", "owner");
    const ownerIds = (ownerMemberships ?? []).map((m) => m.user_id);
    const { data: ownerProfiles } =
      ownerIds.length > 0
        ? await supabase.from("profiles").select("full_name").in("id", ownerIds)
        : { data: [] as { full_name: string }[] };
    const ownerNames = (ownerProfiles ?? []).map((p) => p.full_name).filter(Boolean).slice(0, 3);

    return (
      <PermissionDenied
        reason="Invitations are managed by owners, admins, and managers."
        askLine={
          ownerNames.length > 0
            ? `Ask ${ownerNames.join(", ")} (owner) for access.`
            : "Ask an organization owner for access."
        }
        backHref={`/${orgSlug}/dashboard`}
      />
    );
  }

  const data = await getInvitePageData(org.id);
  return <InvitationsManager initial={data} />;
}
