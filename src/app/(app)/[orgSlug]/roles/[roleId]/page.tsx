import { Suspense } from "react";
import { notFound } from "next/navigation";

import { RoleCreatedToast } from "@/components/roles/role-created-toast";
import { RoleDetailClient } from "@/components/roles/role-detail-client";
import { requireOrgAccess } from "@/lib/permissions";
import { getOrgBySlug, getPermissionCatalog, hasOrgPermission } from "@/lib/roles/server";
import { assignRegisterNumbers, formatRegisterNo } from "@/lib/members/register";
import { createClient } from "@/lib/supabase/server";

/**
 * Role detail: header + PermissionMatrix (read-only for system roles with
 * "Clone to customize"; editable with a sticky review bar for custom
 * roles), members holding the role, and the danger zone.
 */
export default async function RoleDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; roleId: string }>;
}) {
  const { orgSlug, roleId } = await params;
  const org = await getOrgBySlug(orgSlug);
  await requireOrgAccess(org.id, "org:read");
  const supabase = await createClient();

  const { data: role } = await supabase
    .from("roles")
    .select("id, name, description, is_system, system_key")
    .eq("id", roleId)
    .eq("org_id", org.id)
    .maybeSingle();
  if (!role) notFound();

  const catalog = await getPermissionCatalog();

  const { data: rolePermissions } = await supabase
    .from("role_permissions")
    .select("permission_key")
    .eq("role_id", roleId);
  const { data: roleDenies } = await supabase
    .from("role_permission_denies")
    .select("permission_key")
    .eq("role_id", roleId);
  const initialDecisions = {
    allow: (rolePermissions ?? []).map((rp) => rp.permission_key),
    deny: (roleDenies ?? []).map((rd) => rd.permission_key),
  };

  // Register numbers are org-wide: position in the org's full membership
  // ordered by join date (the numbered civic register).
  const { data: orgMembershipRows } = await supabase
    .from("memberships")
    .select("id")
    .eq("org_id", org.id)
    .order("joined_at", { ascending: true });
  const registerByMembershipId = assignRegisterNumbers(
    (orgMembershipRows ?? []).map((m) => m.id),
  );
  // Members holding the role, oldest first.
  const { data: membershipRows } = await supabase
    .from("memberships")
    .select("id, user_id")
    .eq("org_id", org.id)
    .eq("role_id", roleId)
    .eq("is_active", true)
    .order("joined_at", { ascending: true });
  const activeMembers = membershipRows ?? [];

  let members: { membershipId: string; userId: string; name: string; title: string | null; registerNo: string }[] = [];
  if (activeMembers.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, title")
      .in(
        "id",
        activeMembers.map((m) => m.user_id),
      );
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
    members = activeMembers.map((m) => ({
      membershipId: m.id,
      userId: m.user_id,
      name: profileById.get(m.user_id)?.full_name || "Unnamed member",
      title: profileById.get(m.user_id)?.title ?? null,
      registerNo: formatRegisterNo(registerByMembershipId.get(m.id) ?? 0),
    }));
  }

  const canEdit = !role.is_system && (await hasOrgPermission(org.id, "roles:update"));
  const canDelete = !role.is_system && (await hasOrgPermission(org.id, "roles:delete"));

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <Suspense fallback={null}>
        <RoleCreatedToast roleName={role.name} />
      </Suspense>
      <RoleDetailClient
        role={{
          id: role.id,
          name: role.name,
          description: role.description,
          isSystem: role.is_system,
          systemKey: role.system_key,
        }}
        catalog={catalog}
        initialDecisions={initialDecisions}
        affectedMemberCount={activeMembers.length}
        members={members}
        canEdit={canEdit}
        canDelete={canDelete}
      />
    </div>
  );
}
