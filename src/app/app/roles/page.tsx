import type { Metadata } from "next";
import Link from "next/link";
import {
  customInheritCount,
  getMembers,
  getPermission,
  getPermissions,
  getRoles,
  roleAllows,
  roleMemberCount,
  type WorkspaceData,
} from "@/lib/api";
import { loadActiveWorkspaceData } from "@/lib/data/server";
import type { Role } from "@/lib/types";
import { AppShell } from "@/components/Shell";
import { ButtonLink } from "@/components/Button";
import { PermissionStrip } from "@/components/PermissionStrip";
import { IconDocument, IconLock, IconShieldCheck } from "@/components/icons";

/**
 * R-03 Roles (screens/Roles.html): uppercase table band, 16px strip
 * cells with a separate mono count, type chips, and the DARK baseline
 * panel with its #2C3442 / --panel-allow strip. Row order, summaries
 * and last-change strings are the screen's exact copy.
 */
export const metadata: Metadata = { title: "Crewspace — Roles" };



const ROW_GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0,1.5fr) 92px 64px 240px 76px",
  gap: 18,
  alignItems: "center",
  padding: "14px 22px",
  borderTop: "1px solid var(--rule)",
  fontSize: 14,
  color: "var(--ink)",
  textDecoration: "none",
};

const HEAD_GRID: React.CSSProperties = {
  ...ROW_GRID,
  paddingTop: 12,
  paddingBottom: 12,
  borderTop: 0,
  background: "var(--sheet-sunk)",
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--ink-2)",
};

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

function RoleRow({ data, role }: { data: WorkspaceData; role: Role }) {
  const highlighted = (role.pendingChanges?.length ?? 0) > 0;
  const zero = roleAllows(data, role) === 0;
  return (
    <Link
      role="row"
      href={`/app/roles/${role.id}`}
      className={highlighted ? "roles-row-hl" : undefined}
      style={ROW_GRID}
    >
      <span role="cell">
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <b style={{ fontWeight: 600, fontSize: 14.5 }}>{role.name}</b>
          <span className="rno sm">{role.regNumber}</span>
        </span>
        <small
          style={{
            display: "block",
            fontSize: 12.5,
            color: "var(--muted)",
            marginTop: 4,
            lineHeight: 1.4,
          }}
        >
          {role.summary}
        </small>
      </span>
      <span role="cell">
        <span
          className={`type-chip${role.type === "System" ? " system" : ""}`}
        >
          {role.type === "System" ? <IconLock /> : null}
          {role.type}
        </span>
      </span>
      <span role="cell" className="mono">
        {roleMemberCount(data, role.id)}
      </span>
      <span role="cell" className={zero ? "strip-zero" : undefined}>
        <PermissionStrip role={role} permissions={data.org.permissions} baselineIds={data.org.baseline.allowedPermissionIds} />
      </span>
      <span role="cell" style={{ color: "var(--ink-2)" }}>
        {role.lastChanged}
      </span>
    </Link>
  );
}

export default async function RolesPage() {
  const data = await loadActiveWorkspaceData();
  if (!data) {
    return <AppShell current="roles">{null}</AppShell>;
  }
  const org = data.org;
  const roles = getRoles(data);
  const ordered = roles;
  const systemCount = roles.filter((r) => r.type === "System").length;
  const customCount = roles.filter((r) => r.type === "Custom").length;
  const memberCount = getMembers(data).length;
  const baselineIds = org.baseline.allowedPermissionIds;
  const baselineNames = baselineIds.map((id) => getPermission(data, id).name);
  const permissions = getPermissions(data);

  return (
    <AppShell current="roles">
      <header className="spage-head">
        <div className="stack">
          <h1 className="stitle">Roles</h1>
          <p className="sled" style={{ maxWidth: 680 }}>
            {roles.length} roles cover all {memberCount} members:{" "}
            {systemCount} system roles that can’t be edited, and{" "}
            {customCount} custom roles built on the organization baseline.
            Each person has exactly one role.
          </p>
        </div>
        <div className="head-actions">
          <ButtonLink variant="pri" href="/app/roles/new">
            <PlusIcon />
            New role
          </ButtonLink>
        </div>
      </header>

      <div className="split-320">
        <section className="card" style={{ minWidth: 0, overflow: "hidden" }}>
          <div className="rows-scroll">
            <div
              role="table"
              aria-label="Roles"
              className="roles-table"
              style={{ minWidth: 820 }}
            >
              <div role="row" style={HEAD_GRID}>
                <span role="columnheader">Role</span>
                <span role="columnheader">Type</span>
                <span role="columnheader">Members</span>
                <span role="columnheader">Allows, of 18</span>
                <span role="columnheader">Last change</span>
              </div>
              {ordered.map((role) => (
                <RoleRow key={role.id} data={data} role={role} />
              ))}
            </div>
          </div>
          <div className="roles-foot">
            <span className="order">
              Strip order: People 1–3 · Access 4–6 · Governance 7–8 · Teams
              9–10 · Invitations 11–12 · Security 13–14 · Billing 15–16 ·
              Organization 17–18
            </span>
            <span className="legend">
              <span>
                <i className="on" />
                allowed
              </span>
              <span>
                <i />
                blocked
              </span>
            </span>
          </div>
        </section>

        <aside className="aside-sticky" style={{ position: "static" }}>
          <section className="dpanel" aria-labelledby="bl" style={{ gap: 14 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 8,
              }}
            >
              <h2 id="bl">Organization baseline</h2>
              <a href="/app/settings" className="edit-link">
                Edit
              </a>
            </div>
            <span style={{ color: "var(--panel-muted)", fontSize: 13, lineHeight: 1.5 }}>
              What every{" "}
              <b style={{ fontWeight: 600, color: "#fff" }}>Inherit</b>{" "}
              setting resolves to. It allows {baselineIds.length} of 18:{" "}
              <b style={{ fontWeight: 600, color: "#fff" }}>
                {baselineNames.join(", ")}
              </b>
              . Everything else is blocked.
            </span>
            <span
              className="baseline-strip"
              role="img"
              aria-label={`Baseline allows permission${baselineIds.length > 1 ? "s" : ""} ${baselineIds.join(", ")} of 18`}
            >
              {permissions.map((p) => (
                <i
                  key={p.id}
                  className={baselineIds.includes(p.id) ? "on" : undefined}
                />
              ))}
            </span>
            <dl className="baseline-dl">
              <dt>Settings set to Inherit</dt>
              <dd className="mono">{customInheritCount(data)}</dd>
              <dt>Custom roles affected by a baseline change</dt>
              <dd className="mono">{customCount}</dd>
            </dl>
          </section>

          <section
            className="card"
            style={{
              padding: 18,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              fontSize: 13,
              lineHeight: 1.5,
              color: "var(--ink-2)",
            }}
          >
            <h2
              style={{
                margin: 0,
                font: "700 15px/1.3 var(--font-sans)",
                color: "var(--ink)",
              }}
            >
              How roles work here
            </h2>
            <span className="how-row">
              <span className="dot">
                <IconLock />
              </span>
              <span>
                System roles are fixed. To adjust one, duplicate it into a
                custom role.
              </span>
            </span>
            <span className="how-row">
              <span className="dot ok">
                <IconDocument />
              </span>
              <span>
                A role change takes effect on the person’s next page load and
                is written to the audit log with before and after.
              </span>
            </span>
            <span className="how-row">
              <span className="dot ok">
                <IconShieldCheck />
              </span>
              <span>Only the owner can apply changes to what a role allows.</span>
            </span>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
