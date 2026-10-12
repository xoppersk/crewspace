import Link from "next/link";
import {
  deactivateScopeCount,
  getRole,
  roleMemberCount,
} from "@/lib/api";
import { ButtonLink } from "@/components/Button";

/**
 * F-01 — Marketing. Public page, always light.
 * NOTE: the header is composed here from the shared public classes,
 * exactly as the screen shows it (How it works · Security · Pricing ·
 * Docs / Sign in / Start your register). The shared PublicHeader
 * marketing variant renders the same header.
 */
export default function MarketingPage() {
  const role = getRole("product-admin")!;
  const members = roleMemberCount(role.id);
  const scope = deactivateScopeCount();

  /* The hero fragment is drawn statically, at the Marketing screen's
   * own metrics and with that screen's own permission wording — it is
   * not the interactive app PermissionRow. */
  const fragRow = {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 210px 120px",
    gap: 16,
    alignItems: "center",
    padding: "11px 20px",
    borderTop: "1px solid var(--rule)",
    fontSize: 13,
  } as const;
  const fragName = {
    display: "block",
    fontSize: 14,
    fontWeight: 600,
  } as const;
  const fragSmall = {
    display: "block",
    fontSize: 12,
    color: "var(--muted)",
    marginTop: 2,
  } as const;
  const fragSeg = {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    border: "1px solid var(--frame)",
    borderRadius: 6,
    padding: 2,
    gap: 2,
  } as const;
  const fragSegSpan = {
    height: 28,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    color: "var(--muted)",
    fontSize: 12,
  } as const;
  const fragSegA = {
    ...fragSegSpan,
    background: "var(--seal)",
    color: "var(--on-seal)",
    fontWeight: 600,
  } as const;
  const fragSegD = {
    ...fragSegSpan,
    color: "var(--deny)",
    fontWeight: 600,
    boxShadow: "inset 0 0 0 1.5px var(--deny)",
  } as const;

  return (
    <div className="pub">
      <header
        className="pub-head pub-wrap"
        style={{ maxWidth: 1200, paddingTop: 20, paddingBottom: 20 }}
      >
        <Link href="/" className="wordmark">
          Crewspace
        </Link>
        <nav
          aria-label="Main"
          className="pub-nav"
          style={{ gap: 28, fontSize: 15 }}
        >
          <Link href="#how">How it works</Link>
          <Link href="#">Security</Link>
          <Link href="#">Pricing</Link>
          <Link href="#">Docs</Link>
        </nav>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link
            href="/signin"
            style={{
              color: "var(--ink-2)",
              textDecoration: "none",
              fontSize: 15,
            }}
          >
            Sign in
          </Link>
          <ButtonLink
            variant="pri"
            size="h40"
            href="/signup"
            style={{ fontSize: 15 }}
          >
            Start your register
          </ButtonLink>
        </div>
      </header>

      {/* Hero + live product fragment */}
      <section
        className="pub-wrap"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 56,
          alignItems: "center",
          paddingTop: 56,
          paddingBottom: 72,
        }}
      >
        <div
          style={{
            flex: "1 1 440px",
            display: "flex",
            flexDirection: "column",
            gap: 22,
          }}
        >
          <h1 className="display">Access everyone can explain.</h1>
          <p
            style={{
              margin: 0,
              maxWidth: "30em",
              fontSize: 19,
              lineHeight: 1.55,
              color: "var(--ink-2)",
            }}
          >
            Crewspace keeps one register of who’s in your organization, what
            their role lets them do, and every change to it, written in
            sentences people can read.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <ButtonLink
              variant="pri"
              size="h44"
              href="/signup"
              style={{ fontSize: 15 }}
            >
              Start your register
            </ButtonLink>
            <ButtonLink size="h44" href="#how" style={{ fontSize: 15 }}>
              See how a change happens
            </ButtonLink>
          </div>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            Sign in with Google. Invite people from a list or a CSV.
          </span>
        </div>

        <figure
          aria-label="Product fragment: three permissions on the Product admin role"
          style={{
            flex: "1 1 520px",
            margin: 0,
            background: "var(--ground)",
            borderRadius: 12,
            padding: 28,
          }}
        >
          <div
            className="sheet"
            style={{ overflow: "hidden" }}
            role="table"
            aria-label="Product admin permissions"
          >
            <div
              style={{
                padding: "16px 20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 10,
              }}
            >
              <b style={{ fontSize: 17 }}>{role.name}</b>
              <span className="register">
                {role.regNumber} · {members} members
              </span>
            </div>
            <div style={fragRow}>
              <span>
                <b style={fragName}>Invite members</b>
                <small style={fragSmall}>
                  Can invite people and pick their first role.
                </small>
              </span>
              <span style={fragSeg}>
                <span style={fragSegA}>Allow</span>
                <span style={fragSegSpan}>Deny</span>
                <span style={fragSegSpan}>Inherit</span>
              </span>
              <span>Allowed</span>
            </div>
            {/* The pending change: Deny → Allow. The name cell carries
              * only the "Changed" line, as the Marketing screen draws it. */}
            <div
              style={{ ...fragRow, background: "var(--sheet-tint)" }}
            >
              <span>
                <b style={fragName}>Deactivate members</b>
                <small
                  style={{
                    ...fragSmall,
                    color: "var(--seal)",
                    fontWeight: 600,
                  }}
                >
                  Changed · was Deny
                </small>
              </span>
              <span style={fragSeg}>
                <span style={fragSegA}>Allow</span>
                <span style={fragSegSpan}>Deny</span>
                <span style={fragSegSpan}>Inherit</span>
              </span>
              <span>
                Allowed
                <small style={fragSmall}>{scope} people in scope</small>
              </span>
            </div>
            <div style={fragRow}>
              <span>
                <b style={fragName}>Export audit records</b>
                <small style={fragSmall}>
                  Can download the audit archive.
                </small>
              </span>
              <span style={fragSeg}>
                <span style={fragSegSpan}>Allow</span>
                <span style={fragSegD}>Deny</span>
                <span style={fragSegSpan}>Inherit</span>
              </span>
              <span style={{ color: "var(--muted)" }}>Blocked</span>
            </div>
            <div
              style={{
                padding: "12px 20px",
                background: "var(--ink-bar)",
                color: "var(--on-seal)",
                fontSize: 13,
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <span>
                <b style={{ fontWeight: 600 }}>1 change ready</b> · affects{" "}
                {members} members
              </span>
              <Link
                href="/app/roles/product-admin"
                style={{ color: "var(--on-seal)" }}
              >
                Review changes
              </Link>
            </div>
          </div>
          <figcaption
            style={{ marginTop: 14, fontSize: 13, color: "var(--muted)" }}
          >
            Every setting shows what it actually does, and nothing applies
            until someone reviews it.
          </figcaption>
        </figure>
      </section>

      {/* Principles */}
      <section
        className="pub-wrap"
        style={{
          paddingBottom: 80,
          display: "flex",
          flexWrap: "wrap",
          gap: 32,
        }}
      >
        {[
          {
            h: "Every permission says what it does",
            p: "“Allowed”, “Blocked, from baseline”, “36 people in scope.” No grid of ticks to decode, no guessing what Inherit means today.",
          },
          {
            h: "Roles grant. Teams organize.",
            p: "Move someone between teams without changing what they can do. Change a role and see exactly who gains or loses what.",
          },
          {
            h: "Nothing changes silently",
            p: "Changes wait for review, people are told by email, and the audit log keeps the before and after for two years.",
          },
        ].map((x) => (
          <div
            key={x.h}
            style={{
              flex: "1 1 260px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              paddingTop: 18,
              borderTop: "2px solid var(--ink)",
            }}
          >
            <h3
              style={{
                margin: 0,
                font: "700 19px/1.25 var(--font-sans)",
              }}
            >
              {x.h}
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: 15,
                lineHeight: 1.6,
                color: "var(--ink-2)",
              }}
            >
              {x.p}
            </p>
          </div>
        ))}
      </section>

      {/* How a change happens */}
      <section
        id="how"
        style={{ background: "var(--ground)", padding: "80px 0" }}
      >
        <div
          className="pub-wrap"
          style={{ display: "flex", flexDirection: "column", gap: 28 }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              maxWidth: "44em",
            }}
          >
            <h2 className="public-h2">How a change happens</h2>
            <p
              style={{
                margin: 0,
                fontSize: 17,
                lineHeight: 1.6,
                color: "var(--ink-2)",
              }}
            >
              One person joining, from invitation to the permanent record.
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {[
              {
                n: "01 · Invite",
                h: "Appointment issued",
                p: "Maya Jordan, invited as Product admin to the Product team.",
              },
              {
                n: "02 · Accept",
                h: "Identity verified",
                p: "She signs in with the exact work address the invitation named.",
              },
              {
                n: "03 · Assign",
                h: "Access active",
                p: "Product admin applies to Member 042. She can see why, in plain words.",
              },
              {
                n: "04 · Audit",
                h: "Permanent record",
                p: "“Product admin applied to Maya Jordan, Member 042.” Can’t be edited.",
              },
            ].map((s) => (
              <div
                key={s.n}
                className="sheet"
                style={{
                  flex: "1 1 200px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  padding: "18px 20px",
                }}
              >
                <b
                  className="mono"
                  style={{
                    font: "500 12px/1 var(--font-mono)",
                    color: "var(--seal)",
                  }}
                >
                  {s.n}
                </b>
                <span style={{ fontWeight: 600 }}>{s.h}</span>
                <span
                  style={{
                    fontSize: 14,
                    color: "var(--ink-2)",
                    lineHeight: 1.5,
                  }}
                >
                  {s.p}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section
        className="pub-wrap"
        style={{
          paddingTop: 80,
          paddingBottom: 80,
          display: "flex",
          flexWrap: "wrap",
          gap: 48,
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            flex: "1 1 380px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <h2 className="public-h2">
            Built for the people who answer “who can do that?”
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 17,
              lineHeight: 1.6,
              color: "var(--ink-2)",
            }}
          >
            Founders, operations leads and security reviewers who need a
            straight answer in under a minute.
          </p>
        </div>
        <dl
          style={{
            flex: "1 1 480px",
            margin: 0,
            display: "grid",
            gridTemplateColumns: "200px minmax(0, 1fr)",
            gap: "16px 24px",
            fontSize: 15,
            lineHeight: 1.55,
          }}
        >
          <dt style={{ fontWeight: 700 }}>18 permissions</dt>
          <dd style={{ margin: 0, color: "var(--ink-2)" }}>
            in 8 groups, each with a one-sentence description.
          </dd>
          <dt style={{ fontWeight: 700 }}>Custom roles</dt>
          <dd style={{ margin: 0, color: "var(--ink-2)" }}>
            copied from a safe starting point and reviewed before they exist.
          </dd>
          <dt style={{ fontWeight: 700 }}>Drawers, not pop-ups</dt>
          <dd style={{ margin: 0, color: "var(--ink-2)" }}>
            open a person without losing your place in the list.
          </dd>
          <dt style={{ fontWeight: 700 }}>Plain-language audit</dt>
          <dd style={{ margin: 0, color: "var(--ink-2)" }}>
            exportable, filterable, kept for two years.
          </dd>
        </dl>
      </section>

      {/* CTA band */}
      <section className="cta-band" style={{ padding: "72px 0" }}>
        <div
          className="pub-wrap"
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 24,
          }}
        >
          <h2 className="public-h2" style={{ maxWidth: "16em" }}>
            Know who can do what, and why, by this afternoon.
          </h2>
          <ButtonLink
            variant="white"
            href="/signup"
            style={{ height: 44, padding: "0 18px", fontSize: 15 }}
          >
            Start your register
          </ButtonLink>
        </div>
      </section>

      {/* Full marketing footer */}
      <footer
        className="pub-wrap"
        style={{
          paddingTop: 40,
          paddingBottom: 48,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: 24,
          fontSize: 14,
          color: "var(--muted)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span
            style={{
              font: "800 17px/1 var(--font-sans)",
              color: "var(--ink)",
            }}
          >
            Crewspace
          </span>
          <span>© 2026 [Company]</span>
        </div>
        <nav
          aria-label="Product"
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
        >
          <b style={{ color: "var(--ink)", fontWeight: 600 }}>Product</b>
          <Link href="#how" style={{ color: "var(--ink-2)" }}>
            How it works
          </Link>
          <Link href="#" style={{ color: "var(--ink-2)" }}>
            Pricing
          </Link>
          <Link href="#" style={{ color: "var(--ink-2)" }}>
            Changelog
          </Link>
        </nav>
        <nav
          aria-label="Trust"
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
        >
          <b style={{ color: "var(--ink)", fontWeight: 600 }}>Trust</b>
          <Link href="#" style={{ color: "var(--ink-2)" }}>
            Security
          </Link>
          <Link href="#" style={{ color: "var(--ink-2)" }}>
            Privacy
          </Link>
          <Link href="#" style={{ color: "var(--ink-2)" }}>
            Terms
          </Link>
          <Link href="#" style={{ color: "var(--ink-2)" }}>
            Status
          </Link>
        </nav>
        <nav
          aria-label="Help"
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
        >
          <b style={{ color: "var(--ink)", fontWeight: 600 }}>Help</b>
          <Link href="#" style={{ color: "var(--ink-2)" }}>
            Docs
          </Link>
          <Link href="#" style={{ color: "var(--ink-2)" }}>
            hello@sevynlabs.io
          </Link>
        </nav>
      </footer>
    </div>
  );
}
