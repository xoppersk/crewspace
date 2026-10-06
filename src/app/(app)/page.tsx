import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Crewspace" };

/**
 * Smart redirect (APP-FLOW §1): the landing page for signed-in users.
 *   * has orgs → most recently joined org's dashboard
 *   * no orgs  → /onboarding (create org or join with an invite)
 *
 * The middleware guarantees a session before this runs; requireUser is the
 * defense-in-depth re-check.
 */
export default async function AppIndexPage() {
  const user = await requireUser("/");
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("memberships")
    .select("org_id, joined_at")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("joined_at", { ascending: false })
    .limit(1);

  const orgId = memberships?.[0]?.org_id;
  if (!orgId) {
    redirect("/onboarding");
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("slug")
    .eq("id", orgId)
    .single();

  redirect(org ? `/${org.slug}/dashboard` : "/onboarding");
}
