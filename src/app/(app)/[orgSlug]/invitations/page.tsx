import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getInvitePageData } from "@/lib/invitations/actions";
import { InvitationsManager } from "@/components/invitations/invitations-manager";

export const metadata: Metadata = { title: "Invitations" };

/**
 * /[orgSlug]/invitations — invitation management (APP-FLOW §3).
 * Server-fetches the full page payload (getInvitePageData asserts
 * members:read); the client manager owns tabs, dialogs, and the drawer.
 * The [orgSlug] layout already verified the viewer's active membership.
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

  const data = await getInvitePageData(org.id);
  return <InvitationsManager initial={data} />;
}
