import Link from "next/link";
import { ChevronRight, Plus, ShieldCheck, Users } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DeleteRoleButton } from "@/components/roles/delete-role-button";
import { RoleBadge } from "@/components/roles/role-badge";
import { requireOrgAccess } from "@/lib/permissions";
import { getOrgBySlug, hasOrgPermission } from "@/lib/roles/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Roles list: system roles (read-only, "System" badge) + custom roles
 * (permission-count summary, edit/delete). Every row shows "Used by n
 * members". The "New role" button is gated by roles:create (server-side).
 */
export default async function RolesPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  await requireOrgAccess(org.id, "org:read");
  const supabase = await createClient();

  const { data: roles } = await supabase
    .from("roles")
    .select("id, name, description, is_system, system_key")
    .eq("org_id", org.id)
    .order("is_system", { ascending: false })
    .order("name");

  const roleIds = (roles ?? []).map((r) => r.id);

  const { data: memberships } = await supabase
    .from("memberships")
    .select("role_id")
    .eq("org_id", org.id)
    .eq("is_active", true);
  const memberCountByRole = new Map<string, number>();
  for (const m of memberships ?? []) {
    memberCountByRole.set(m.role_id, (memberCountByRole.get(m.role_id) ?? 0) + 1);
  }

  const permissionCountByRole = new Map<string, number>();
  if (roleIds.length > 0) {
    const { data: rolePermissions } = await supabase
      .from("role_permissions")
      .select("role_id")
      .in("role_id", roleIds);
    for (const rp of rolePermissions ?? []) {
      permissionCountByRole.set(rp.role_id, (permissionCountByRole.get(rp.role_id) ?? 0) + 1);
    }
  }

  const canCreate = await hasOrgPermission(org.id, "roles:create");
  const canDelete = await hasOrgPermission(org.id, "roles:delete");

  const systemRoles = (roles ?? []).filter((r) => r.is_system);
  const customRoles = (roles ?? []).filter((r) => !r.is_system);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Roles</h1>
          <p className="text-sm text-muted-foreground">
            Who can do what. System roles are locked — clone one to make your own.
          </p>
        </div>
        {canCreate ? (
          <Button asChild>
            <Link href={`/${orgSlug}/roles/new`}>
              <Plus className="size-4" /> New role
            </Link>
          </Button>
        ) : null}
      </div>

      {/* System roles */}
      <section aria-label="System roles" className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold tracking-tight">System roles</h2>
        <Card>
          <CardContent className="divide-y p-0">
            {systemRoles.map((role) => (
              <RoleRow
                key={role.id}
                orgSlug={orgSlug}
                roleId={role.id}
                name={role.name}
                description={role.description}
                systemKey={role.system_key}
                memberCount={memberCountByRole.get(role.id) ?? 0}
                permissionCount={permissionCountByRole.get(role.id) ?? 0}
                isSystem
              />
            ))}
          </CardContent>
        </Card>
      </section>

      {/* Custom roles */}
      <section aria-label="Custom roles" className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold tracking-tight">Custom roles</h2>
        {customRoles.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No custom roles"
            description="Create one for a real job title — pick exactly the permissions it needs."
            action={
              canCreate ? (
                <Button asChild>
                  <Link href={`/${orgSlug}/roles/new`}>
                    <Plus className="size-4" /> New role
                  </Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Card>
            <CardContent className="divide-y p-0">
              {customRoles.map((role) => (
                <RoleRow
                  key={role.id}
                  orgSlug={orgSlug}
                  roleId={role.id}
                  name={role.name}
                  description={role.description}
                  systemKey={role.system_key}
                  memberCount={memberCountByRole.get(role.id) ?? 0}
                  permissionCount={permissionCountByRole.get(role.id) ?? 0}
                  isSystem={false}
                  canDelete={canDelete}
                />
              ))}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

function RoleRow({
  orgSlug,
  roleId,
  name,
  description,
  systemKey,
  memberCount,
  permissionCount,
  isSystem,
  canDelete = false,
}: {
  orgSlug: string;
  roleId: string;
  name: string;
  description: string | null;
  systemKey: string | null;
  memberCount: number;
  permissionCount: number;
  isSystem: boolean;
  canDelete?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
      <Link
        href={`/${orgSlug}/roles/${roleId}`}
        className="flex min-w-0 flex-1 items-center gap-3"
        aria-label={`View ${name} role`}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <RoleBadge roleName={name} systemKey={systemKey} />
            {isSystem ? (
              <Badge variant="secondary" className="text-[11px]">
                System
              </Badge>
            ) : null}
          </span>
          <span className="truncate text-sm font-medium">{name}</span>
          {description ? (
            <span className="truncate text-xs text-muted-foreground">{description}</span>
          ) : null}
          <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" aria-hidden />
              Used by {memberCount} member{memberCount === 1 ? "" : "s"}
            </span>
            <span>
              {permissionCount} permission{permissionCount === 1 ? "" : "s"}
            </span>
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
      {!isSystem && canDelete ? (
        <DeleteRoleButton roleId={roleId} roleName={name} />
      ) : null}
    </div>
  );
}
