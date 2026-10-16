import type { Metadata } from "next";
import Link from "next/link";
import {
  getAuditEntries,
  getPermissions,
  getRole,
  settingResult,
} from "@/lib/api";
import { Button } from "@/components/Button";
import { GoogleButton } from "@/components/GoogleButton";
import { IconShieldCheck } from "@/components/icons";
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
 * F-02 — Sign in. The dark side panel quotes a real audit entry (the
 * "Product admin applied to Maya Jordan" entry) over the role's strip,
 * as SignIn.html draws it. Query states: ?state=no-org (X-04) and
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

  const entry = getAuditEntries().find((e) =>
    e.summary.startsWith("Product admin applied to Maya Jordan"),
  )!;
  const stampDay = entry.day
    .replace(/^[^,]+, /, "")
    .replace("October", "Oct");
  const role = getRole("product-admin")!;
  const allowed = getPermissions().map(
    (p) => settingResult(role.settings[String(p.id)]!, p.id) === "Allowed",
  );
  const allowedIds = getPermissions()
    .filter((_, i) => allowed[i])
    .map((p) => p.id);

  return (
    <div className="pub fpub">
      <header className="auth-head">
        <Link href="/" className="fm-word">
          <span className="shieldmark" aria-hidden="true">
            <IconShieldCheck />
          </span>
          <span className="fm-name">Crewspace</span>
        </Link>
        <Link
          href="/signup"
          style={{ fontSize: 14, fontWeight: 600 }}
        >
          Start a register
        </Link>
      </header>

      <div className="auth-grid">
        <EmailForm
          className="auth-form fa-form"
          style={{ flex: "1 1 380px", maxWidth: 460 }}
        >
          <h1 className="ft-34" style={{ marginBottom: 6 }}>
            Sign in to your register
          </h1>
          <GoogleButton label="Continue with Google" href="/app" height={46} />
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
            style={{ display: "flex", flexDirection: "column", gap: 7 }}
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
          <Button
            size="h44"
            style={{ width: "100%", height: 46 }}
            type="submit"
          >
            Email me a sign-in link
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
            Members of an organization sign in with the Google account their
            invitation was sent to. New here?{" "}
            <Link href="/signup">Start a register</Link>
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
          <span
            className="mono"
            style={{ fontSize: 12, color: "var(--panel-muted)" }}
          >
            Audit log · {stampDay}, {entry.time}
          </span>
          <p
            style={{
              margin: 0,
              font: "600 24px/1.38 var(--font-sans)",
              letterSpacing: "-0.01em",
            }}
          >
            “{entry.summary}.”
          </p>
          <span
            style={{
              fontSize: 14,
              lineHeight: 1.55,
              color: "var(--panel-muted)",
            }}
          >
            Every change to who can do what is written down like this, and
            kept.
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
                {role.name}
              </span>
              <span
                className="mono"
                style={{ fontSize: 11.5, color: "var(--panel-muted)" }}
              >
                {role.regNumber}
              </span>
            </div>
            <span
              className="fstrip-dark"
              role="img"
              aria-label={`${role.name} allows permissions ${allowedIds.slice(0, -1).join(", ")} and ${allowedIds[allowedIds.length - 1]} of 18`}
            >
              {allowed.map((on, i) => (
                <i key={i} className={on ? "on" : undefined} />
              ))}
            </span>
          </div>
        </aside>
      </div>

      <LegalFooter />
    </div>
  );
}
