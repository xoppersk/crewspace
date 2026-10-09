import type { Metadata } from "next";
import { headers } from "next/headers";

import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChangePasswordCard,
  DeleteAccountCard,
  InvitationList,
  OrganizationList,
  SessionsCard,
  type AccountInvitation,
  type AccountOrg,
} from "@/components/account/account-client";

export const metadata: Metadata = { title: "Account settings" };

/** Naive device label from the user agent for the "current session" row. */
function deviceLabel(userAgent: string | null): string {
  if (!userAgent) return "Unknown browser";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Chrome\//.test(userAgent)
      ? "Chrome"
      : /Safari\//.test(userAgent) && !/Chrome\//.test(userAgent)
        ? "Safari"
        : /Firefox\//.test(userAgent)
          ? "Firefox"
          : "Browser";
  const os = /Windows/.test(userAgent)
    ? "Windows"
    : /Mac OS X/.test(userAgent)
      ? "macOS"
      : /Android/.test(userAgent)
        ? "Android"
        : /iPhone|iPad/.test(userAgent)
          ? "iOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "Unknown OS";
  return `${browser} on ${os}`;
}

/**
 * Cross-org account page: profile summary, organization list (switch/leave),
 * pending invitations received (accept/decline), security (password, sessions),
 * and the danger zone (delete account with sole-owner guard).
 */
export default async function AccountPage() {
  const user = await requireUser("/account");
  const supabase = await createClient();
  const userAgent = (await headers()).get("user-agent");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, title")
    .eq("id", user.id)
    .single();

  const { data: memberships } = await supabase
    .from("memberships")
    .select("org_id, role_id, is_active, joined_at")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false });

  const orgIds = [...new Set((memberships ?? []).map((m) => m.org_id))];
  const roleIds = [...new Set((memberships ?? []).map((m) => m.role_id))];

  const [{ data: orgs }, { data: roles }] = await Promise.all([
    orgIds.length > 0
      ? supabase.from("organizations").select("id, name, slug, logo_url").in("id", orgIds)
      : Promise.resolve({ data: [] as { id: string; name: string; slug: string; logo_url: string | null }[] }),
    roleIds.length > 0
      ? supabase.from("roles").select("id, name, system_key").in("id", roleIds)
      : Promise.resolve({ data: [] as { id: string; name: string; system_key: string | null }[] }),
  ]);

  const orgById = new Map((orgs ?? []).map((o) => [o.id, o]));
  const roleById = new Map((roles ?? []).map((r) => [r.id, r]));

  // Member counts per org (best-effort: RLS narrows to what the viewer may see).
  const memberCounts = new Map<string, number>();
  await Promise.all(
    orgIds.map(async (orgId) => {
      const { count } = await supabase
        .from("memberships")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("is_active", true);
      if (count !== null) memberCounts.set(orgId, count);
    }),
  );

  // Sole-owner detection for the delete-account guard.
  const ownerRoleIds = new Map<string, string>(); // orgId -> owner role id
  if (orgIds.length > 0) {
    const { data: ownerRoles } = await supabase
      .from("roles")
      .select("id, org_id")
      .in("org_id", orgIds)
      .eq("system_key", "owner");
    for (const r of ownerRoles ?? []) ownerRoleIds.set(r.org_id, r.id);
  }
  const soleOwnerOrgs: string[] = [];
  await Promise.all(
    (memberships ?? [])
      .filter((m) => m.is_active && roleById.get(m.role_id)?.system_key === "owner")
      .map(async (m) => {
        const ownerRoleId = ownerRoleIds.get(m.org_id);
        if (!ownerRoleId) return;
        const { count } = await supabase
          .from("memberships")
          .select("id", { count: "exact", head: true })
          .eq("org_id", m.org_id)
          .eq("is_active", true)
          .eq("role_id", ownerRoleId);
        if (count === 1) {
          const org = orgById.get(m.org_id);
          if (org) soleOwnerOrgs.push(org.name);
        }
      }),
  );

  const accountOrgs: AccountOrg[] = (memberships ?? [])
    .map((m) => {
      const org = orgById.get(m.org_id);
      if (!org) return null;
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        logoUrl: org.logo_url,
        roleName: roleById.get(m.role_id)?.name ?? "—",
        memberCount: memberCounts.get(org.id) ?? null,
        isActive: m.is_active,
      };
    })
    .filter((o): o is AccountOrg => o !== null);

  // Pending invitations addressed to the viewer (best-effort: the RPC only
  // exists once migration 00010 is applied).
  let invitations: AccountInvitation[] = [];
  try {
    const { data } = await supabase.rpc("my_pending_invitations");
    invitations = (data ?? []).map((invite) => ({
      id: invite.id,
      orgName: invite.org_name,
      orgSlug: invite.org_slug,
      orgLogoUrl: invite.org_logo_url,
      roleName: invite.role_name,
      invitedByName: invite.invited_by_name,
      expiresAt: invite.expires_at,
      message: invite.message,
    }));
  } catch {
    invitations = [];
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Account settings</h1>
        <p className="text-muted-foreground">
          Your profile, your organizations, and your sign-in security.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>
            Edit your details from any organization&apos;s profile page.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="size-12">
            {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
            <AvatarFallback>
              {(profile?.full_name ?? user.email ?? "?").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="text-sm">
            <p className="font-medium">{profile?.full_name || "Not set"}</p>
            <p className="text-muted-foreground">{user.email}</p>
            {profile?.title ? <p className="text-muted-foreground">{profile.title}</p> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your organizations</CardTitle>
          <CardDescription>
            {accountOrgs.filter((o) => o.isActive).length} active
            {accountOrgs.some((o) => !o.isActive) ? " · some deactivated" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrganizationList orgs={accountOrgs} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending invitations</CardTitle>
          <CardDescription>Invitations sent to {user.email}.</CardDescription>
        </CardHeader>
        <CardContent>
          <InvitationList invitations={invitations} />
        </CardContent>
      </Card>

      <ChangePasswordCard />
      <SessionsCard deviceLabel={deviceLabel(userAgent)} />
      <DeleteAccountCard email={user.email ?? ""} soleOwnerOrgs={soleOwnerOrgs} />
    </div>
  );
}
