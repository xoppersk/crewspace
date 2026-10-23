import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getGateState } from "@/lib/data/server";
import { Button } from "@/components/Button";
import { GoogleButton } from "@/components/GoogleButton";
import { IconShieldCheck } from "@/components/icons";
import { LegalFooter } from "@/components/LegalFooter";
import { DeactivatedState, NoOrgState } from "@/components/States";
import { EmailForm } from "./EmailForm";

export const metadata: Metadata = { title: "Crewspace — Sign in" };

/**
 * F-02 — Sign in, for real. States derive from the session, never
 * from a query parameter:
 *  - active membership → straight to /app;
 *  - signed in, no workspace → X-04 no-org screen (workspace creation);
 *  - own membership deactivated → X-05 deactivated screen;
 *  - signed out → email + password (signInWithPassword) or Google.
 * `?next=` carries a same-site return path (invite links); `?error=`
 * surfaces OAuth/callback failures.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const next =
    sp.next && sp.next.startsWith("/") && !sp.next.startsWith("//")
      ? sp.next
      : undefined;

  const gate = await getGateState();
  if (gate.kind === "active") redirect(next ?? "/app");
  if (gate.kind === "no-org") return <NoOrgState email={gate.email} />;
  if (gate.kind === "deactivated") {
    return (
      <DeactivatedState
        orgName={gate.orgName}
        email={gate.email}
        deactivatedBy={gate.deactivatedBy}
        deactivatedOn={gate.deactivatedOn}
        roleName={gate.roleName}
      />
    );
  }

  return (
    <div className="pub fpub">
      <header className="auth-head">
        <Link href="/" className="fm-word">
          <span className="shieldmark" aria-hidden="true">
            <IconShieldCheck />
          </span>
          <span className="fm-name">Crewspace</span>
        </Link>
        <Link href="/signup" style={{ fontSize: 14, fontWeight: 600 }}>
          Start a register
        </Link>
      </header>

      <div className="auth-grid">
        <EmailForm
          className="auth-form fa-form"
          style={{ flex: "1 1 380px", maxWidth: 460 }}
          next={next}
        >
          <h1 className="ft-34" style={{ marginBottom: 6 }}>
            Sign in to your register
          </h1>
          <GoogleButton
            label="Continue with Google"
            href={next ? `/auth/google?next=${encodeURIComponent(next)}` : "/auth/google"}
            height={46}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 13,
              color: "var(--muted)",
            }}
          >
            <span style={{ flex: 1, height: 1, background: "var(--rule-strong)" }} />
            or with email
            <span style={{ flex: 1, height: 1, background: "var(--rule-strong)" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <label htmlFor="em" style={{ fontSize: 13, fontWeight: 600 }}>
              Email
            </label>
            <input
              id="em"
              name="email"
              className="in"
              type="email"
              autoComplete="email"
              required
              placeholder="you@company.com"
              style={{ height: 44, width: "100%", fontSize: 15 }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <span
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
              }}
            >
              <label htmlFor="pw" style={{ fontSize: 13, fontWeight: 600 }}>
                Password
              </label>
              <Link href="/reset-password" style={{ fontSize: 13, fontWeight: 600 }}>
                Forgot password?
              </Link>
            </span>
            <input
              id="pw"
              name="password"
              className="in"
              type="password"
              autoComplete="current-password"
              required
              style={{ height: 44, width: "100%", fontSize: 15 }}
            />
          </div>
          {sp.error ? (
            <p
              role="alert"
              style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "var(--deny)" }}
            >
              {sp.error}
            </p>
          ) : null}
          <Button size="h44" style={{ width: "100%", height: 46 }} type="submit">
            Sign in
          </Button>
          <p
            style={{
              margin: "2px 0 0",
              paddingTop: 16,
              borderTop: "1px solid var(--rule)",
              fontSize: 13,
              lineHeight: 1.55,
              color: "var(--muted)",
            }}
          >
            Sign in with the account your invitation was sent to. New
            here? <Link href="/signup">Start a register</Link>
          </p>
        </EmailForm>

        <aside
          aria-label="From the register"
          className="fdark"
          style={{
            flex: "1 1 360px",
            maxWidth: 460,
            padding: 32,
            gap: 18,
          }}
        >
          <span className="mono" style={{ fontSize: 12, color: "var(--panel-muted)" }}>
            The register
          </span>
          <p
            style={{
              margin: 0,
              font: "600 24px/1.38 var(--font-sans)",
              letterSpacing: "-0.01em",
            }}
          >
            “Every change to who can do what is written down, and kept.”
          </p>
          <span
            style={{
              fontSize: 14,
              lineHeight: 1.55,
              color: "var(--panel-muted)",
            }}
          >
            Crewspace keeps one register of who is in your organization
            and exactly what each role allows — every invitation, role
            change and setting, in an audit log that can’t be edited.
          </span>
          <div
            className="fpanel-card"
            style={{
              marginTop: "auto",
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    color: "var(--panel-allow)",
                  }}
                >
                  <IconShieldCheck width={16} height={16} />
                </span>
                18 permissions, set per role
              </span>
              <span
                className="mono"
                style={{ fontSize: 11.5, color: "var(--panel-muted)" }}
              >
                Allow · Block · Inherit
              </span>
            </div>
            <span
              className="fstrip-dark"
              role="img"
              aria-label="Illustration: a permission strip with some permissions allowed"
            >
              {Array.from({ length: 18 }, (_, i) => (
                <i key={i} className={i % 3 !== 2 ? "on" : undefined} />
              ))}
            </span>
          </div>
        </aside>
      </div>

      <LegalFooter />
    </div>
  );
}
