import type { Metadata } from "next";
import Link from "next/link";
import { getOrg, getSeats, roleMemberCount } from "@/lib/api";
import { loadActiveWorkspaceData } from "@/lib/data/server";
import { AppShell } from "@/components/Shell";
import { Button } from "@/components/Button";

export const metadata: Metadata = { title: "Crewspace — Plan and billing" };

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

/**
 * Plan and billing. All numbers are real: seat counts come from the
 * workspace's memberships and open invitations, and the price is the
 * configured organizations.seat_price_cents (edited in Settings —
 * never hard-coded here). There is no invoice or payment-method
 * storage in the schema yet, so those panels say so instead of
 * showing invented history.
 */
export default async function BillingPage() {
  const data = await loadActiveWorkspaceData();
  if (!data) {
    return <AppShell current="settings">{null}</AppShell>;
  }
  const org = getOrg(data);
  const plan = org.plan;
  const seats = getSeats(data);
  const money = (n: number) => `$${n.toFixed(2)}`;
  /* Charged seats are the people actually seated (active members);
     held invitations aren't charged until they accept. */
  const monthly = seats.used * plan.pricePerSeat;
  const denom = Math.max(seats.used + seats.held, 1);
  const usedPct = (seats.used / denom) * 100;
  const heldPct = (seats.held / denom) * 100;

  const analysts = data.org.roles.find((r) => r.name === "Analyst");
  const financeViewers = data.org.roles.find(
    (r) => r.name === "Finance viewer",
  );

  return (
    <AppShell current="settings">
      <div className="gov-head">
        <div className="stack">
          <h1 className="gov-title">Settings</h1>
          <p className="gov-lede">
            {seats.used} seats in use at {money(plan.pricePerSeat)} a seat.{" "}
            {seats.held} more held by open invitations — they’re charged
            only when people accept.
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
              extra={
                <Link href="/app/settings" style={{ fontSize: 13, fontWeight: 600 }}>
                  Change price per seat
                </Link>
              }
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
                aria-label={`${seats.used} used, ${seats.held} held by invitations`}
                className="gov-seatbar"
              >
                <i className="used" style={{ width: `${usedPct}%` }} />
                <i className="held" style={{ width: `${heldPct}%` }} />
              </span>
              <span style={{ fontSize: 13, lineHeight: 1.5, color: "var(--ink-2)" }}>
                <b style={{ fontWeight: 600, color: "var(--ink)" }}>
                  {seats.used} used
                </b>{" "}
                by active members · {seats.held} held by open invitations.
                Deactivated people don’t use a seat.
              </span>
            </div>
            <div className="gov-ll2">
              <span>
                {seats.used} seats × {money(plan.pricePerSeat)}
              </span>
              <i />
              <span className="mono">{money(monthly)} / month</span>
            </div>
            <div className="gov-ll2" style={{ paddingBottom: 16 }}>
              <span>If more people accept</span>
              <i />
              <span>added at {money(plan.pricePerSeat)}, prorated</span>
            </div>
          </section>

          <section className="card" aria-labelledby="iv" style={{ overflow: "hidden" }}>
            <CardHead id="iv" title="Invoices" />
            <p
              style={{
                margin: 0,
                padding: "0 22px 20px",
                fontSize: 13.5,
                lineHeight: 1.55,
                color: "var(--ink-2)",
              }}
            >
              No invoices yet. When billing runs for {org.name}, invoices
              will appear here with their amounts and status.
            </p>
          </section>
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <section
            className="dpanel"
            aria-labelledby="pm"
            style={{ fontSize: 13, lineHeight: 1.5, gap: 10 }}
          >
            <h2 id="pm">Payment</h2>
            <span style={{ color: "#c9d0da" }}>
              No payment method on file. Add one before the first invoice
              is due.
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
              People whose role allows “See billing”
              {analysts
                ? ` — ${roleMemberCount(data, analysts.id)} Analysts`
                : ""}
              {financeViewers
                ? ` and ${roleMemberCount(data, financeViewers.id)} Finance viewers`
                : ""}{" "}
              can view it. Changing the price takes the settings
              permission, in Settings.
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
              kept for 30 days, then deleted. Billing stops at the end of
              the month.
            </span>
            <span>
              <Button
                variant="dest"
                className="gov-dng"
                disabled
                title="Closing an organization isn't available yet"
                style={{ background: "var(--sheet)" }}
              >
                Close {org.name}
              </Button>
            </span>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
