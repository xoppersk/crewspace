"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { deactivateScopeCount, getTeam, settingResult } from "@/lib/api";
import type { Member, Permission, PermissionGroup, Role, Setting } from "@/lib/types";
import { Button, ButtonLink } from "@/components/Button";
import { Drawer, DrawerClose } from "@/components/Drawer";
import { PermissionRow, settingLabel } from "@/components/PermissionRow";
import { PermissionStrip } from "@/components/PermissionStrip";
import { IconShieldCheck } from "@/components/icons";

interface Change {
  permission: Permission;
  from: Setting;
  to: Setting;
}

/**
 * R-04 Role detail (screens/Main.html): header card with the big strip,
 * the permission register (People / Access / Governance expanded, the
 * other five groups as tiles), and — in place of a ReviewBar — the dark
 * sticky panel that lists every pending change before it applies.
 */

/** The header-card lead: Main.html's string for Product admin; other
    roles fall back to the fixture summary. */
const LEAD_TEXT: Record<string, string> = {
  "product-admin":
    "Runs the product workspace: invites people, changes roles and organizes teams. Can’t edit what a role allows, change sign-in or billing, or export the audit archive.",
};

/** Avatar tints in the header stack, exactly as Main.html draws them
    (Daniel, Ama, Lucas, Hannah, Maya), keyed by member id. */
const STACK_TINTS: Record<string, string> = {
  "017": "#DCE3F4",
  "023": "#E9E3D6",
  "031": "#DDEBE2",
  "038": "#F0DDDA",
  "042": "#E6E9EE",
};
const STACK_FALLBACK = ["#DCE3F4", "#E9E3D6", "#DDEBE2", "#F0DDDA", "#E3DDF0"];

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

/** "Product · lead" / "Product · joined Oct 5" / "Product": the member's
    first team, its lead flag, and the new-member joined date. */
function memberSub(m: Member): string {
  const first = m.teams[0];
  if (!first) return "—";
  const teamName = getTeam(first.teamId)?.name ?? "—";
  if (first.lead) return `${teamName} · lead`;
  if (m.isNew) return `${teamName} · joined ${m.joined}`;
  return teamName;
}

export function RoleDetailClient({
  role,
  permissions,
  groups,
  members,
  offline = false,
}: {
  role: Role;
  permissions: Permission[];
  groups: PermissionGroup[];
  members: Member[];
  offline?: boolean;
}) {
  const [committed, setCommitted] = useState<Record<string, Setting>>(
    role.settings,
  );
  const [draft, setDraft] = useState<Record<string, Setting>>(() => {
    const d = { ...role.settings };
    for (const c of role.pendingChanges ?? []) d[String(c.permissionId)] = c.to;
    return d;
  });
  const [reviewOpen, setReviewOpen] = useState(false);
  /* System roles are fixed (Roles.html: "3 system roles that can't be
     edited"): their register renders locked and offers no Duplicate. */
  const isSystem = role.type === "System";

  const changes: Change[] = useMemo(
    () =>
      permissions
        .filter((p) => draft[String(p.id)] !== committed[String(p.id)])
        .map((p) => ({
          permission: p,
          from: committed[String(p.id)]!,
          to: draft[String(p.id)]!,
        })),
    [permissions, draft, committed],
  );

  const allowsWith = (settings: Record<string, Setting>) =>
    permissions.filter(
      (p) => settingResult(settings[String(p.id)]!, p.id) === "Allowed",
    ).length;
  const allowsToday = allowsWith(committed);
  const allowsAfter = allowsWith(draft);

  /* The header strip draws committed allows + the working diff as its
     pending states, so it tracks edits, discards and applies live. */
  const stripRole: Role = {
    ...role,
    settings: committed,
    pendingChanges: changes.map((c) => ({
      permissionId: c.permission.id,
      from: c.from,
      to: c.to,
    })),
  };

  const noteFor = (p: Permission): string | undefined => {
    const setting = draft[String(p.id)]!;
    if (p.id === 8 && setting === "deny") return "even if baseline changes";
    if (p.id === 2 && settingResult(setting, p.id) === "Allowed")
      return `${deactivateScopeCount()} people in scope`;
    return undefined;
  };

  const groupAllows = (g: PermissionGroup) =>
    g.permissionIds.filter(
      (pid) => settingResult(draft[String(pid)]!, pid) === "Allowed",
    ).length;

  const effectFor = (c: Change): string => {
    if (c.permission.id === 2 && c.to === "allow") {
      return `${members.length} ${role.name}s can suspend ${deactivateScopeCount()} people: everyone except the owner and other ${role.name}s.`;
    }
    if (c.permission.id === 8 && c.to === "deny") {
      return "No change today. Stays blocked even if the baseline later allows exports.";
    }
    return settingResult(c.to, c.permission.id) === "Allowed"
      ? `The ${members.length} people with this role gain this, on their next page load.`
      : `The ${members.length} people with this role lose this, on their next page load.`;
  };

  const apply = () => {
    setCommitted(draft);
    setReviewOpen(false);
  };

  const expandedGroups = groups.slice(0, 3);
  const tileGroups = groups.slice(3);
  const changedShort =
    role.lastChanged === "—"
      ? null
      : role.lastChanged.replace(" Koroma", "");

  return (
    <>
      <div className="split-340">
        <div className="main-col-stack">
          <section className="card role-head" aria-labelledby="rn">
            <div className="head-top">
              <div className="id-row">
                <span className="tile52" aria-hidden="true">
                  <IconShieldCheck strokeWidth={1.3} />
                </span>
                <div>
                  <div className="name-row">
                    <h1 id="rn" className="stitle">
                      {role.name}
                    </h1>
                    <span className="rno">{role.regNumber}</span>
                    <span className="type-chip">{role.type}</span>
                  </div>
                  <p className="summary">{LEAD_TEXT[role.id] ?? role.summary}</p>
                </div>
              </div>
              <div className="head-actions">
                {isSystem ? null : <Button>Duplicate</Button>}
                <ButtonLink href="/app/audit">History</ButtonLink>
              </div>
            </div>
            <div className="meta-row">
              <div className="meta-people">
                <span className="av-stack" aria-hidden="true">
                  {members.slice(0, 5).map((m, i) => (
                    <span
                      key={m.id}
                      className="av"
                      style={{
                        background:
                          STACK_TINTS[m.id] ?? STACK_FALLBACK[i % STACK_FALLBACK.length],
                      }}
                    >
                      {initialsOf(m.name)}
                    </span>
                  ))}
                </span>
                <span>
                  <b>{members.length} members</b>
                  {changedShort ? (
                    <>
                      <br />
                      changed {changedShort}
                    </>
                  ) : null}
                </span>
              </div>
              <div className="strip-block">
                <div className="strip-labels">
                  <span>
                    <b>Allows {allowsToday} of 18</b> today
                  </span>
                  {changes.length > 0 ? (
                    <span>{allowsAfter} after review</span>
                  ) : null}
                </div>
                <PermissionStrip role={stripRole} big showCount={false} />
              </div>
            </div>
          </section>

          <section className="card register-card" aria-labelledby="pr">
            <div className="register-head">
              <div>
                <h2 id="pr">Permission register</h2>
                <span className="legend">
                  <b>Allow</b> grants · <b className="deny">Deny</b> blocks,
                  whatever the baseline · <b>Inherit</b> follows the{" "}
                  <a href="#">organization baseline</a>
                </span>
              </div>
              <span className="count">
                {permissions.length} permissions · {groups.length} groups
              </span>
            </div>

            <div className="rows-scroll">
              <div
                role="table"
                className="tbl-stack"
                style={{ minWidth: 640 }}
              >
                {expandedGroups.map((g) => (
                  <div role="rowgroup" key={g.name}>
                    <div className="grp">
                      <span>{g.name}</span>
                      <span className="cnt">
                        <span className="mini" aria-hidden="true">
                          {g.permissionIds.map((pid) => (
                            <i
                              key={pid}
                              className={
                                settingResult(draft[String(pid)]!, pid) ===
                                "Allowed"
                                  ? "on"
                                  : undefined
                              }
                            />
                          ))}
                        </span>
                        {groupAllows(g)} of {g.permissionIds.length}
                      </span>
                    </div>
                    {g.permissionIds.map((pid) => {
                      const p = permissions.find((x) => x.id === pid)!;
                      const change = changes.find(
                        (c) => c.permission.id === pid,
                      );
                      return (
                        <PermissionRow
                          key={pid}
                          permission={p}
                          setting={draft[String(pid)]!}
                          changedFrom={change ? change.from : null}
                          resultNote={noteFor(p)}
                          disabledReason={
                            isSystem
                              ? "System roles are fixed."
                              : offline
                                ? "Access changes are paused while you are offline."
                                : undefined
                          }
                          onChange={(next) =>
                            setDraft((d) => ({ ...d, [String(pid)]: next }))
                          }
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <div className="grp-tiles">
              <div className="grid">
                {tileGroups.map((g) => {
                  const ownerOnly = g.permissionIds.some(
                    (pid) => draft[String(pid)] === "locked",
                  );
                  return (
                    <a key={g.name} href="#" className="grp-tile">
                      <span className="gname">{g.name}</span>
                      <span className="mini" aria-hidden="true">
                        {g.permissionIds.map((pid) => (
                          <i
                            key={pid}
                            className={
                              settingResult(draft[String(pid)]!, pid) ===
                              "Allowed"
                                ? "on"
                                : undefined
                            }
                          />
                        ))}
                      </span>
                      <span className="gcount">
                        {groupAllows(g)} of {g.permissionIds.length}
                        {ownerOnly ? " · owner only" : ""}
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        <aside className="aside-sticky">
          {changes.length > 0 && !isSystem ? (
            <section className="dpanel" aria-labelledby="rv">
              <div>
                <h2 id="rv">
                  {changes.length} change{changes.length === 1 ? "" : "s"} ready
                </h2>
                <p className="sub">
                  Affects {members.length} members. Nothing changes until you
                  apply.
                </p>
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {changes.map((c) => (
                  <div className="dchg" key={c.permission.id}>
                    <div className="dchg-head">
                      <span>{c.permission.name}</span>
                      <span className="mono">
                        #{String(c.permission.id).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="fromto">
                      <s>{settingLabel(c.from)}</s>
                      <span className="arr">→</span>
                      <b
                        className={
                          c.to === "deny"
                            ? "deny"
                            : c.to === "allow"
                              ? "allow"
                              : settingResult(c.to, c.permission.id) ===
                                  "Allowed"
                                ? "allow"
                                : "deny"
                        }
                      >
                        {settingLabel(c.to)}
                      </b>
                    </div>
                    <p>{effectFor(c)}</p>
                  </div>
                ))}
              </div>
              <dl>
                <dt>Applied by</dt>
                <dd>You, as owner</dd>
                <dt>Takes effect</dt>
                <dd>On next page load</dd>
                <dt>Recorded</dt>
                <dd>Audit log, before and after</dd>
                <dt>Members told</dt>
                <dd>By email</dd>
              </dl>
              <div className="action-grid">
                <Button variant="on-dark" onClick={() => setDraft(committed)}>
                  Discard
                </Button>
                <Button variant="white" onClick={() => setReviewOpen(true)}>
                  Review and apply
                </Button>
              </div>
            </section>
          ) : null}

          <section className="card role-members" aria-labelledby="mb">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 8,
                marginBottom: 6,
              }}
            >
              <h2
                id="mb"
                style={{ margin: 0, font: "700 15px/1.3 var(--font-sans)" }}
              >
                Members with this role
              </h2>
              <Link
                href="/app/invitations"
                style={{ fontSize: 13, fontWeight: 600 }}
              >
                Assign
              </Link>
            </div>
            <div>
              {members.map((m) => (
                <div className="mem" key={m.id}>
                  <span
                    className="mono"
                    style={{ fontSize: 12, color: "var(--muted)" }}
                  >
                    {m.id}
                  </span>
                  <span className="mname">
                    <b>{m.name}</b>
                    <span className="msub">{memberSub(m)}</span>
                  </span>
                  <span className={m.status === "active" ? "ok" : "off"}>
                    {m.status === "active" ? "Active" : "Deactivated"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {reviewOpen ? (
        <Drawer labelledBy="review-title" onClose={() => setReviewOpen(false)}>
          <header
            style={{
              padding: "20px 24px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span className="register">
                Review · {role.name} {role.regNumber}
              </span>
              <DrawerClose onClose={() => setReviewOpen(false)} />
            </div>
            <h2
              id="review-title"
              style={{ margin: 0, font: "700 24px/1.2 var(--font-sans)" }}
            >
              Review {changes.length} change{changes.length === 1 ? "" : "s"}
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                lineHeight: 1.5,
                color: "var(--ink-2)",
              }}
            >
              Nothing has changed yet. Applying writes one audit entry per
              change and emails the {members.length} members with this role.
            </p>
          </header>
          <section className="ds">
            {changes.map((c) => (
              <div
                key={c.permission.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                  paddingBottom: 10,
                  borderBottom: "1px solid var(--rule)",
                }}
              >
                <b style={{ fontWeight: 600 }}>{c.permission.name}</b>
                <span style={{ fontSize: 13, color: "var(--ink-2)" }}>
                  {settingLabel(c.from)} → {settingLabel(c.to)} · result:{" "}
                  {settingResult(c.to, c.permission.id)} · affects{" "}
                  {members.length} members (
                  {members.map((m) => m.name).join(", ")})
                </span>
              </div>
            ))}
          </section>
          <footer
            style={{
              marginTop: "auto",
              padding: "16px 24px",
              borderTop: "1px solid var(--rule-strong)",
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <Button variant="pri" onClick={apply}>
              Apply {changes.length} change{changes.length === 1 ? "" : "s"}
            </Button>
            <Button onClick={() => setReviewOpen(false)}>Keep editing</Button>
          </footer>
        </Drawer>
      ) : null}
    </>
  );
}
