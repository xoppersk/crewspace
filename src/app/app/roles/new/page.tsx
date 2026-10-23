import type { Metadata } from "next";
import Link from "next/link";
import { getPermissions, getRoles } from "@/lib/api";
import {
  getActiveWorkspace,
  getMyPermissionKeys,
  loadActiveWorkspaceData,
} from "@/lib/data/server";
import { AppShell } from "@/components/Shell";
import { RoleWizard } from "./RoleWizard";

export const metadata: Metadata = { title: "Crewspace — New role" };

/**
 * R-05 Role wizard (real): name the role, copy an existing role's
 * register as the starting point, adjust permissions, review, create.
 * Creation goes through the createRole server action (roles:create is
 * re-checked server-side; grants/denies are written per Worker S's
 * translation; an audit entry is appended). Supports ?from=<roleId>
 * (the role page's Duplicate).
 */
export default async function RoleWizardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const data = await loadActiveWorkspaceData();
  if (!data) {
    return <AppShell current="roles">{null}</AppShell>;
  }
  const { from } = await searchParams;
  const ws = await getActiveWorkspace();
  const myKeys = ws ? await getMyPermissionKeys(ws.orgId) : [];
  const canCreate = myKeys.includes("roles:create");
  const roles = getRoles(data);

  return (
    <AppShell current="roles">
      <div className="wz-toprow">
        <span className="flow">New role</span>
        <Link href="/app/roles">Cancel and go back to roles</Link>
      </div>
      {canCreate ? (
        <RoleWizard
          roles={roles}
          permissions={getPermissions(data)}
          groups={data.org.groups}
          baselineIds={data.org.baseline.allowedPermissionIds}
          initialCopyFrom={
            from && roles.some((r) => r.id === from)
              ? from
              : (roles.find((r) => r.id === "member")?.id ?? roles[0]?.id ?? "")
          }
        />
      ) : (
        <section className="card" style={{ padding: 24 }}>
          <h1 className="stitle">You can’t create roles</h1>
          <p style={{ fontSize: 14.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
            Creating a role needs the permission{" "}
            <b>Create custom roles</b>, which your role doesn’t have. Ask
            someone whose role allows it — the register on the Roles page
            shows who can.
          </p>
        </section>
      )}
    </AppShell>
  );
}
