import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  deactivateScopeCount,
  getMembers,
  getPermissions,
  getRole,
  roleAllows,
  roleMembers,
} from "@/lib/api";
import {
  getActiveWorkspace,
  getMyPermissionKeys,
  loadActiveWorkspaceData,
} from "@/lib/data/server";
import { AppShell } from "@/components/Shell";
import { DeniedState } from "@/components/States";
import { RoleDetailClient } from "./RoleDetailClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await loadActiveWorkspaceData();
  const role = data ? getRole(data, id) : undefined;
  return {
    title: role ? `Crewspace — ${role.name} role` : "Crewspace — Roles",
  };
}

export default async function RoleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await loadActiveWorkspaceData();
  if (!data) {
    return <AppShell current="roles">{null}</AppShell>;
  }
  const role = getRole(data, id);
  if (!role) notFound();

  /* X-01 — the denied screen comes from the REAL permission check:
     the signed-in user lacks roles:update ("Edit role permissions"). */
  const ws = await getActiveWorkspace();
  const myKeys = ws ? await getMyPermissionKeys(ws.orgId) : [];
  if (!myKeys.includes("roles:update")) {
    const me = getMembers(data).find((m) => m.id === ws?.membershipId);
    const myRole = me ? getRole(data, me.roleId) : undefined;
    const owner = getMembers(data).find((m) => m.roleId === "owner");
    return (
      <AppShell current="roles">
        <DeniedState
          role={role}
          memberCount={roleMembers(data, id).length}
          yourRoleName={myRole?.name}
          yourAllows={myRole ? roleAllows(data, myRole) : undefined}
          ownerName={owner?.name}
        />
      </AppShell>
    );
  }

  const members = roleMembers(data, id);

  return (
    <AppShell current="roles">
      <div className="crumb">
        <Link href="/app/roles">Roles</Link>{" "}
        <span className="sep">/</span>{" "}
        {role.name}
      </div>
      <RoleDetailClient
        role={role}
        permissions={getPermissions(data)}
        groups={data.org.groups}
        members={members}
        teams={data.teams.map((t) => ({ id: t.id, name: t.name }))}
        baselineIds={data.org.baseline.allowedPermissionIds}
        scopeCount={deactivateScopeCount(data)}
      />
    </AppShell>
  );
}
