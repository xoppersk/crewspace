import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { OrgProvider } from "./org-context";
import { OrgPresence } from "./presence-provider";
import { SetOrgNav } from "./_components/set-org-nav";
import { OrgCommandPalette } from "./_components/org-command-palette";

/**
 * Org-scoped layout: loads the org, the viewer's ACTIVE membership, and the
 * permission union once per request, then provides them via OrgContext so
 * pages don't re-fetch.
 *
 *   * unknown slug (or not a member — RLS hides it) → notFound()
 *   * signed in but no active membership in this org → notFound()
 *     (never confirm the org exists to a stranger — no org-enumeration)
 *   * signed in with no orgs at all → handled one level up: (app)/page.tsx
 *     redirects to /onboarding before ever landing here.
 */
export default async function OrgSlugLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const user = await requireUser(`/${orgSlug}`);
  const supabase = await createClient();

  // RLS: only active members can SELECT their org's row.
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, slug, logo_url")
    .eq("slug", orgSlug)
    .maybeSingle();
  if (!org) notFound();

  const { data: membership } = await supabase
    .from("memberships")
    .select("id, role_id, is_active")
    .eq("org_id", org.id)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!membership) notFound();

  const { data: role } = await supabase
    .from("roles")
    .select("name, system_key")
    .eq("id", membership.role_id)
    .single();

  // Union of permission keys for the viewer's role (DB function, 00003).
  const { data: permissionData, error } = await supabase.rpc("user_permissions", {
    p_org_id: org.id,
    p_user_id: user.id,
  });
  if (error) throw error;
  const permissions = (permissionData ?? []) as string[];

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <OrgProvider
      value={{
        org: { id: org.id, name: org.name, slug: org.slug, logo_url: org.logo_url },
        membership: {
          id: membership.id,
          role_id: membership.role_id,
          role_name: role?.name ?? "Unknown",
          role_system_key: role?.system_key ?? null,
          is_active: membership.is_active,
        },
        permissions,
        user,
      }}
    >
      <SetOrgNav slug={org.slug} permissions={permissions} />
      <OrgCommandPalette />
      <OrgPresence
        identity={{
          id: user.id,
          fullName: profile?.full_name ?? (user.email ?? "Someone"),
          avatarUrl: profile?.avatar_url ?? null,
        }}
      >
        {children}
      </OrgPresence>
    </OrgProvider>
  );
}
