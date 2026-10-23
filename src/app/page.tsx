import Link from "next/link";
import { PERMISSION_GROUPS } from "@/lib/data/permissions";
import type { Permission, Role, Setting } from "@/lib/types";
import { ButtonLink } from "@/components/Button";
import { GoogleMark } from "@/components/GoogleButton";
import { PermissionStrip } from "@/components/PermissionStrip";
import { PublicHeader } from "@/components/Shell";
import {
  IconCheck,
  IconDocument,
  IconLock,
  IconShieldCheck,
  IconTeams,
} from "@/components/icons";

/**
 * F-01 — Marketing. Public page, always light; the v2 page sits on the
 * grey ground with white cards and dark panels. All copy and geometry
 * from Marketing.html. The hero fragment is a static illustration of
 * the product (an example role card), built locally below — this page
 * never reads workspace data or the fixture JSON.
 */

/* The illustrated example role: a Product admin mid-review, exactly
   as Marketing.html draws it (permission 2 changed Deny → Allow and
   waiting for review). */
const EXAMPLE_PERMISSIONS: Permission[] = PERMISSION_GROUPS.flatMap((g) =>
  g.permissionIds.map((id) => ({
    id,
    group: g.name,
    name: "",
    description: "",
  })),
);
const EXAMPLE_ROLE: Role = {
  id: "example-product-admin",
  regNumber: "R-04",
  name: "Product admin",
  type: "Custom",
  summary: "",
  settings: Object.fromEntries(
    EXAMPLE_PERMISSIONS.map((p) => [
      String(p.id),
      [1, 3, 4, 7, 9, 10, 11].includes(p.id)
        ? "allow"
        : p.id === 8 || p.id === 2
          ? "deny"
          : "inherit",
    ]),
  ) as Record<string, Setting>,
  pendingChanges: [{ permissionId: 2, from: "deny", to: "allow" }],
  lastChanged: "",
};
const EXAMPLE_MEMBERS = 6;
const EXAMPLE_SCOPE = 36;

export default function MarketingPage() {
  const role = EXAMPLE_ROLE;
  const members = EXAMPLE_MEMBERS;
  const scope = EXAMPLE_SCOPE;

  return (
    <div className="pub fpub">
      <PublicHeader variant="marketing" />

      {/* Hero + live product fragment */}
      <section
        className="pub-wrap"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 56,
          alignItems: "center",
          paddingTop: 60,
          paddingBottom: 88,
        }}
      >
        <div
          style={{
            flex: "1 1 440px",
            display: "flex",
            flexDirection: "column",
            gap: 24,
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
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "var(--muted)",
            }}
          >
            <span className="g14">
              <GoogleMark />
            </span>
            Sign in with Google. Invite people from a list or a CSV.
          </span>
        </div>

        <figure
          aria-label="Product fragment: three permissions on the Product admin role"
          style={{
            flex: "1 1 560px",
            margin: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            className="sheet fm-frag"
            style={{
              overflow: "hidden",
              boxShadow:
                "0 0 0 1px var(--frame), 0 30px 60px -30px rgba(22,27,34,.35)",
            }}
          >
            <div
              style={{
                padding: "20px 22px 18px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <span
                  style={{ display: "flex", alignItems: "center", gap: 12 }}
                >
                  <span className="fm-tile" aria-hidden="true">
                    <IconShieldCheck />
                  </span>
                  <b
                    style={{
                      font: "800 20px/1.1 var(--font-sans)",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {role.name}
                  </b>
                </span>
                <span
                  className="mono"
                  style={{
                    height: 24,
                    padding: "0 8px",
                    borderRadius: "var(--radius-s)",
                    background: "var(--rule)",
                    fontSize: 12,
                    display: "inline-flex",
                    alignItems: "center",
                    color: "var(--ink-2)",
                  }}
                >
                  {role.regNumber} · {members} members
                </span>
              </div>
              <PermissionStrip
                role={role}
                permissions={EXAMPLE_PERMISSIONS}
                baselineIds={[3]}
                big
                ariaLabel="Product admin: permissions 1, 3, 4, 7, 9, 10 and 11 allowed; permission 2 changed, waiting for review; permission 8 blocked"
              />
            </div>

            <div className="pr">
              <span>
                <b>Invite members</b>
                <small>Can invite people and pick their first role.</small>
              </span>
              <span className="fseg" aria-hidden="true">
                <span className="a">Allow</span>
                <span>Deny</span>
                <span>Inherit</span>
              </span>
              <span className="res">
                <span className="dot ok">
                  <IconCheck />
                </span>
                Allowed
              </span>
            </div>
            <div className="pr chg-allow">
              <span>
                <b>Deactivate members</b>
                <span className="chg">Changed · was Deny</span>
              </span>
              <span className="fseg" aria-hidden="true">
                <span className="a">Allow</span>
                <span>Deny</span>
                <span>Inherit</span>
              </span>
              <span className="res">
                <span className="dot ok">
                  <IconCheck />
                </span>
                <span>
                  Allowed
                  <small>{scope} people in scope</small>
                </span>
              </span>
            </div>
            <div className="pr" style={{ paddingBottom: 54 }}>
              <span>
                <b>Export audit records</b>
                <small>Can download the audit archive.</small>
              </span>
              <span className="fseg" aria-hidden="true">
                <span>Allow</span>
                <span className="d">Deny</span>
                <span>Inherit</span>
              </span>
              <span className="res dn">
                <span className="dot dn">
                  <IconLock />
                </span>
                Blocked
              </span>
            </div>
          </div>

          {/* The review bar overlaps the fragment card, as drawn. */}
          <div
            style={{
              margin: "-34px 22px 0",
              position: "relative",
              borderRadius: "var(--radius-l)",
              background: "var(--ink-bar)",
              color: "#fff",
              padding: "14px 16px 14px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              fontSize: 14,
              boxShadow: "var(--shadow-panel)",
            }}
          >
            <span>
              {/* The screen's fragment bar literally reads "1 change
                  ready" (it illustrates the one change its rows show);
                  the role's full pending set lives on R-04. */}
              <b style={{ fontWeight: 700 }}>1 change ready</b>{" "}
              <span style={{ color: "var(--panel-muted)" }}>
                · affects {members} members
              </span>
            </span>
            <ButtonLink
              variant="white"
              href="/app/roles/product-admin"
              style={{ height: 34, fontSize: 13 }}
            >
              Review changes
            </ButtonLink>
          </div>
          <figcaption
            style={{ marginTop: 16, fontSize: 13, color: "var(--muted)" }}
          >
            Every setting shows what it actually does, and nothing applies
            until someone reviews it.
          </figcaption>
        </figure>
      </section>

      {/* Principles */}
      <section className="pub-wrap" style={{ paddingBottom: 96 }}>
        <div className="fm-principles">
          <div className="sheet fm-pt">
            <span className="fm-tile" aria-hidden="true">
              <IconShieldCheck />
            </span>
            <h3>Every permission says what it does</h3>
            <p>
              “Allowed”, “Blocked, from baseline”, “36 people in scope.” No
              grid of ticks to decode, no guessing what Inherit means today.
            </p>
          </div>
          <div className="sheet fm-pt">
            <span className="fm-tile" aria-hidden="true">
              <IconTeams />
            </span>
            <h3>Roles grant. Teams organize.</h3>
            <p>
              Move someone between teams without changing what they can do.
              Change a role and see exactly who gains or loses what.
            </p>
          </div>
          <div className="sheet fm-pt">
            <span className="fm-tile" aria-hidden="true">
              <IconDocument />
            </span>
            <h3>Nothing changes silently</h3>
            <p>
              Changes wait for review, people are told by email, and the
              audit log keeps the before and after for two years.
            </p>
          </div>
        </div>
      </section>

      {/* How a change happens */}
      <section
        id="how"
        style={{
          background: "var(--sheet)",
          borderTop: "1px solid var(--frame)",
          borderBottom: "1px solid var(--frame)",
          padding: "88px 0",
        }}
      >
        <div
          className="pub-wrap"
          style={{ display: "flex", flexDirection: "column", gap: 36 }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
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
          <div className="fm-steps">
            <div className="sheet fm-step">
              <b>01 · Invite</b>
              <span className="t">Appointment issued</span>
              <span className="p">
                Maya Jordan, invited as Product admin to the Product team.
              </span>
            </div>
            <div className="sheet fm-step">
              <b>02 · Accept</b>
              <span className="t">Identity verified</span>
              <span className="p">
                She signs in with the exact work address the invitation
                named.
              </span>
            </div>
            <div className="sheet fm-step">
              <b>03 · Assign</b>
              <span className="t">Access active</span>
              <span className="p">
                Product admin applies to Member 042. She can see why, in
                plain words.
              </span>
            </div>
            <div className="fm-step dark">
              <b>04 · Audit</b>
              <span className="t">Permanent record</span>
              <span className="p">
                “Product admin applied to Maya Jordan, Member 042.” Can’t be
                edited.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section
        className="pub-wrap"
        style={{
          paddingTop: 96,
          paddingBottom: 96,
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
            gap: 16,
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
          className="sheet"
          style={{
            flex: "1 1 520px",
            margin: 0,
            overflow: "hidden",
          }}
        >
          <div className="fm-dl">
            <dt>18 permissions</dt>
            <dd>
              in 8 groups, each with a one-sentence description.
              <div style={{ marginTop: 12 }}>
                <div
                  className="fgroupstrip light"
                  role="img"
                  aria-label="18 permissions in 8 groups"
                >
                  {PERMISSION_GROUPS.map((g) => (
                    <span
                      key={g.name}
                      className="fg"
                      style={{
                        gridTemplateColumns: `repeat(${g.permissionIds.length}, minmax(0, 1fr))`,
                        flex: `${g.permissionIds.length} 1 0`,
                      }}
                    >
                      {g.permissionIds.map((id) => (
                        <i key={id} />
                      ))}
                    </span>
                  ))}
                </div>
              </div>
            </dd>
          </div>
          <div className="fm-dl">
            <dt>Custom roles</dt>
            <dd>
              copied from a safe starting point and reviewed before they
              exist.
            </dd>
          </div>
          <div className="fm-dl">
            <dt>Drawers, not pop-ups</dt>
            <dd>open a person without losing your place in the list.</dd>
          </div>
          <div className="fm-dl">
            <dt>Plain-language audit</dt>
            <dd>exportable, filterable, kept for two years.</dd>
          </div>
        </dl>
      </section>

      {/* CTA card */}
      <section className="pub-wrap" style={{ paddingBottom: 88 }}>
        <div className="fm-cta">
          <h2 className="public-h2" style={{ maxWidth: "15em", color: "#fff" }}>
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
        style={{ paddingBottom: 52, fontSize: 14, color: "var(--muted)" }}
      >
        <div
          style={{
            paddingTop: 40,
            borderTop: "1px solid var(--frame)",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            gap: 24,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <span className="fm-word">
              <span className="shieldmark s28" aria-hidden="true">
                <IconShieldCheck />
              </span>
              <span
                className="fm-name"
                style={{ fontSize: 17, color: "var(--ink)" }}
              >
                Crewspace
              </span>
            </span>
            <span>© 2026 Sevyn Labs</span>
          </div>
          <nav
            aria-label="Product"
            style={{ display: "flex", flexDirection: "column", gap: 9 }}
          >
            <b style={{ color: "var(--ink)", fontWeight: 600 }}>Product</b>
            <Link href="#how" style={{ color: "var(--ink-2)", textDecoration: "none" }}>
              How it works
            </Link>
            <Link href="#" style={{ color: "var(--ink-2)", textDecoration: "none" }}>
              Pricing
            </Link>
            <Link href="#" style={{ color: "var(--ink-2)", textDecoration: "none" }}>
              Changelog
            </Link>
          </nav>
          <nav
            aria-label="Trust"
            style={{ display: "flex", flexDirection: "column", gap: 9 }}
          >
            <b style={{ color: "var(--ink)", fontWeight: 600 }}>Trust</b>
            <Link href="#" style={{ color: "var(--ink-2)", textDecoration: "none" }}>
              Security
            </Link>
            <Link href="#" style={{ color: "var(--ink-2)", textDecoration: "none" }}>
              Privacy
            </Link>
            <Link href="#" style={{ color: "var(--ink-2)", textDecoration: "none" }}>
              Terms
            </Link>
            <Link href="#" style={{ color: "var(--ink-2)", textDecoration: "none" }}>
              Status
            </Link>
          </nav>
          <nav
            aria-label="Help"
            style={{ display: "flex", flexDirection: "column", gap: 9 }}
          >
            <b style={{ color: "var(--ink)", fontWeight: 600 }}>Help</b>
            <Link href="#" style={{ color: "var(--ink-2)", textDecoration: "none" }}>
              Docs
            </Link>
            <Link href="#" style={{ color: "var(--ink-2)", textDecoration: "none" }}>
              hello@sevynlabs.io
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
