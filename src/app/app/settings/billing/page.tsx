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

function CardHead({
  id,
  title,
  extra,
}: {
  id: string;
  title: string;
  extra?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        padding: "18px 22px",
      }}
    >
      <h2 id={id} style={{ margin: 0, font: "700 17px/1.2 var(--font-sans)" }}>
        {title}
      </h2>
      {extra}
    </div>
  );
}

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
  const freePct = (seats.free / seats.total) * 100;

  return (
    <AppShell current="settings">
      <div className="gov-head">
        <div className="stack">
          <h1 className="gov-title">Settings</h1>
          <p className="gov-lede">
            {plan.name}, {plan.seats} seats, renews October 31.{" "}
            {billingContact?.name}, {billingRole?.name}, gets every invoice.
          </p>
        </div>
      </div>

      <nav aria-label="Settings sections" className="gov-tabs">
        <Link href="/app/settings">Organization</Link>
        <Link href="/app/settings/billing" aria-current="page">
          Plan and billing
        </Link>
      </nav>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 340px",
          gap: 20,
          alignItems: "start",
        }}
        className="gov-inv-cols"
      >
        <div
          style={{
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <section className="card" aria-labelledby="st" style={{ overflow: "hidden" }}>
            <CardHead
              id="st"
              title="Seats"
              extra={<ButtonLink href="#">Change seats</ButtonLink>}
            />
            <div
              style={{
                padding: "0 22px 18px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <span
                role="img"
                aria-label={`${seats.used} used, ${seats.held} held by invitations, ${seats.free} free, of ${seats.total}`}
                className="gov-seatbar"
              >
                <i className="used" style={{ width: `${usedPct}%` }} />
                <i className="held" style={{ width: `${heldPct}%` }} />
                <i className="free" style={{ width: `${freePct}%` }} />
              </span>
              <span style={{ fontSize: 13, lineHeight: 1.5, color: "var(--ink-2)" }}>
                <b style={{ fontWeight: 600, color: "var(--ink)" }}>
                  {seats.used} used
                </b>{" "}
                by active members · {seats.held} held by open invitations ·{" "}
                {seats.free} free. Deactivated people don’t use a seat.
              </span>
            </div>
            <div className="gov-ll2">
              <span>
                {plan.name} · {plan.seats} seats × ${plan.pricePerSeat}
              </span>
              <i />
              <span className="mono">{money(monthly)} / month</span>
            </div>
            <div className="gov-ll2">
              <span>Next invoice</span>
              <i />
              <span>
                {plan.nextInvoice} · <span className="mono">{money(monthly)}</span>
              </span>
            </div>
            <div className="gov-ll2" style={{ paddingBottom: 16 }}>
              <span>If more people accept than you have seats</span>
              <i />
              <span>added at ${plan.pricePerSeat}, prorated</span>
            </div>
          </section>

          <section className="card" aria-labelledby="iv" style={{ overflow: "hidden" }}>
            <CardHead
              id="iv"
              title="Invoices"
              extra={
                <a
                  href="#"
                  style={{
                    display: "inline-flex",
                    gap: 6,
                    alignItems: "center",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                  >
                    <path d="M8 2.5v8M4.8 7.5 8 10.7l3.2-3.2" />
                    <path d="M2.5 12.5h11" />
                  </svg>
                  Download all
                </a>
              }
            />
            <div className="rows-scroll">
              <div role="table" className="tbl-stack" aria-label="Invoices" style={{ minWidth: 520 }}>
                <div role="row" className="gov-iv head">
                  <span role="columnheader">Date</span>
                  <span role="columnheader">For</span>
                  <span role="columnheader" className="amt">
                    Amount
                  </span>
                  <span role="columnheader">Status</span>
                </div>
                {INVOICES.map((inv) => (
                  <div role="row" className="gov-iv" key={inv.date + inv.for}>
                    <span
                      role="cell"
                      className="mono"
                      style={{ fontSize: 12, color: "var(--ink-2)" }}
                    >
                      {inv.date}
                    </span>
                    <span role="cell">{inv.for}</span>
                    <span role="cell" className="mono amt">
                      {inv.amount}
                    </span>
                    <span role="cell">
                      <span className="gov-st ok">Paid</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section
            className="dpanel"
            aria-labelledby="pm"
            style={{ fontSize: 13, lineHeight: 1.5, gap: 10 }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
              }}
            >
              <h2 id="pm">Payment</h2>
              <a
                href="#"
                style={{ fontWeight: 600, color: "var(--panel-allow)" }}
              >
                Update
              </a>
            </div>
            <div
              className="dchg"
              style={{ display: "flex", gap: 12, alignItems: "center" }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 16 16"
                fill="none"
                stroke="var(--panel-allow)"
                strokeWidth="1.4"
                aria-hidden="true"
                style={{ flex: "none" }}
              >
                <rect x="1.8" y="3.5" width="12.4" height="9" rx="1.5" />
                <path d="M1.8 6.5h12.4M4.5 10h2.5" />
              </svg>
              <span>
                Visa ending <span className="mono">1187</span>, expires 04/28
              </span>
            </div>
            <span style={{ color: "#c9d0da" }}>
              Invoices go to {billingContact?.email}
            </span>
            <span style={{ color: "var(--panel-muted)" }}>
              Billing address: {org.name}, Philadelphia, PA
            </span>
          </section>

          <section
            className="card"
            aria-labelledby="wh"
            style={{
              padding: 18,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              fontSize: 13,
              lineHeight: 1.5,
              color: "var(--ink-2)",
            }}
          >
            <h2
              id="wh"
              style={{
                margin: 0,
                font: "700 15px/1.3 var(--font-sans)",
                color: "var(--ink)",
              }}
            >
              Who can see this
            </h2>
            <span>
              You and {billingContact?.name.split(" ")[0]} ({billingRole?.name})
              can change it. {roleMemberCount("analyst")} Analysts and{" "}
              {roleMemberCount("finance-viewer")} Finance viewers can view it.
              Product admins can’t.
            </span>
          </section>

          <section className="gov-close" aria-labelledby="dz">
            <h2
              id="dz"
              style={{ margin: 0, font: "700 15px/1.3 var(--font-sans)" }}
            >
              Close the organization
            </h2>
            <span style={{ color: "var(--ink-2)" }}>
              Everyone loses access at once. The register and audit log are
              kept for 30 days, then deleted. Billing stops at the end of the
              month.
            </span>
            <span>
              <ButtonLink
                variant="dest"
                className="gov-dng"
                href="#"
                style={{ background: "var(--sheet)" }}
              >
                Close {org.name}
              </ButtonLink>
            </span>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
