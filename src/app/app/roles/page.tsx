import type { Metadata } from "next";
import Link from "next/link";
import {
  customInheritCount,
  getMembers,
  getOrg,
  getPermission,
  getRole,
  getRoles,
  roleMemberCount,
} from "@/lib/api";
import type { Role } from "@/lib/types";
import { AppShell } from "@/components/Shell";
import { ButtonLink } from "@/components/Button";
import { PermissionStrip } from "@/components/PermissionStrip";

/**
 * R-03 Roles (screens/Roles.html).
 * Row order follows the screen: most access first. The short list
 * summaries and the short "last change" dates are the screen's exact
 * copy — the fixture `summary` / `lastChanged` strings are longer (and
 * a few dates differ), so the screen strings live here.
 */
export const metadata: Metadata = { title: "Crewspace — Roles" };

const ROW_ORDER = [
  "owner",
  "product-admin",
  "support-lead",
  "billing-admin",
  "analyst",
  "auditor",
  "finance-viewer",
  "member",
  "guest",
];

const LIST_SUMMARY: Record<string, string> = {
  owner: "Everything, including transferring ownership.",
  "product-admin":
    "Runs the product workspace: people, roles, teams. 2 changes waiting for review.",
  "support-lead":
    "Helps members with profiles, invitations and lost sessions.",
  "billing-admin": "Owns the plan, seats and payment.",
  analyst: "Reads the audit log and billing for reporting.",
  auditor: "Reads and exports the audit archive. Nothing else.",
  "finance-viewer": "Sees billing and invoices.",
  member: "Uses the workspace; sees the directory and their own access.",
  guest: "Sees only the teams they’re added to. Can’t see the directory.",
};

const LIST_LAST_CHANGE: Record<string, string> = {
  owner: "—",
  "product-admin": "Oct 2",
  "support-lead": "Sep 24",
  "billing-admin": "Aug 30",
  analyst: "Sep 18",
  auditor: "Jul 7",
  "finance-viewer": "Jun 12",
  member: "—",
  guest: "—",
};

const ROW_GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0,1.5fr) 84px 78px 230px 110px",
  gap: 18,
  alignItems: "center",
  padding: "13px 24px",
  borderTop: "1px solid var(--rule)",
  fontSize: 14,
  color: "var(--ink)",
  textDecoration: "none",
};

function RoleRow({ role }: { role: Role }) {
  const highlighted = role.id === "product-admin";
  return (
    <Link
      role="row"
      href={`/app/roles/${role.id}`}
      style={{
        ...ROW_GRID,
        ...(highlighted ? { background: "var(--sheet-tint)" } : {}),
      }}
    >
      <span role="cell">
        <b style={{ fontWeight: 600 }}>{role.name}</b>{" "}
        <span
          className="mono"
          style={{ fontSize: 12, color: "var(--muted)" }}
        >
          {role.regNumber}
        </span>
        <small
          style={{
            display: "block",
            fontSize: 12,
            color: "var(--muted)",
            marginTop: 2,
            lineHeight: 1.4,
          }}
        >
          {LIST_SUMMARY[role.id] ?? role.summary}
        </small>
      </span>
      <span
        role="cell"
        style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)" }}
      >
        {role.type}
      </span>
      <span role="cell" className="mono">
        {roleMemberCount(role.id)}
      </span>
      <span role="cell">
        <PermissionStrip role={role} />
      </span>
      <span role="cell" style={{ color: "var(--ink-2)" }}>
        {LIST_LAST_CHANGE[role.id] ?? role.lastChanged}
      </span>
    </Link>
  );
}

export default function RolesPage() {
  const org = getOrg();
  const roles = getRoles();
  const ordered = ROW_ORDER.map((id) => getRole(id)!).filter(Boolean);
  const systemCount = roles.filter((r) => r.type === "System").length;
  const customCount = roles.filter((r) => r.type === "Custom").length;
  const memberCount = getMembers().length;
  const baselineNames = org.baseline.allowedPermissionIds.map(
    (id) => getPermission(id).name,
  );

  return (
    <AppShell current="roles">
      <div className="page-head">
        <div className="stack">
          <h1 className="title">Roles</h1>
          <p className="lead" style={{ maxWidth: "50em" }}>
            {roles.length} roles cover all {memberCount} members:{" "}
            {systemCount} system roles that can’t be edited, and{" "}
            {customCount} custom roles built on the organization baseline.
            Each person has exactly one role.
          </p>
        </div>
        <div className="head-actions">
          <ButtonLink href="#">Compare two roles</ButtonLink>
          <ButtonLink variant="pri" href="/app/roles/new">
            New role
          </ButtonLink>
        </div>
      </div>

      <div className="cols">
        <section className="sheet main-sheet" style={{ flexBasis: 640 }}>
          <div className="rows-scroll">
            <div role="table" aria-label="Roles" style={{ minWidth: 760 }}>
              <div
                role="row"
                style={{
                  ...ROW_GRID,
                  paddingTop: 10,
                  paddingBottom: 10,
                  fontSize: 12,
                  color: "var(--muted)",
                  borderTop: 0,
                }}
              >
                <span role="columnheader">Role</span>
                <span role="columnheader">Type</span>
                <span role="columnheader">Members</span>
                <span role="columnheader">Allows, of 18</span>
                <span role="columnheader">Last change</span>
              </div>
              {ordered.map((role) => (
                <RoleRow key={role.id} role={role} />
              ))}
            </div>
          </div>
          <div
            style={{
              padding: "12px 24px",
              borderTop: "1px solid var(--rule-strong)",
              display: "flex",
              flexWrap: "wrap",
              gap: "6px 18px",
              fontSize: 12,
              color: "var(--muted)",
            }}
          >
            <span>
              Strip order: People 1–3 · Access 4–6 · Teams 7–8 · Invitations
              9–10 · Security 11–12 · Governance 13–14 · Billing 15–16 ·
              Organization 17–18
            </span>
            <span>
              <i
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: "var(--seal)",
                  verticalAlign: -1,
                }}
              />{" "}
              allowed{" "}
              <i
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: "var(--fill)",
                  verticalAlign: -1,
                }}
              />{" "}
              blocked
            </span>
          </div>
        </section>

        <aside className="side-col">
          <section
            className="sheet panel-box"
            aria-labelledby="bl"
            style={{ gap: 10, fontSize: 13, lineHeight: 1.5 }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 8,
              }}
            >
              <h2 id="bl" className="panel">
                Organization baseline
              </h2>
              <a href="#" style={{ fontSize: 13 }}>
                Edit
              </a>
            </div>
            <span style={{ color: "var(--ink-2)" }}>
              What every{" "}
              <b style={{ fontWeight: 600, color: "var(--ink)" }}>Inherit</b>{" "}
              setting resolves to. It allows{" "}
              {org.baseline.allowedPermissionIds.length} of 18:{" "}
              <b style={{ fontWeight: 600, color: "var(--ink)" }}>
                {baselineNames.join(", ")}
              </b>
              . Everything else is blocked.
            </span>
            <div
              style={{
                paddingTop: 8,
                borderTop: "1px solid var(--rule)",
              }}
            >
              <div className="ll">
                <span>Settings set to Inherit</span>
                <i />
                <span className="mono">{customInheritCount()}</span>
              </div>
              <div className="ll">
                <span>Custom roles affected by a baseline change</span>
                <i />
                <span className="mono">{customCount}</span>
              </div>
              <div className="ll">
                <span>Last changed</span>
                <i />
                <span>Aug 14 · Sheku</span>
              </div>
            </div>
          </section>

          <section
            style={{
              padding: "4px 4px 0",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              fontSize: 13,
              lineHeight: 1.5,
              color: "var(--ink-2)",
            }}
          >
            <h2
              style={{
                margin: 0,
                font: "600 13px/1.3 var(--font-sans)",
                color: "var(--muted)",
              }}
            >
              How roles work here
            </h2>
            <span>
              System roles are fixed. To adjust one, duplicate it into a
              custom role.
            </span>
            <span>
              A role change takes effect on the person’s next page load and
              is written to the audit log with before and after.
            </span>
            <span>
              Only the owner can apply changes to what a role allows.
            </span>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
