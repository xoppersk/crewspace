import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/Button";
import { GoogleButton } from "@/components/GoogleButton";
import { LegalFooter } from "@/components/LegalFooter";
import { DeactivatedState, NoOrgState } from "@/components/States";
import { EmailForm } from "./EmailForm";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}): Promise<Metadata> {
  const { state } = await searchParams;
  if (state === "no-org") return { title: "Crewspace — No organization" };
  if (state === "deactivated")
    return { title: "Crewspace — Access turned off" };
  return { title: "Crewspace — Sign in" };
}

/**
 * F-02 — Sign in. The side panel quotes a real audit entry, as the
 * screen shows it. Query states: ?state=no-org (X-04) and
 * ?state=deactivated (X-05) render the prebuilt state components.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  if (state === "no-org") return <NoOrgState />;
  if (state === "deactivated") return <DeactivatedState />;

  return (
    <div className="pub">
      <header className="auth-head">
        <Link href="/" className="wordmark">
          Crewspace
        </Link>
        <nav className="pub-nav" aria-label="Public">
          <Link href="/signup">Start a register</Link>
        </nav>
      </header>

      <div className="auth-grid">
        <EmailForm
          className="auth-form"
          style={{ flex: "1 1 360px", maxWidth: 400 }}
        >
          <h1 className="public-title" style={{ marginBottom: 4 }}>
            Sign in to your register
          </h1>
          <GoogleButton label="Continue with Google" href="/app" />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 13,
              color: "var(--muted)",
            }}
          >
            <span
              style={{
                flex: 1,
                height: 1,
                background: "var(--rule-strong)",
              }}
            />
            or, for guests
            <span
              style={{
                flex: 1,
                height: 1,
                background: "var(--rule-strong)",
              }}
            />
          </div>
          <div
            style={{ display: "flex", flexDirection: "column", gap: 6 }}
          >
            <label
              htmlFor="em"
              style={{ fontSize: 13, fontWeight: 600 }}
            >
              Email
            </label>
            <input
              id="em"
              className="in"
              type="email"
              placeholder="you@company.com"
              style={{ height: 44, width: "100%", fontSize: 15 }}
            />
          </div>
          <Button size="h44" style={{ width: "100%" }} type="submit">
            Email me a sign-in link
          </Button>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.5,
              color: "var(--muted)",
            }}
          >
            Members of an organization sign in with the Google account their
            invitation was sent to. New here?{" "}
            <Link href="/signup">Start a register</Link>
          </p>
        </EmailForm>

        <aside
          aria-label="From the register"
          className="auth-side"
          style={{
            flex: "1 1 360px",
            maxWidth: 440,
            padding: 28,
            background: "var(--ground)",
            borderRadius: 12,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <span className="register">Audit log · Oct 5, 10:02</span>
          <p
            style={{
              margin: 0,
              font: "600 22px/1.4 var(--font-sans)",
              letterSpacing: "-0.01em",
            }}
          >
            “Product admin applied to Maya Jordan, Member 042.”
          </p>
          <span
            style={{ fontSize: 14, lineHeight: 1.5, color: "var(--ink-2)" }}
          >
            Every change to who can do what is written down like this, and
            kept.
          </span>
        </aside>
      </div>

      <LegalFooter />
    </div>
  );
}
