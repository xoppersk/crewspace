import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { auditTotals, getAuditEntries, getMember } from "@/lib/api";
import { loadActiveWorkspaceData } from "@/lib/data/server";
import { AppShell } from "@/components/Shell";
import { ButtonLink } from "@/components/Button";
import { AuditFilters } from "./AuditFilters";
import { AuditList } from "./AuditList";
import type { AuditEntryExt, AuditEntryView } from "./auditView";

export const metadata: Metadata = { title: "Crewspace — Audit log" };

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; who?: string; kind?: string; range?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const who = sp.who ?? "all";
  const kind = sp.kind ?? "access";
  const range = sp.range ?? "7";
  const data = await loadActiveWorkspaceData();
  if (!data) {
    return <AppShell current="audit">{null}</AppShell>;
  }
  const totals = auditTotals(data);
  /* Range filters are relative to the real current date. */
  const today = new Date();

  const all = getAuditEntries(data) as AuditEntryExt[];

  /* "Done by" options: the actors in this log, named from real members. */
  const whoOptions = [
    ...new Map(
      all.map((e) => [
        e.actorId,
        e.actorId === "system"
          ? "System"
          : (getMember(data, e.actorId)?.name ?? e.actorId),
      ]),
    ).entries(),
  ].map(([value, label]) => ({ value, label }));

  function inRange(e: AuditEntryExt): boolean {
    const d = new Date(`${e.dateISO}T12:00:00`);
    if (Number.isNaN(d.getTime())) return true;
    if (range === "quarter") {
      return (
        d.getFullYear() === today.getFullYear() &&
        Math.floor(d.getMonth() / 3) === Math.floor(today.getMonth() / 3)
      );
    }
    const days = (today.getTime() - d.getTime()) / 86400000;
    return days >= 0 && days <= (range === "30" ? 30 : 7);
  }
  function kindMatches(e: AuditEntryExt): boolean {
    switch (kind) {
      case "all":
        return true;
      case "roles":
        /* Role changes only: the subset of access entries that changed a
           role or someone's role in it (fixture `roleChange` flag). */
        return e.roleChange === true;
      case "invitations":
        return e.category === "invitation";
      case "sessions":
        return e.category === "session" || e.kind === "sign-in";
      case "access":
      default:
        return e.kind === "access";
    }
  }

  const filtered = all.filter(
    (e) =>
      kindMatches(e) &&
      inRange(e) &&
      (who === "all" || e.actorId === who) &&
      (!q || e.summary.toLowerCase().includes(q.toLowerCase())),
  );

  /* Group by day, newest day first; entries newest first within the day. */
  const byDay = new Map<string, AuditEntryExt[]>();
  for (const e of filtered) {
    const list = byDay.get(e.day) ?? [];
    list.push(e);
    byDay.set(e.day, list);
  }
  const groups: { day: string; entries: AuditEntryView[] }[] = [...byDay.entries()]
    .map(([day, entries]) => ({
      day,
      dateISO: entries[0]!.dateISO,
      entries: [...entries].sort((a, b) => b.time.localeCompare(a.time)),
    }))
    .sort((a, b) => b.dateISO.localeCompare(a.dateISO))
    .map(({ day, entries }) => ({
      day,
      entries: entries.map(
        (e): AuditEntryView => ({
          ...e,
          actorName:
            e.actorId === "system"
              ? "System"
              : (getMember(data, e.actorId)?.name ?? e.actorId),
        }),
      ),
    }));

  return (
    <AppShell current="audit">
      <div className="gov-head">
        <div className="stack">
          <h1 className="gov-title">Audit log</h1>
          <p className="gov-lede" style={{ maxWidth: 680 }}>
            Every change to people, roles, teams, invitations and settings,
            with who did it and what it was before. Entries can’t be edited or
            deleted and are kept for 2 years.
          </p>
        </div>
        <div className="head-actions">
          <ButtonLink href="#">
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M8 2.5v8M4.8 7.5 8 10.7l3.2-3.2" />
              <path d="M2.5 12.5h11" />
            </svg>
            Export these {totals.accessChanges} entries
          </ButtonLink>
        </div>
      </div>

      <section className="card" style={{ overflow: "hidden" }}>
        <div
          role="search"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
            padding: "14px 22px",
          }}
        >
          <Suspense fallback={null}>
            <AuditFilters q={q} who={who} kind={kind} range={range} whoOptions={whoOptions} />
          </Suspense>
          <span
            className="mono"
            style={{
              marginLeft: "auto",
              fontSize: 12,
              color: "var(--muted)",
            }}
          >
            {totals.accessChanges} access changes · {totals.entries} entries
            with sign-ins
          </span>
        </div>

        <div className="rows-scroll">
          <div
            role="list"
            className="tbl-stack"
            aria-label="Audit entries"
            style={{ minWidth: 680, borderTop: "1px solid var(--rule-strong)" }}
          >
            <AuditList groups={groups} />
            {filtered.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  padding: "16px 22px",
                  fontSize: 13,
                  color: "var(--muted)",
                }}
              >
                No entries match these filters.
              </p>
            ) : (
              <div className="gov-audit-foot">
                {range === "7" ? (
                  <>
                    That’s everything for the last 7 days.{" "}
                    <Link href="/app/audit?range=30" style={{ fontWeight: 600 }}>
                      Show the 30 days before
                    </Link>
                  </>
                ) : range === "30" ? (
                  <>That’s everything for the last 30 days.</>
                ) : (
                  <>That’s everything for this quarter.</>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
