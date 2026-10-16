"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { AuditEntryView } from "./auditView";

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

function GearIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="#5E6773"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
    </svg>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join("")
    .toUpperCase();
}

/* Avatar tints exactly as the screen draws them for these actors
   (screen-literal hexes; everyone else takes the token fill). */
const AVATAR_BG: Record<string, string> = {
  "001": "#F0DDDA",
  "011": "#F0DDDA",
  "017": "#E9E3D6",
};

function ActorCell({ e }: { e: AuditEntryView }) {
  const label = e.actorLabel ?? e.actorName;
  return (
    <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {e.actorId === "system" ? (
        <span
          className="gov-avr"
          aria-hidden="true"
          style={{ background: "var(--rule)" }}
        >
          <GearIcon />
        </span>
      ) : (
        <span
          className="gov-avr"
          aria-hidden="true"
          style={{ background: AVATAR_BG[e.actorId] ?? "var(--fill)" }}
        >
          {initials(e.actorName)}
        </span>
      )}
      <span className={`k${e.actorLabelDeny ? " deny" : ""}`}>{label}</span>
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        color: open ? "var(--seal)" : "#9AA3AE",
        display: "grid",
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        {open ? (
          <path d="m3.5 6 4.5 4.5L12.5 6" />
        ) : (
          <path d="m6 3.5 4.5 4.5L6 12.5" />
        )}
      </svg>
    </span>
  );
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
  return (
    <div className="gov-ae-detail">
      <div className="gov-ae-card">
        <dl className="gov-dt">
          <dt />
          <dd className="colhead">Before</dd>
          <dd className="colhead">After</dd>

          <dt>Setting</dt>
          <dd>
            <s style={{ color: "var(--muted)" }}>{before.setting}</s>
          </dd>
          <dd>
            <span className="gov-va">{after.setting}</span>
          </dd>

          <dt>Result</dt>
          <dd>
            <s style={{ color: "var(--muted)" }}>{before.result}</s>
          </dd>
          <dd>
            <span className="res" style={{ fontSize: 13 }}>
              <span className="dot ok">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  aria-hidden="true"
                >
                  <path d="m3 8.5 3 3 7-7" />
                </svg>
              </span>
              {after.result}
            </span>
          </dd>

          <dt>Affected</dt>
          <dd style={{ gridColumn: "span 2" }}>
            {e.affected?.length} people: {e.affected?.join(", ")}
          </dd>

          <dt>From</dt>
          <dd style={{ gridColumn: "span 2" }}>
            {e.from} ·{" "}
            <span className="gov-rno" style={{ height: 20, fontSize: 11.5 }}>
              entry {e.id}
            </span>
          </dd>
        </dl>
      </div>
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
            className="grp"
            style={{
              padding: "10px 22px",
              ...(gi === 0 ? { borderTop: 0 } : {}),
            }}
          >
            {g.day}
          </div>
          {g.entries.map((e) => {
            const open = openId === e.id;
            const row = (
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : e.id)}
                className="gov-ae"
                style={open ? { borderTop: 0 } : undefined}
              >
                <span className="t">{e.time}</span>
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
                <ActorCell e={e} />
                <Chevron open={open} />
              </button>
            );
            if (open) {
              return (
                <div role="listitem" key={e.id} className="gov-ae-open">
                  {row}
                  {hasDetail(e) ? <EntryDetail e={e} /> : null}
                </div>
              );
            }
            return (
              <div
                role="listitem"
                key={e.id}
                style={{ borderTop: "1px solid var(--rule)" }}
              >
                {row}
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}
