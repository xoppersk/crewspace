import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { ProfileForm, type ReceivedInvitation } from "@/components/profile/profile-form";

export const metadata: Metadata = { title: "My profile" };

/**
 * Own profile: edit details + avatar, change email (re-verification flow),
 * and the "My access" tab (role + effective permissions + invitations
 * received from other orgs).
 */
export default async function ProfilePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const user = await requireUser(`/${orgSlug}/profile`);
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, slug")
    .eq("slug", orgSlug)
    .maybeSingle();
  if (!org) notFound();

  const { data: membership } = await supabase
    .from("memberships")
    .select("role_id")
    .eq("org_id", org.id)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!membership) notFound();

  const [{ data: role }, { data: permissionData }, { data: profile }] = await Promise.all([
    supabase
      .from("roles")
      .select("name, description, is_system")
      .eq("id", membership.role_id)
      .single(),
    supabase.rpc("user_permissions", { p_org_id: org.id, p_user_id: user.id }),
    supabase
      .from("profiles")
      .select("full_name, title, bio, timezone, avatar_url")
      .eq("id", user.id)
      .single(),
  ]);

  // Best-effort: the RPC only exists once migration 00010 is applied, and
  // RLS can't show invites from orgs the viewer can't read.
  let receivedInvites: ReceivedInvitation[] = [];
  try {
    const { data } = await supabase.rpc("my_pending_invitations");
    receivedInvites = (data ?? []).map((invite) => ({
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
    receivedInvites = [];
  }

  return (
    <ProfileForm
      orgSlug={org.slug}
      userId={user.id}
      userEmail={user.email ?? ""}
      profile={{
        full_name: profile?.full_name ?? "",
        title: profile?.title ?? "",
        bio: profile?.bio ?? "",
        timezone: profile?.timezone ?? "UTC",
        avatar_url: profile?.avatar_url ?? null,
      }}
      role={{
        name: role?.name ?? "Unknown",
        description: role?.description ?? null,
        isSystem: role?.is_system ?? false,
      }}
      permissions={(permissionData ?? []) as string[]}
      receivedInvites={receivedInvites}
    />
  );
}
