"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { AuditEntryView } from "./auditView";

const AE_GRID = "64px minmax(0,1fr) 140px 24px";

const rowGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: AE_GRID,
  gap: 14,
  alignItems: "baseline",
  padding: "12px 24px",
  fontSize: 14,
  lineHeight: 1.5,
  width: "100%",
  boxSizing: "border-box",
  textAlign: "left",
  background: "transparent",
  border: 0,
  font: "inherit",
  color: "inherit",
  cursor: "pointer",
};

/** Render a summary with the screen's 600-weight names and mono numbers. */
function RichSummary({ e }: { e: AuditEntryView }) {
  const marks: { text: string; kind: "strong" | "mono"; at: number }[] = [];
  for (const s of e.strong ?? []) {
    const at = e.summary.indexOf(s);
    if (at >= 0) marks.push({ text: s, kind: "strong", at });
  }
  for (const s of e.mono ?? []) {
    const at = e.summary.indexOf(s);
    if (at >= 0) marks.push({ text: s, kind: "mono", at });
  }
  if (marks.length === 0) return <>{e.summary}</>;
  marks.sort((a, b) => a.at - b.at);
  const out: ReactNode[] = [];
  let pos = 0;
  marks.forEach((m, i) => {
    if (m.at < pos) return;
    if (m.at > pos) out.push(e.summary.slice(pos, m.at));
    out.push(
      m.kind === "strong" ? (
        <b key={i} style={{ fontWeight: 600 }}>
          {m.text}
        </b>
      ) : (
        <span key={i} className="mono">
          {m.text}
        </span>
      ),
    );
    pos = m.at + m.text.length;
  });
  if (pos < e.summary.length) out.push(e.summary.slice(pos));
  return <>{out}</>;
}

function ActorLabel({ e }: { e: AuditEntryView }) {
  const label = e.actorLabel ?? e.actorName;
  if (e.actorLabelDeny) {
    return (
      <span style={{ fontSize: 12, color: "var(--deny)", fontWeight: 600 }}>
        {label}
      </span>
    );
  }
  return <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>;
}

/** Split a fixture "Inherit (Blocked, from baseline)" value into setting + result. */
function splitValue(v: string): { setting: string; result: string } {
  const m = v.match(/^(.+?)\s*\((.+)\)$/);
  if (!m) return { setting: v, result: "" };
  return { setting: m[1]!, result: m[2]! };
}

function hasDetail(e: AuditEntryView): boolean {
  return Boolean(e.before || e.after || e.from || e.note || e.affected?.length);
}

function EntryDetail({ e }: { e: AuditEntryView }) {
  const before = splitValue(e.before ?? "");
  const after = splitValue(e.after ?? "");
  const dt: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "120px minmax(0,1fr) minmax(0,1fr)",
    gap: "8px 16px",
    margin: 0,
    fontSize: 13,
    lineHeight: 1.5,
  };
  const label: React.CSSProperties = { color: "var(--muted)" };
  return (
    <div
      style={{
        padding: "0 24px 16px 102px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <dl style={dt}>
        <dt />
        <dd style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>Before</dd>
        <dd style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>After</dd>

        <dt style={label}>Setting</dt>
        <dd style={{ margin: 0 }}>
          <s style={{ color: "var(--muted)" }}>{before.setting}</s>
        </dd>
        <dd style={{ margin: 0 }}>
          <b style={{ fontWeight: 600 }}>{after.setting}</b>
        </dd>

        <dt style={label}>Result</dt>
        <dd style={{ margin: 0 }}>
          <s style={{ color: "var(--muted)" }}>{before.result}</s>
        </dd>
        <dd style={{ margin: 0 }}>
          <b style={{ fontWeight: 600 }}>{after.result}</b>
        </dd>

        <dt style={label}>Affected</dt>
        <dd style={{ margin: 0, gridColumn: "span 2" }}>
          {e.affected?.length} people: {e.affected?.join(", ")}
        </dd>

        <dt style={label}>From</dt>
        <dd style={{ margin: 0, gridColumn: "span 2" }}>
          {e.from} ·{" "}
          <span className="mono" style={{ fontSize: 12 }}>
            entry {e.id}
          </span>
        </dd>
      </dl>
      {e.note ? (
        <span style={{ fontSize: 13, color: "var(--ink-2)" }}>{e.note}</span>
      ) : null}
    </div>
  );
}

/**
 * G-03 entry list. Every row is a link-like control that expands in place
 * (the screen renders rows as links with a › / ⌄ affordance); the fixture's
 * expanded entry starts open. Filters stay in the URL (AuditFilters); only
 * the open row is local state.
 */
export function AuditList({
  groups,
}: {
  groups: { day: string; entries: AuditEntryView[] }[];
}) {
  const firstExpanded = groups
    .flatMap((g) => g.entries)
    .find((e) => e.expanded);
  const [openId, setOpenId] = useState<string | null>(
    firstExpanded?.id ?? null,
  );

  return (
    <>
      {groups.map((g, gi) => (
        <div key={g.day}>
          <div
            style={{
              padding: "10px 24px",
              borderTop: gi === 0 ? 0 : "1px solid var(--rule-strong)",
              background: "var(--sheet-sunk)",
              font: "600 13px/1.2 var(--font-sans)",
              color: "var(--ink-2)",
            }}
          >
            {g.day}
          </div>
          {g.entries.map((e) => {
            const open = openId === e.id;
            return (
              <div
                role="listitem"
                key={e.id}
                style={{
                  borderTop: "1px solid var(--rule)",
                  ...(open ? { background: "var(--sheet-tint)" } : {}),
                }}
              >
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : e.id)}
                  style={rowGrid}
                >
                  <span
                    className="mono"
                    style={{ fontSize: 12, color: "var(--muted)" }}
                  >
                    {e.time}
                  </span>
                  <span>
                    {e.expanded ? (
                      <>
                        <b style={{ fontWeight: 600 }}>You</b> changed{" "}
                        <Link
                          href="/app/roles/product-admin"
                          onClick={(ev) => ev.stopPropagation()}
                        >
                          Product admin
                        </Link>
                        : Create teams
                      </>
                    ) : (
                      <RichSummary e={e} />
                    )}
                  </span>
                  <ActorLabel e={e} />
                  <span aria-hidden="true" style={{ color: "var(--muted)" }}>
                    {open ? "⌄" : "›"}
                  </span>
                </button>
                {open && hasDetail(e) ? <EntryDetail e={e} /> : null}
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}
