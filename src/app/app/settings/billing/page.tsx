import type { Metadata } from "next";
import Link from "next/link";
import {
  getMember,
  getOrg,
  getRole,
  getSeats,
  roleMemberCount,
} from "@/lib/api";
import { AppShell } from "@/components/Shell";
import { ButtonLink } from "@/components/Button";

export const metadata: Metadata = { title: "Crewspace — Plan and billing" };

/* No invoice or payment-method fixture exists in lib/api.ts — these rows
   use the approved screen's exact copy (Account.html). */
const INVOICES = [
  { date: "Sep 30", for: "50 seats · Oct", amount: "$400.00" },
  { date: "Sep 2", for: "2 seats added mid-August, prorated", amount: "$7.20" },
  { date: "Aug 31", for: "50 seats · Sep", amount: "$400.00" },
  { date: "Jul 31", for: "48 seats · Aug", amount: "$384.00" },
];

const IV_GRID = "110px minmax(0,1fr) 100px 80px";
const tabBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: 40,
  padding: "0 2px",
  borderBottom: "2px solid transparent",
  color: "var(--ink-2)",
  textDecoration: "none",
  fontSize: 14,
};

export default function BillingPage() {
  const org = getOrg();
  const plan = org.plan;
  const seats = getSeats();
  const billingContact = getMember(plan.billingContactId);
  const billingRole = billingContact ? getRole(billingContact.roleId) : undefined;
  const monthly = seats.total * plan.pricePerSeat;
  const money = (n: number) => `$${n.toFixed(2)}`;
  const usedPct = (seats.used / seats.total) * 100;
  const heldPct = (seats.held / seats.total) * 100;

  return (
    <AppShell current="settings">
      <div className="stack" style={{ paddingTop: 22, display: "flex", flexDirection: "column", gap: 6 }}>
        <h1 className="title">Settings</h1>
        <span style={{ fontSize: 14, color: "var(--ink-2)" }}>
          {plan.name}, {plan.seats} seats, renews October 31.{" "}
          {billingContact?.name}, {billingRole?.name}, gets every invoice.
        </span>
      </div>

      <nav
        aria-label="Settings sections"
        style={{ display: "flex", gap: 24, borderBottom: "1px solid var(--frame)" }}
      >
        <Link href="/app/settings" style={tabBase}>
          Organization
        </Link>
        <Link
          href="/app/settings/billing"
          aria-current="page"
          style={{ ...tabBase, color: "var(--ink)", fontWeight: 600, borderBottomColor: "var(--seal)" }}
        >
          Plan and billing
        </Link>
      </nav>

      <div className="cols">
        <div
          style={{
            flex: "999 1 560px",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <section className="sheet" aria-labelledby="st">
            <div
              style={{
                padding: "16px 24px 12px",
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 8,
              }}
            >
              <h2 id="st" className="section">
                Seats
              </h2>
              <ButtonLink href="#">Change seats</ButtonLink>
            </div>
            <div style={{ padding: "0 24px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              <span
                role="img"
                aria-label={`${seats.used} used, ${seats.held} held by invitations, ${seats.free} free, of ${seats.total}`}
                style={{
                  display: "flex",
                  height: 10,
                  borderRadius: 2,
                  overflow: "hidden",
                  background: "var(--fill)",
                }}
              >
                <i style={{ display: "block", height: "100%", width: `${usedPct}%`, background: "var(--seal)" }} />
                <i style={{ display: "block", height: "100%", width: `${heldPct}%`, background: "var(--seal-mid)" }} />
              </span>
              <span style={{ fontSize: 13, color: "var(--ink-2)" }}>
                <b style={{ fontWeight: 600, color: "var(--ink)" }}>{seats.used} used</b>{" "}
                by active members · {seats.held} held by open invitations ·{" "}
                {seats.free} free. Deactivated people don’t use a seat.
              </span>
            </div>
            <div className="ll" style={{ padding: "9px 24px", borderTop: "1px solid var(--rule)", fontSize: 14 }}>
              <span>
                {plan.name} · {plan.seats} seats × ${plan.pricePerSeat}
              </span>
              <i />
              <span className="mono">{money(monthly)} / month</span>
            </div>
            <div className="ll" style={{ padding: "9px 24px", borderTop: "1px solid var(--rule)", fontSize: 14 }}>
              <span>Next invoice</span>
              <i />
              <span>
                {plan.nextInvoice} · <span className="mono">{money(monthly)}</span>
              </span>
            </div>
            <div
              className="ll"
              style={{ padding: "9px 24px 14px", borderTop: "1px solid var(--rule)", fontSize: 14 }}
            >
              <span>If more people accept than you have seats</span>
              <i />
              <span>added at ${plan.pricePerSeat}, prorated</span>
            </div>
          </section>

          <section className="sheet" aria-labelledby="iv" style={{ overflow: "hidden" }}>
            <div
              style={{
                padding: "16px 24px 12px",
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 8,
              }}
            >
              <h2 id="iv" className="section">
                Invoices
              </h2>
              <a href="#" style={{ fontSize: 13 }}>
                Download all
              </a>
            </div>
            <div className="rows-scroll">
              <div role="table" aria-label="Invoices" style={{ minWidth: 520, paddingBottom: 6 }}>
                <div
                  role="row"
                  style={{
                    display: "grid",
                    gridTemplateColumns: IV_GRID,
                    gap: 14,
                    padding: "11px 24px",
                    borderTop: "1px solid var(--rule)",
                    fontSize: 12,
                    color: "var(--muted)",
                    alignItems: "baseline",
                  }}
                >
                  <span role="columnheader">Date</span>
                  <span role="columnheader">For</span>
                  <span role="columnheader">Amount</span>
                  <span role="columnheader">Status</span>
                </div>
                {INVOICES.map((inv) => (
                  <div
                    role="row"
                    key={inv.date + inv.for}
                    style={{
                      display: "grid",
                      gridTemplateColumns: IV_GRID,
                      gap: 14,
                      padding: "11px 24px",
                      borderTop: "1px solid var(--rule)",
                      fontSize: 13,
                      alignItems: "baseline",
                    }}
                  >
                    <span role="cell" className="mono" style={{ fontSize: 12 }}>
                      {inv.date}
                    </span>
                    <span role="cell">{inv.for}</span>
                    <span role="cell" className="mono">
                      {inv.amount}
                    </span>
                    <span role="cell" style={{ fontSize: 12, fontWeight: 600, color: "var(--active)" }}>
                      Paid
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <aside className="side-col">
          <section
            className="sheet panel-box"
            aria-labelledby="pm"
            style={{ fontSize: 13, lineHeight: 1.5 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h2 id="pm" className="panel">
                Payment
              </h2>
              <a href="#">Update</a>
            </div>
            <span>
              Visa ending <span className="mono">1187</span>, expires 04/28
            </span>
            <span style={{ color: "var(--ink-2)" }}>
              Invoices go to {billingContact?.email}
            </span>
            <span style={{ color: "var(--muted)" }}>
              Billing address: {org.name}, Philadelphia, PA
            </span>
          </section>

          <section
            className="sheet panel-box"
            aria-labelledby="wh"
            style={{ fontSize: 13, lineHeight: 1.5, color: "var(--ink-2)" }}
          >
            <h2 id="wh" className="panel" style={{ color: "var(--ink)" }}>
              Who can see this
            </h2>
            <span>
              You and {billingContact?.name.split(" ")[0]} ({billingRole?.name}) can
              change it. {roleMemberCount("analyst")} Analysts and{" "}
              {roleMemberCount("finance-viewer")} Finance viewers can view it.
              Product admins can’t.
            </span>
          </section>

          <section
            className="sheet panel-box"
            aria-labelledby="dz"
            style={{ fontSize: 13, lineHeight: 1.5, borderColor: "var(--deny-line)" }}
          >
            <h2 id="dz" className="panel">
              Close the organization
            </h2>
            <span style={{ color: "var(--ink-2)" }}>
              Everyone loses access at once. The register and audit log are
              kept for 30 days, then deleted. Billing stops at the end of the
              month.
            </span>
            <span>
              <ButtonLink variant="dest" href="#">
                Close {org.name}
              </ButtonLink>
            </span>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
