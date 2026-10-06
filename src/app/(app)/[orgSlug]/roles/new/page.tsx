import { requireOrgAccess } from "@/lib/permissions";
import { RoleWizard } from "@/components/roles/role-wizard";
import { getOrgBySlug, getPermissionCatalog, hasOrgPermission } from "@/lib/roles/server";
import { createClient } from "@/lib/supabase/server";

/**
 * New-role wizard page. Gated by roles:create at the page level (the nav
 * also hides it). Loads the system roles as "start from" templates with
 * their permission keys, plus the active member list for the optional
 * assign step (only when the viewer also holds roles:assign).
 */
export default async function NewRolePage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ clone?: string }>;
}) {
  const { orgSlug } = await params;
  const { clone } = await searchParams;
  const org = await getOrgBySlug(orgSlug);
  const { user } = await requireOrgAccess(org.id, "roles:create");
  const supabase = await createClient();

  const { data: systemRoles } = await supabase
    .from("roles")
    .select("id, name, description, system_key")
    .eq("org_id", org.id)
    .eq("is_system", true)
    .order("name");

  const systemRoleIds = (systemRoles ?? []).map((r) => r.id);
  const keysByRole = new Map<string, string[]>();
  if (systemRoleIds.length > 0) {
    const { data: rolePermissions } = await supabase
      .from("role_permissions")
      .select("role_id, permission_key")
      .in("role_id", systemRoleIds);
    for (const rp of rolePermissions ?? []) {
      const list = keysByRole.get(rp.role_id) ?? [];
      list.push(rp.permission_key);
      keysByRole.set(rp.role_id, list);
    }
  }

  const catalog = await getPermissionCatalog();

  const canAssign = await hasOrgPermission(org.id, "roles:assign");
  let members: { membershipId: string; name: string }[] = [];
  if (canAssign) {
    const { data: membershipRows } = await supabase
      .from("memberships")
      .select("id, user_id")
      .eq("org_id", org.id)
      .eq("is_active", true)
      .neq("user_id", user.id);
    if (membershipRows && membershipRows.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in(
          "id",
          membershipRows.map((m) => m.user_id),
        );
      const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
      members = membershipRows.map((m) => ({
        membershipId: m.id,
        name: nameById.get(m.user_id) || "Unnamed member",
      }));
    }
  }

  const cloneFromId =
    clone && systemRoleIds.includes(clone) ? clone : undefined;

  return (
    <RoleWizard
      systemRoles={(systemRoles ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        systemKey: r.system_key,
        keys: keysByRole.get(r.id) ?? [],
      }))}
      catalog={catalog}
      members={members}
      canAssign={canAssign}
      cloneFromId={cloneFromId}
    />
  );
}
