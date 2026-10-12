import type { Metadata } from "next";
import {
  deactivateScopeCount,
  getMember,
  getPermission,
  getRole,
  getRoles,
  roleAllows,
  roleMemberCount,
} from "@/lib/api";
import type { Role, Setting } from "@/lib/types";
import { FocusedShell } from "@/components/Shell";
import { ButtonLink } from "@/components/Button";
import { PermissionStrip } from "@/components/PermissionStrip";
import { WizardSteps } from "@/components/WizardSteps";

/**
 * R-05 Role wizard, step 3 of 3 (screens/RoleWizard.html):
 * "Weekend support", copied from Support lead, reviewed before create.
 * The three changes, the assignees and their gains/losses are the
 * screen's copy; counts come from the fixture API. The wizard's
 * resulting strip is a synthetic role: Support lead's settings with
 * the 3 changes applied (allows 3 of 18).
 */
export const metadata: Metadata = { title: "Crewspace — New role: review" };

const CHANGES: {
  permissionId: number;
  from: Setting;
  to: Setting;
  meaning: string;
}[] = [
  {
    permissionId: 2,
    from: "deny",
    to: "allow",
    meaning: `Can suspend ${deactivateScopeCount()} people: everyone except the owner and Product admins.`,
  },
  {
    permissionId: 3,
    from: "inherit",
    to: "deny",
    meaning: "Blocked, even though the baseline allows it.",
  },
  {
    permissionId: 9,
    from: "allow",
    to: "deny",
    meaning: "Invitations wait for a Support lead on Monday.",
  },
];

const ASSIGNEES: { memberId: string; effect: string }[] = [
  {
    memberId: "027",
    effect:
      "Gains Deactivate members. Loses Edit member profiles and Resend or revoke invitations.",
  },
  {
    memberId: "034",
    effect: "Gains all 3. First time with any admin permission.",
  },
];

function SettingChip({ setting }: { setting: Setting }) {
  const label =
    setting === "allow"
      ? "Allow"
      : setting === "deny"
        ? "Deny"
        : setting === "inherit"
          ? "Inherit"
          : "Owner only";
  const style: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    height: 24,
    padding: "0 8px",
    borderRadius: "var(--radius-s)",
    fontSize: 12,
    fontWeight: 600,
  };
  if (setting === "allow") {
    return (
      <span style={{ ...style, background: "var(--seal)", color: "var(--on-seal)" }}>
        {label}
      </span>
    );
  }
  if (setting === "deny") {
    return (
      <span
        style={{
          ...style,
          color: "var(--deny)",
          boxShadow: "inset 0 0 0 1.5px var(--deny)",
        }}
      >
        {label}
      </span>
    );
  }
  return (
    <span style={{ ...style, background: "var(--fill)", color: "var(--ink-2)" }}>
      {label}
    </span>
  );
}

const DIFF_GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0,1.3fr) 150px minmax(0,1.2fr)",
  gap: 18,
  alignItems: "center",
  padding: "12px 24px",
  borderTop: "1px solid var(--rule)",
  fontSize: 14,
};

export default function RoleWizardPage() {
  const source = getRole("support-lead")!;
  const memberRole = getRole("member")!;

  const newSettings: Record<string, Setting> = { ...source.settings };
  for (const c of CHANGES) newSettings[String(c.permissionId)] = c.to;
  const weekendSupport: Role = {
    id: "weekend-support",
    regNumber: "R-10",
    name: "Weekend support",
    type: "Custom",
    summary:
      "Covers Saturday and Sunday support. Can suspend a compromised account; can’t change profiles or invitations.",
    settings: newSettings,
    lastChanged: "—",
    createdFrom: source.name,
  };
  const allowedNames = [2, 12, 13].map((id) => getPermission(id).name);

  const rolesNow = getRoles().length;
  const supportAfter = roleMemberCount("support-lead") - 1;
  const memberAfter = roleMemberCount("member") - 1;
  const firstNames = ASSIGNEES.map(
    (a) => getMember(a.memberId)!.name.split(" ")[0],
  ).join(" and ");

  return (
    <FocusedShell
      flowName="New role"
      cancelLabel="Cancel and go back to roles"
      cancelHref="/app/roles"
    >
      <WizardSteps
        steps={[
          { n: "1", name: "Start from", summary: source.name, state: "done" },
          {
            n: "2",
            name: "Permissions",
            summary: `${CHANGES.length} changed of 18`,
            state: "done",
          },
          { n: "3", name: "Review and assign", summary: "", state: "current" },
        ]}
      />

      <main
        style={{
          flex: "999 1 600px",
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 className="title">Review the new role</h1>
          <p className="lead">
            Nothing exists yet. Check what it allows, who gets it and what
            changes for them, then create it.
          </p>
        </div>

        <section
          className="sheet"
          style={{
            padding: "20px 24px",
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label
              htmlFor="nm"
              style={{ fontWeight: 600, fontSize: 13 }}
            >
              Name
            </label>
            <input
              id="nm"
              className="in"
              style={{ height: 40, width: "100%" }}
              defaultValue="Weekend support"
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>
              Register number
            </span>
            <span
              className="mono"
              style={{
                height: 40,
                display: "flex",
                alignItems: "center",
                color: "var(--ink-2)",
              }}
            >
              R-10{" "}
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 12,
                  color: "var(--muted)",
                  marginLeft: 8,
                }}
              >
                assigned on create
              </span>
            </span>
          </div>
          <div
            style={{
              gridColumn: "span 2",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <label
              htmlFor="ds"
              style={{ fontWeight: 600, fontSize: 13 }}
            >
              What it’s for
            </label>
            <input
              id="ds"
              className="in"
              style={{ height: 40, width: "100%" }}
              defaultValue="Covers Saturday and Sunday support. Can suspend a compromised account; can’t change profiles or invitations."
            />
          </div>
        </section>

        <section className="sheet" aria-labelledby="df">
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 8,
              padding: "16px 24px 12px",
            }}
          >
            <h2 id="df" className="section">
              Compared with {source.name}
            </h2>
            <a href="#" style={{ fontSize: 13 }}>
              Show the {18 - CHANGES.length} unchanged
            </a>
          </div>
          <div className="rows-scroll">
            <div
              role="table"
              aria-label={`Changes from ${source.name}`}
              style={{ minWidth: 640 }}
            >
              <div
                role="row"
                style={{
                  ...DIFF_GRID,
                  paddingTop: 8,
                  paddingBottom: 8,
                  fontSize: 12,
                  color: "var(--muted)",
                }}
              >
                <span role="columnheader">Permission</span>
                <span role="columnheader">
                  {source.name} → new
                </span>
                <span role="columnheader">What it means</span>
              </div>
              {CHANGES.map((c) => {
                const p = getPermission(c.permissionId);
                return (
                  <div role="row" style={DIFF_GRID} key={c.permissionId}>
                    <span role="cell">
                      <b style={{ fontWeight: 600 }}>{p.name}</b>
                      <small
                        style={{
                          display: "block",
                          fontSize: 12,
                          color: "var(--muted)",
                          marginTop: 2,
                          lineHeight: 1.4,
                        }}
                      >
                        {p.group}
                      </small>
                    </span>
                    <span
                      role="cell"
                      style={{
                        display: "flex",
                        gap: 6,
                        alignItems: "center",
                      }}
                    >
                      <SettingChip setting={c.from} />→
                      <SettingChip setting={c.to} />
                    </span>
                    <span
                      role="cell"
                      style={{ fontSize: 13, color: "var(--ink-2)" }}
                    >
                      {c.meaning}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div
            style={{
              padding: "16px 24px 18px",
              borderTop: "1px solid var(--rule-strong)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 13 }}>
              <b style={{ fontWeight: 600 }}>
                Allows {roleAllows(weekendSupport)} of 18:
              </b>{" "}
              {allowedNames.join(", ")}.
            </span>
            <PermissionStrip role={weekendSupport} full showCount={false} />
          </div>
        </section>
      </main>

      <aside
        style={{
          flex: "1 1 300px",
          maxWidth: 340,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <section
          className="sheet panel-box"
          aria-labelledby="as"
          style={{ paddingBottom: 8 }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 8,
            }}
          >
            <h2 id="as" className="panel">
              Who gets it · {ASSIGNEES.length}
            </h2>
            <a href="#" style={{ fontSize: 13 }}>
              Change
            </a>
          </div>
          <div>
            {ASSIGNEES.map((a) => {
              const m = getMember(a.memberId)!;
              const nowRole = getRole(m.roleId)!;
              return (
                <div
                  key={a.memberId}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "44px minmax(0,1fr)",
                    gap: 10,
                    padding: "12px 0",
                    borderTop: "1px solid var(--rule)",
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  <span
                    className="mono"
                    style={{ fontSize: 12, color: "var(--muted)" }}
                  >
                    {m.id}
                  </span>
                  <span>
                    <b style={{ fontWeight: 600 }}>{m.name}</b> · now{" "}
                    {nowRole.name}
                    <br />
                    <span style={{ color: "var(--ink-2)" }}>{a.effect}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section
          className="sheet panel-box"
          aria-labelledby="wh"
          style={{ gap: 8, fontSize: 13, lineHeight: 1.5 }}
        >
          <h2 id="wh" className="panel">
            When you create it
          </h2>
          <span>
            Roles go from {rolesNow} to {rolesNow + 1}. {source.name} drops
            to {supportAfter} people and {memberRole.name} to {memberAfter}.
          </span>
          <span>
            {firstNames} get an email listing exactly what changed.
          </span>
          <span>
            One audit entry is written for the role and one for each
            assignment.
          </span>
        </section>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <ButtonLink href="#" size="h40">
            Back
          </ButtonLink>
          <ButtonLink href="#" size="h40">
            Save as draft
          </ButtonLink>
          <ButtonLink
            variant="pri"
            size="h40"
            href="/app/roles"
            style={{ flex: 1, justifyContent: "center" }}
          >
            Create role and assign {ASSIGNEES.length}
          </ButtonLink>
        </div>
      </aside>
    </FocusedShell>
  );
}
