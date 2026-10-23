import type { Metadata } from "next";
import {
  customInheritCount,
  getMembers,
  getOrg,
  getPermission,
  getRoles,
  roleAllows,
} from "@/lib/api";
import { getActiveWorkspace, loadActiveWorkspaceData } from "@/lib/data/server";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/Shell";
import { SettingsClient, type SettingsData } from "./SettingsClient";

export const metadata: Metadata = { title: "Crewspace — Settings" };

/**
 * G-04 organization settings. Everything on this screen reads the
 * organizations row (settings live there — there is no org_settings
 * table): name, allowed domain, default role, per-seat price
 * (seat_price_cents) and session timeout. Saves go through the
 * updateOrgSettings server action (settings:manage-gated).
 */
export default async function OrgSettingsPage() {
  const data = await loadActiveWorkspaceData();
  if (!data) {
    return <AppShell current="settings">{null}</AppShell>;
  }
  const org = getOrg(data);
  const members = getMembers(data);
  const baselinePerm = getPermission(
    data,
    org.baseline.allowedPermissionIds[0]!,
  );

  /* Columns the Org view type doesn't carry. */
  const ws = await getActiveWorkspace();
  if (!ws) {
    return <AppShell current="settings">{null}</AppShell>;
  }
  const supabase = await createClient();
  const { data: orgRow } = await supabase
    .from("organizations")
    .select("default_role_id, session_timeout_minutes")
    .eq("id", ws.orgId)
    .maybeSingle();
  /* Loader role ids are system_key ?? uuid; default_role_id is a uuid,
     so resolve it through the roles table. */
  const { data: roleRows } = await supabase
    .from("roles")
    .select("id, system_key")
    .eq("org_id", ws.orgId);
  const defaultRoleRow = (roleRows ?? []).find(
    (r) => r.id === orgRow?.default_role_id,
  );
  const defaultRole = defaultRoleRow
    ? data.org.roles.find(
        (r) => r.id === (defaultRoleRow.system_key ?? defaultRoleRow.id),
      )
    : undefined;

  const settings: SettingsData = {
    orgName: org.name,
    domain: org.domain,
    domainVerified: org.domainVerified,
    defaultRoleId: defaultRole?.id ?? "member",
    defaultRoleOptions: data.org.roles.map((r) => ({
      id: r.id,
      name: r.name,
      allows: roleAllows(data, r),
    })),
    seatPrice: org.plan.pricePerSeat,
    sessionMinutes: orgRow?.session_timeout_minutes ?? 20160,
    guestCount: members.filter((m) => m.roleId === "guest").length,
    twoStepMissing: members.filter((m) => m.twoStep === false).length,
    baseline: {
      allowsCount: org.baseline.allowedPermissionIds.length,
      permissionId: baselinePerm.id,
      permissionName: baselinePerm.name,
      inheritCount: customInheritCount(data),
      customRoles: getRoles(data).filter((r) => r.type === "Custom").length,
    },
    /* Transfer candidates: active members holding the Product admin
       role (matched by name — custom roles have no system key). The
       designed 2-step filter can't be applied: 2-step state isn't
       stored per member. */
    productAdmins: members
      .filter(
        (m) =>
          m.status === "active" &&
          data.org.roles.find((r) => r.id === m.roleId)?.name ===
            "Product admin",
      )
      .map((m) => ({ id: m.id, name: m.name })),
  };

  return (
    <AppShell current="settings">
      <SettingsClient data={settings} />
    </AppShell>
  );
}
