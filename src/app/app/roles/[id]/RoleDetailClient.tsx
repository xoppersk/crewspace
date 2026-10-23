"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { settingResultFor } from "@/lib/api";
import {
  applyRoleChanges,
  discardRoleChanges,
  proposeRoleChange,
} from "@/lib/data/actions";
import { APP_LAYER_PERMISSION_IDS } from "@/lib/data/permissions";
import type { Member, Permission, PermissionGroup, Role, Setting } from "@/lib/types";
import { shortId } from "@/components/MemberRow";
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
function memberSub(m: Member, teams: { id: string; name: string }[]): string {
  const first = m.teams[0];
  if (!first) return "—";
  const teamName = teams.find((t) => t.id === first.teamId)?.name ?? "—";
  if (first.lead) return `${teamName} · lead`;
  if (m.isNew) return `${teamName} · joined ${m.joined}`;
  return teamName;
}

export function RoleDetailClient({
  role,
  permissions,
  groups,
  members,
  teams,
  baselineIds,
  scopeCount,
}: {
  role: Role;
  permissions: Permission[];
  groups: PermissionGroup[];
  members: Member[];
  teams: { id: string; name: string }[];
  baselineIds: number[];
  /** deactivateScopeCount from the page (real member data). */
  scopeCount: number;
}) {
  const router = useRouter();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* System roles are fixed: their register renders locked. */
  const isSystem = role.type === "System";

  /* The draft flow is server-backed (00019): committed settings are
     role.settings; pending rows in role_permission_changes overlay
     them. Toggling PROPOSES a change via RPC — nothing committed
     moves until Apply. */
  const committed = role.settings;
  const draft: Record<string, Setting> = { ...role.settings };
  for (const c of role.pendingChanges ?? []) {
    draft[String(c.permissionId)] = c.to;
  }
  const changes: Change[] = (role.pendingChanges ?? [])
    .map((c) => ({
      permission: permissions.find((p) => p.id === c.permissionId)!,
      from: c.from,
      to: c.to,
    }))
    .filter((c) => c.permission);

  const onToggle = async (pid: number, next: Setting) => {
    setBusy(true);
    setError(null);
    const res = await proposeRoleChange(role.id, pid, next);
    setBusy(false);
    if (!res.ok) setError(res.error);
    else router.refresh();
  };

  const apply = async () => {
    setBusy(true);
    setError(null);
    const res = await applyRoleChanges(role.id);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
    } else {
      setReviewOpen(false);
      router.refresh();
    }
  };

  const discard = async () => {
    setBusy(true);
    setError(null);
    const res = await discardRoleChanges(role.id);
    setBusy(false);
    if (!res.ok) setError(res.error);
    else router.refresh();
  };

  const allowsWith = (settings: Record<string, Setting>) =>
    permissions.filter(
      (p) => settingResultFor(settings[String(p.id)]!, p.id, baselineIds) === "Allowed",
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
    if (p.id === 2 && settingResultFor(setting, p.id, baselineIds) === "Allowed")
      return `${scopeCount} people in scope`;
    return undefined;
  };

  const groupAllows = (g: PermissionGroup) =>
    g.permissionIds.filter(
      (pid) => settingResultFor(draft[String(pid)]!, pid, baselineIds) === "Allowed",
    ).length;

  const effectFor = (c: Change): string => {
    if (c.permission.id === 2 && c.to === "allow") {
      return `${members.length} ${role.name}s can suspend ${scopeCount} people: everyone except the owner and other ${role.name}s.`;
    }
    if (c.permission.id === 8 && c.to === "deny") {
      return "No change today. Stays blocked even if the baseline later allows exports.";
    }
    return settingResultFor(c.to, c.permission.id, baselineIds) === "Allowed"
      ? `The ${members.length} people with this role gain this, on their next page load.`
      : `The ${members.length} people with this role lose this, on their next page load.`;
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
                  <p className="summary">{role.summary}</p>
                </div>
              </div>
              <div className="head-actions">
                {isSystem ? null : (
                  <ButtonLink href={`/app/roles/new?from=${role.id}`}>Duplicate</ButtonLink>
                )}
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
                <PermissionStrip role={stripRole} permissions={permissions} baselineIds={baselineIds} big showCount={false} />
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
                                settingResultFor(draft[String(pid)]!, pid, baselineIds) ===
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
                          baselineIds={baselineIds}
                          setting={draft[String(pid)]!}
                          changedFrom={change ? change.from : null}
                          resultNote={noteFor(p)}
                          disabledReason={
                            isSystem
                              ? "System roles are fixed."
                              : APP_LAYER_PERMISSION_IDS.has(pid)
                                ? "Managed at the platform layer."
                                : busy
                                  ? "Saving…"
                                  : undefined
                          }
                          onChange={(next) => void onToggle(pid, next)}
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
                    <span key={g.name} className="grp-tile">
                      <span className="gname">{g.name}</span>
                      <span className="mini" aria-hidden="true">
                        {g.permissionIds.map((pid) => (
                          <i
                            key={pid}
                            className={
                              settingResultFor(draft[String(pid)]!, pid, baselineIds) ===
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
                    </span>
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
                              : settingResultFor(c.to, c.permission.id, baselineIds) ===
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
                <dd>You</dd>
                <dt>Takes effect</dt>
                <dd>On next page load</dd>
                <dt>Recorded</dt>
                <dd>Audit log, before and after</dd>
              </dl>
              {error ? (
                <p style={{ color: "var(--panel-deny, #f2b8b5)", fontSize: 13 }}>
                  {error}
                </p>
              ) : null}
              <div className="action-grid">
                <Button variant="on-dark" disabled={busy} onClick={() => void discard()}>
                  Discard
                </Button>
                <Button variant="white" disabled={busy} onClick={() => setReviewOpen(true)}>
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
                    {shortId(m.id)}
                  </span>
                  <span className="mname">
                    <b>{m.name}</b>
                    <span className="msub">{memberSub(m, teams)}</span>
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
              change for the {members.length} members with this role.
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
                  {settingResultFor(c.to, c.permission.id, baselineIds)} · affects{" "}
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
            <Button variant="pri" disabled={busy} onClick={() => void apply()}>
              Apply {changes.length} change{changes.length === 1 ? "" : "s"}
            </Button>
            <Button onClick={() => setReviewOpen(false)}>Keep editing</Button>
          </footer>
        </Drawer>
      ) : null}
    </>
  );
}
