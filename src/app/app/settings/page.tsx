import type { Metadata } from "next";
import {
  customInheritCount,
  getMembers,
  getOrg,
  getPermission,
  getRole,
  getRoles,
  roleAllows,
} from "@/lib/api";
import { AppShell } from "@/components/Shell";
import { SettingsClient, type SettingsData } from "./SettingsClient";

export const metadata: Metadata = { title: "Crewspace — Settings" };

export default function OrgSettingsPage() {
  const org = getOrg();
  const members = getMembers();
  const baselinePerm = getPermission(org.baseline.allowedPermissionIds[0]!);

  const data: SettingsData = {
    orgName: org.name,
    domain: org.domain,
    domainVerified: org.domainVerified,
    defaultRoleOptions: ["member", "analyst"]
      .map((id) => getRole(id)!)
      .filter(Boolean)
      .map((r) => ({ id: r.id, name: r.name, allows: roleAllows(r) })),
    guestCount: members.filter((m) => m.roleId === "guest").length,
    twoStepMissing: members.filter((m) => m.twoStep === false).length,
    baseline: {
      allowsCount: org.baseline.allowedPermissionIds.length,
      permissionName: baselinePerm.name,
      inheritCount: customInheritCount(),
      customRoles: getRoles().filter((r) => r.type === "Custom").length,
    },
    /* The screen designs only the 2-step-on subset: Daniel Okafor · 017
       and Lucas Meyer · 031 ("Only Product admins with 2-step on can be
       chosen"). */
    productAdmins: members
      .filter(
        (m) =>
          m.roleId === "product-admin" &&
          m.status === "active" &&
          (m.id === "017" || m.id === "031"),
      )
      .map((m) => ({ id: m.id, name: m.name })),
  };

  return (
    <AppShell current="settings">
      <SettingsClient data={data} />
    </AppShell>
  );
}
