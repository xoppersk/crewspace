import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import type { OrgSwitcherOrg } from "@/components/org-switcher";
import { AppShell } from "./_components/app-shell";
import { ShellProvider } from "./_components/shell-context";

export const metadata: Metadata = { title: "Crewspace" };

/**
 * Authenticated routes are per-user and per-request: navigations into (app)
 * are allowed to block on the session/profile read instead of prerendering.
 * (Next 16 validates instant navigations by default; instant = false opts the
 * whole (app) segment out of that validation.)
 */
export const instant = false;

/**
 * Authenticated app shell. The middleware already redirects signed-out
 * visitors to /sign-in?next=..., but the layout re-checks (defense in depth)
 * and loads the org list for the org switcher + the profile for the header.
 */
export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) {
    redirect("/sign-in?next=/");
  }

  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .single();

  // Active memberships → orgs (two queries; RLS narrows both to the caller).
  const { data: memberships } = await supabase
    .from("memberships")
    .select("org_id, role_id")
    .eq("user_id", user.id)
    .eq("is_active", true);

  const orgIds = (memberships ?? []).map((m) => m.org_id);
  const roleIds = (memberships ?? []).map((m) => m.role_id);

  const [{ data: orgs }, { data: roles }] = await Promise.all([
    orgIds.length > 0
      ? supabase.from("organizations").select("id, name, slug, logo_url").in("id", orgIds)
      : Promise.resolve({ data: [] as { id: string; name: string; slug: string; logo_url: string | null }[] }),
    roleIds.length > 0
      ? supabase.from("roles").select("id, name").in("id", roleIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const roleById = new Map((roles ?? []).map((r) => [r.id, r.name]));
  const orgById = new Map((orgs ?? []).map((o) => [o.id, o]));

  const switcherOrgs: OrgSwitcherOrg[] = [];
  for (const m of memberships ?? []) {
    const org = orgById.get(m.org_id);
    if (!org) continue;
    switcherOrgs.push({
      id: org.id,
      name: org.name,
      slug: org.slug,
      logo_url: org.logo_url,
      role_name: roleById.get(m.role_id),
    });
  }
  switcherOrgs.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <ShellProvider>
      <AppShell
        orgs={switcherOrgs}
        email={user.email}
        displayName={profile?.full_name ?? null}
        avatarUrl={profile?.avatar_url ?? null}
      >
        {children}
      </AppShell>
    </ShellProvider>
  );
}
