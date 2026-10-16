import type { Metadata } from "next";
import Link from "next/link";
import {
  getImportFileName,
  getImportMapping,
  getImportRows,
  getOrg,
  getSeats,
  importCounts,
} from "@/lib/api";
import { AppShell } from "@/components/Shell";
import { ButtonLink } from "@/components/Button";
import { DecisionRows } from "./DecisionRows";

export const metadata: Metadata = {
  title: "Crewspace — Import members: check",
};

export default function CsvImportPage() {
  const org = getOrg();
  const counts = importCounts();
  const seats = getSeats();
  const rows = getImportRows();
  const total = rows.length;
  /* Screen order: the fix rows first (6, 11), then the skipped row (9) —
     not a plain row-number sort. */
  const decisionRows = [
    ...rows.filter((r) => r.status === "fix").sort((a, b) => a.row - b.row),
    ...rows.filter((r) => r.status === "skipped").sort((a, b) => a.row - b.row),
  ];
  const readyRows = rows.filter((r) => r.status === "ready");

  /* Ready breakdown by role + team, derived from the fixture rows. */
  const breakdown = new Map<string, number>();
  for (const r of readyRows) {
    const key = `${r.role}, ${r.team}`;
    breakdown.set(key, (breakdown.get(key) ?? 0) + 1);
  }
  const breakdownRows = [...breakdown.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  const maxBreakdown = Math.max(...breakdownRows.map(([, n]) => n), 1);

  const mapping = getImportMapping();
  const extraSeats = counts.seatsNeeded - seats.total;

  return (
    <AppShell current="invitations">
      <div className="gov-crumb-row">
        <span>Import members</span>
        <Link href="/app/invitations">Cancel and go back to invitations</Link>
      </div>

      <nav aria-label="Steps" className="card gov-steps">
        <div className="stp done">
          <span className="sr-only">Step 1</span>
          <span className="n" aria-hidden="true">
            <svg
              width="13"
              height="13"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 8.5l3 3 7-7" />
            </svg>
          </span>
          <span className="stp-text">
            <b>Upload</b>
            <br />
            <span className="stp-file">{getImportFileName()}</span>
          </span>
        </div>
        <div className="stp current" aria-current="step">
          <span className="n">2</span>
          <span className="stp-text">
            <b>Check</b>
            <br />
            <span className="stp-sub">{total} rows read</span>
          </span>
        </div>
        <div className="stp todo">
          <span className="n">3</span>
          <span className="stp-text">Send</span>
        </div>
      </nav>

      <div
        style={{
          flex: "999 1 820px",
          minWidth: 0,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 340px",
          gap: 20,
          alignItems: "start",
        }}
        className="gov-inv-cols"
      >
        <main
          style={{
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: "8px 0 2px",
            }}
          >
            <h1 className="gov-title">
              {counts.ready} ready, {counts.fix} to fix, {counts.skipped} skipped
            </h1>
            <p className="gov-lede">
              Nothing is sent yet. Fix the {counts.fix} rows below or leave them
              out; the {counts.ready} ready rows go out together when you send.
            </p>
          </div>

          <section className="card" aria-labelledby="fx" style={{ overflow: "hidden" }}>
            <div className="gov-sheet-head" style={{ padding: "18px 22px" }}>
              <h2 id="fx">Needs a decision</h2>
              <span
                className="spacer"
                style={{ fontSize: 12.5, color: "var(--muted)" }}
              >
                {decisionRows.length} of {total} rows
              </span>
            </div>
            <div className="rows-scroll">
              <DecisionRows rows={decisionRows} />
            </div>
          </section>

          <section
            className="card"
            aria-labelledby="rd"
            style={{ padding: "18px 22px 10px" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 8,
                paddingBottom: 8,
              }}
            >
              <h2
                id="rd"
                style={{ margin: 0, font: "700 17px/1.2 var(--font-sans)" }}
              >
                Ready · {counts.ready}
              </h2>
              <a href="#" style={{ fontSize: 13, fontWeight: 600 }}>
                See all {counts.ready}
              </a>
            </div>
            {breakdownRows.map(([label, n]) => (
              <div className="gov-ready-row" key={label}>
                <span>{label}</span>
                <span className="track" aria-hidden="true">
                  <i style={{ width: `${(n / maxBreakdown) * 100}%` }} />
                </span>
                <span className="n">{n}</span>
              </div>
            ))}
          </section>
        </main>

        <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section
            className="card"
            aria-labelledby="mp"
            style={{ padding: "18px 18px 8px" }}
          >
            <h2
              id="mp"
              style={{
                margin: "0 0 8px",
                font: "700 15px/1.3 var(--font-sans)",
              }}
            >
              How your columns were read
            </h2>
            <div>
              {mapping.map((m) => (
                <div className="gov-mp" key={m.from}>
                  <span className="gov-rno">{m.from}</span>
                  <span aria-hidden="true" style={{ color: "var(--muted)" }}>
                    →
                  </span>
                  <span
                    style={m.to === "Not used" ? { color: "var(--muted)" } : undefined}
                  >
                    {m.to}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section
            className="dpanel"
            aria-labelledby="se"
            style={{ fontSize: 13, lineHeight: 1.5, gap: 12 }}
          >
            <h2 id="se">Seats</h2>
            <span style={{ color: "var(--panel-muted)" }}>
              {seats.used} seats are used and {seats.held} are held by open
              invitations. Sending these {counts.ready} would need{" "}
              <b style={{ fontWeight: 600, color: "var(--panel-deny)" }}>
                {counts.seatsNeeded} of your {seats.total}
              </b>
              .
            </span>
            <div className="dchg" style={{ color: "#c9d0da" }}>
              {extraSeats} seats are added only when people accept, at $
              {org.plan.pricePerSeat} a month each, prorated to {org.plan.renews}.
            </div>
            <Link
              href="/app/settings/billing"
              style={{ fontWeight: 600, color: "var(--panel-allow)" }}
            >
              Plan and billing
            </Link>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1.8fr",
                gap: 8,
                paddingTop: 4,
              }}
            >
              <ButtonLink size="h40" variant="on-dark" href="/app/invitations">
                Back
              </ButtonLink>
              <ButtonLink size="h40" variant="white" href="/app/invitations">
                Send {counts.ready} invitations
              </ButtonLink>
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
