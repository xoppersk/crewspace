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
import { FocusedShell } from "@/components/Shell";
import { WizardSteps } from "@/components/WizardSteps";
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

  const mapping = getImportMapping();
  const extraSeats = counts.seatsNeeded - seats.total;

  return (
    <FocusedShell
      flowName="Import members"
      cancelLabel="Cancel and go back to invitations"
      cancelHref="/app/invitations"
    >
      <WizardSteps
        steps={[
          { n: "1", name: "Upload", summary: getImportFileName(), state: "done" },
          { n: "2", name: "Check", summary: `${total} rows read`, state: "current" },
          { n: "3", name: "Send", summary: "", state: "todo" },
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
          <h1 className="title">
            {counts.ready} ready, {counts.fix} to fix, {counts.skipped} skipped
          </h1>
          <p className="lead">
            Nothing is sent yet. Fix the {counts.fix} rows below or leave them
            out; the {counts.ready} ready rows go out together when you send.
          </p>
        </div>

        <section className="sheet" aria-labelledby="fx" style={{ overflow: "hidden" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 8,
              padding: "16px 24px 12px",
            }}
          >
            <h2 id="fx" className="section">
              Needs a decision
            </h2>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>
              {decisionRows.length} of {total} rows
            </span>
          </div>
          <div className="rows-scroll">
            <DecisionRows rows={decisionRows} />
          </div>
        </section>

        <section className="sheet" aria-labelledby="rd" style={{ padding: "16px 24px 12px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 8,
              paddingBottom: 6,
            }}
          >
            <h2 id="rd" className="section">
              Ready · {counts.ready}
            </h2>
            <a href="#" style={{ fontSize: 13 }}>
              See all {counts.ready}
            </a>
          </div>
          {breakdownRows.map(([label, n]) => (
            <div className="ll" key={label}>
              <span>{label}</span>
              <i />
              <span className="mono">{n}</span>
            </div>
          ))}
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
        <section className="sheet panel-box flush" aria-labelledby="mp">
          <h2 id="mp" className="panel">
            How your columns were read
          </h2>
          <div>
            {mapping.map((m) => (
              <div
                key={m.from}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr) 20px minmax(0,1fr)",
                  gap: 10,
                  alignItems: "center",
                  padding: "8px 0",
                  fontSize: 13,
                  borderTop: "1px solid var(--rule)",
                }}
              >
                <span className="mono" style={{ fontSize: 12 }}>
                  {m.from}
                </span>
                <span aria-hidden="true">→</span>
                <span style={m.to === "Not used" ? { color: "var(--muted)" } : undefined}>
                  {m.to}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section
          className="sheet panel-box"
          aria-labelledby="se"
          style={{ fontSize: 13, lineHeight: 1.5 }}
        >
          <h2 id="se" className="panel">
            Seats
          </h2>
          <span style={{ color: "var(--ink-2)" }}>
            {seats.used} seats are used and {seats.held} are held by open
            invitations. Sending these {counts.ready} would need{" "}
            <b style={{ fontWeight: 600, color: "var(--ink)" }}>
              {counts.seatsNeeded} of your {seats.total}
            </b>
            .
          </span>
          <span style={{ color: "var(--ink-2)" }}>
            {extraSeats} seats are added only when people accept, at $
            {org.plan.pricePerSeat} a month each, prorated to {org.plan.renews}.
          </span>
          <Link href="/app/settings/billing">Plan and billing</Link>
        </section>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <ButtonLink size="h40" href="/app/invitations">
            Back
          </ButtonLink>
          <ButtonLink
            size="h40"
            variant="pri"
            href="/app/invitations"
            style={{ flex: 1 }}
          >
            Send {counts.ready} invitations
          </ButtonLink>
        </div>
      </aside>
    </FocusedShell>
  );
}
