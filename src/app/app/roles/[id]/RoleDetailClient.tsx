"use client";

import { useMemo, useState } from "react";
import { deactivateScopeCount, getTeam, settingResult } from "@/lib/api";
import type { Member, Permission, PermissionGroup, Role, Setting } from "@/lib/types";
import { Button } from "@/components/Button";
import { Drawer, DrawerClose } from "@/components/Drawer";
import { PermissionRow, settingLabel } from "@/components/PermissionRow";
import { ReviewBar } from "@/components/ReviewBar";

interface Change {
  permission: Permission;
  from: Setting;
  to: Setting;
}

const EFFECT_COPY: Record<number, { title: string; body: string }> = {
  2: {
    title: "Deactivate members becomes Allowed",
    body: "5 Product admins can suspend 36 people: everyone except the owner and other Product admins.",
  },
  14: {
    title: "Export audit records becomes Denied",
    body: "No change today. It stays blocked even if the baseline later allows exports.",
  },
};

export function RoleDetailClient({
  role,
  permissions,
  groups,
  members,
  history,
  offline = false,
}: {
  role: Role;
  permissions: Permission[];
  groups: PermissionGroup[];
  members: Member[];
  history: { when: string; text: string }[];
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

  const noteFor = (p: Permission): string | undefined => {
    const setting = draft[String(p.id)]!;
    if (p.id === 14 && changes.some((c) => c.permission.id === 14))
      return "stays blocked if the baseline changes";
    if (p.id === 2 && settingResult(setting, p.id) === "Allowed")
      return `${deactivateScopeCount()} people in scope`;
    if (setting === "inherit") return "from baseline";
    return undefined;
  };

  const apply = () => {
    setCommitted(draft);
    setReviewOpen(false);
  };

  return (
    <>
      <article className="sheet main-sheet">
        <header
          style={{
            padding: "24px 24px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              gap: 14,
              alignItems: "flex-start",
            }}
          >
            <div
              style={{ display: "flex", flexDirection: "column", gap: 6 }}
            >
              <h1 className="title">{role.name}</h1>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>
                {role.type} role <span className="mono">{role.regNumber}</span>{" "}
                · {members.length} members · last changed {role.lastChanged}
              </span>
            </div>
            <div className="head-actions">
              {isSystem ? null : <Button>Duplicate</Button>}
              <Button>Role history</Button>
            </div>
          </div>
          <p className="lead" style={{ lineHeight: 1.6 }}>
            {role.summary}
          </p>
          <p className="legend-box">
            <b>Allow</b> grants it. <b className="deny">Deny</b> blocks it,
            whatever the baseline says. <b>Inherit</b> follows the{" "}
            <a href="/app/settings">organization baseline</a>, so the result
            changes if the baseline does.
          </p>
        </header>

        <div className="sheet-head">
          <h2 className="section">Permission register</h2>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            {permissions.length} permissions in {groups.length} groups ·
            allows {allowsToday} today
            {changes.length > 0 ? `, ${allowsAfter} after review` : ""}
          </span>
        </div>

        <div className="rows-scroll">
          <div
            role="table"
            aria-label={`Permissions for ${role.name}`}
            style={{ minWidth: 640, paddingBottom: 8 }}
          >
            <div role="row" className="pr head">
              <span role="columnheader">Permission</span>
              <span role="columnheader">Setting</span>
              <span role="columnheader">Result</span>
            </div>
            {groups.map((g) => (
              <div role="rowgroup" key={g.name}>
                <div role="row" className="gh">
                  <h3 role="columnheader">{g.name}</h3>
                  <span>{g.permissionIds.length} rules</span>
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

        {isSystem ? null : (
          <ReviewBar
            count={changes.length}
            affects={`affects ${members.length} members`}
            onDiscard={() => setDraft(committed)}
            onReview={() => setReviewOpen(true)}
          />
        )}
      </article>

      <aside className="side-col">
        <section className="sheet panel-box" aria-labelledby="eff">
          <h2 id="eff" className="panel">
            What applying does
          </h2>
          {changes.length > 0 ? (
            <ol
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {changes.map((c) => {
                const designed = EFFECT_COPY[c.permission.id];
                const result = settingResult(c.to, c.permission.id);
                return (
                  <li
                    key={c.permission.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    <b style={{ fontWeight: 600 }}>
                      {designed?.title ??
                        `${c.permission.name} becomes ${result}`}
                    </b>
                    <span style={{ color: "var(--ink-2)" }}>
                      {designed?.body ??
                        (result === "Allowed"
                          ? `The ${members.length} people with this role gain this, on their next page load.`
                          : `The ${members.length} people with this role lose this, on their next page load.`)}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : null}
          <dl
            className="kv"
            style={{
              margin: 0,
              paddingTop: 12,
              borderTop: "1px solid var(--rule)",
            }}
          >
            <dt>Applied by</dt>
            <dd>You, as organization owner</dd>
            <dt>Takes effect</dt>
            <dd>Immediately, on next page load</dd>
            <dt>Recorded</dt>
            <dd>Audit log, with before and after</dd>
            <dt>Members told</dt>
            <dd>By email, with what changed</dd>
          </dl>
        </section>

        <section
          className="sheet panel-box flush"
          aria-labelledby="who"
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 8,
              paddingBottom: 6,
            }}
          >
            <h2 id="who" className="panel">
              Members with this role
            </h2>
            <a href="/app/invitations" style={{ fontSize: 13 }}>
              Assign
            </a>
          </div>
          <div>
            {members.map((m) => (
              <div className="mem" key={m.id}>
                <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
                  {m.id}
                </span>
                <span>
                  {m.name}
                  <br />
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    {m.id === "042"
                      ? "Product · joined Oct 5"
                      : (m.teams[0]
                          ? (getTeam(m.teams[0]!.teamId)?.name ?? "—")
                          : "—")}
                  </span>
                </span>
                <span className={m.status === "active" ? "ok" : "off"}>
                  {m.status === "active" ? "Active" : "Deactivated"}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="hist"
          style={{
            padding: "4px 4px 0",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <h2
            id="hist"
            style={{
              margin: 0,
              font: "600 13px/1.3 var(--font-sans)",
              color: "var(--muted)",
            }}
          >
            Recent changes to this role
          </h2>
          {history.map((h, i) => (
            <span key={i}>
              <span
                className="mono"
                style={{ fontSize: 12, color: "var(--muted)" }}
              >
                {h.when}
              </span>{" "}
              · {h.text}
            </span>
          ))}
          <a href="/app/audit" style={{ fontSize: 13 }}>
            Open in audit log
          </a>
        </section>
      </aside>

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
