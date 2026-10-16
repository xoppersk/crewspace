import type { Metadata } from "next";
import Link from "next/link";
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
import { AppShell } from "@/components/Shell";
import { ButtonLink } from "@/components/Button";
import { PermissionStrip } from "@/components/PermissionStrip";
import { IconCheck } from "@/components/icons";

/**
 * R-05 Role wizard, step 3 of 3 (screens/RoleWizard.html):
 * "Weekend support", copied from Support lead, reviewed before create.
 * The screen draws the app rail plus a horizontal step strip, and a
 * dark sticky aside holding who gets it, the consequences and the
 * create actions. The diff is authoritative BY NAME in the screen:
 * Deactivate members (new #2), Edit member profiles (new #3) and
 * Resend or revoke invitations (new #11 — the old register's #9).
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
    permissionId: 11,
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
  const cls =
    setting === "allow" ? "allow" : setting === "deny" ? "deny" : "inherit";
  return <span className={`vchip ${cls}`}>{label}</span>;
}

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
  /* The screen's sentence order: Deactivate members, Sign members out
     everywhere, Read audit log (new ids 2, 14, 7). */
  const allowedNames = [2, 14, 7].map((id) => getPermission(id).name);

  const rolesNow = getRoles().length;
  const supportAfter = roleMemberCount("support-lead") - 1;
  const memberAfter = roleMemberCount("member") - 1;
  const firstNames = ASSIGNEES.map(
    (a) => getMember(a.memberId)!.name.split(" ")[0],
  ).join(" and ");

  return (
    <AppShell current="roles">
      <div className="wz-toprow">
        <span className="flow">New role</span>
        <Link href="/app/roles">Cancel and go back to roles</Link>
      </div>

      <nav aria-label="Steps" className="card wz-steps">
        <div className="wz-step">
          <span className="sr-only">Step 1</span>
          <span className="n" aria-hidden="true">
            <IconCheck />
          </span>
          <span>
            <b>Start from</b>
            <br />
            <span className="sum">{source.name}</span>
          </span>
        </div>
        <div className="wz-step">
          <span className="sr-only">Step 2</span>
          <span className="n" aria-hidden="true">
            <IconCheck />
          </span>
          <span>
            <b>Permissions</b>
            <br />
            <span className="sum">
              {CHANGES.length} changed of 18
            </span>
          </span>
        </div>
        <div className="wz-step" aria-current="step">
          <span className="n" aria-hidden="true">
            3
          </span>
          <span className="stext">Review and assign</span>
        </div>
      </nav>

      <div className="split-340">
        <div className="main-col-stack">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: "8px 0 2px",
            }}
          >
            <h1 className="stitle">Review the new role</h1>
            <p className="sled">
              Nothing exists yet. Check what it allows, who gets it and what
              changes for them, then create it.
            </p>
          </div>

          <section className="card wz-name-card">
            <div className="fld">
              <label htmlFor="nm">Name</label>
              <input id="nm" className="in" defaultValue="Weekend support" />
            </div>
            <div className="fld">
              <span className="lb">Register number</span>
              <span className="wz-rno">
                <span className="rno">R-10</span>
                <span className="note">assigned on create</span>
              </span>
            </div>
            <div className="fld span2">
              <label htmlFor="ds">What it’s for</label>
              <input
                id="ds"
                className="in"
                defaultValue="Covers Saturday and Sunday support. Can suspend a compromised account; can’t change profiles or invitations."
              />
            </div>
          </section>

          <section className="card" aria-labelledby="df" style={{ overflow: "hidden" }}>
            <div className="card-head">
              <h2 id="df">Compared with {source.name}</h2>
              <a href="#" style={{ fontSize: 13, fontWeight: 600 }}>
                Show the {18 - CHANGES.length} unchanged
              </a>
            </div>
            <div className="rows-scroll">
              <div
                role="table"
                aria-label={`Changes from ${source.name}`}
                style={{ minWidth: 620 }}
              >
                <div role="row" className="dr th">
                  <span role="columnheader">Permission</span>
                  <span role="columnheader">{source.name} → new</span>
                  <span role="columnheader">What it means</span>
                </div>
                {CHANGES.map((c) => {
                  const p = getPermission(c.permissionId);
                  return (
                    <div role="row" className="dr" key={c.permissionId}>
                      <span role="cell">
                        <b style={{ fontWeight: 600 }}>{p.name}</b>
                        <small>{p.group}</small>
                      </span>
                      <span role="cell" className="chips">
                        <SettingChip setting={c.from} />
                        <span className="arr" aria-hidden="true">
                          →
                        </span>
                        <SettingChip setting={c.to} />
                      </span>
                      <span role="cell" className="meaning">
                        {c.meaning}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div
              className="wz-allows"
              style={{
                padding: "18px 22px 20px",
                borderTop: "1px solid var(--rule-strong)",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <span className="ahead">
                <b>Allows {roleAllows(weekendSupport)} of 18:</b>{" "}
                {allowedNames.join(", ")}.
              </span>
              <PermissionStrip role={weekendSupport} full showCount={false} />
            </div>
          </section>
        </div>

        <aside className="aside-sticky">
          <section className="dpanel">
            <div
              role="group"
              aria-labelledby="as"
              style={{ display: "flex", flexDirection: "column", gap: 10 }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 8,
                }}
              >
                <h2 id="as">Who gets it · {ASSIGNEES.length}</h2>
                <a href="#" className="edit-link">
                  Change
                </a>
              </div>
              {ASSIGNEES.map((a) => {
                const m = getMember(a.memberId)!;
                const nowRole = getRole(m.roleId)!;
                return (
                  <div className="dchg" key={a.memberId}>
                    <div className="dchg-head">
                      <span>
                        {m.name}{" "}
                        <span
                          style={{
                            color: "var(--panel-muted)",
                            fontWeight: 400,
                          }}
                        >
                          · now {nowRole.name}
                        </span>
                      </span>
                      <span className="mono">{m.id}</span>
                    </div>
                    <p className="effect">{a.effect}</p>
                  </div>
                );
              })}
            </div>

            <div className="subgroup" role="group" aria-labelledby="wh">
              <h2 id="wh">When you create it</h2>
              <span>
                Roles go from {rolesNow} to {rolesNow + 1}. {source.name}{" "}
                drops to {supportAfter} people and {memberRole.name} to{" "}
                {memberAfter}.
              </span>
              <span>
                {firstNames} get an email listing exactly what changed.
              </span>
              <span>
                One audit entry is written for the role and one for each
                assignment.
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <ButtonLink
                variant="white"
                size="h40"
                href="/app/roles"
                style={{ justifyContent: "center" }}
              >
                Create role and assign {ASSIGNEES.length}
              </ButtonLink>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                <ButtonLink variant="on-dark" href="#">
                  Back
                </ButtonLink>
                <ButtonLink variant="on-dark" href="#">
                  Save as draft
                </ButtonLink>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
