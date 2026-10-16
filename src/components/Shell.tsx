import Link from "next/link";
import type { ReactNode } from "react";
import { getOrg } from "@/lib/api";
import { IconShieldCheck } from "./icons";
import { SideNav, type NavKey } from "./SideNav";

/** The app shell: SideNav on the ground, sheets in the main column. */
export function AppShell({
  current,
  children,
  banner,
  personId,
  navVariant,
}: {
  current: NavKey | "none";
  children: ReactNode;
  banner?: ReactNode;
  personId?: string;
  navVariant?: "profile";
}) {
  return (
    <div>
      {banner}
      <div className="shell">
        <SideNav
          current={current}
          personId={personId}
          variant={navVariant}
        />
        <main className="main-col">{children}</main>
      </div>
    </div>
  );
}

/** Focused flows (wizard, CSV import, onboarding): white top bar, no SideNav. */
export function FocusedShell({
  flowName,
  cancelLabel,
  cancelHref,
  children,
}: {
  flowName: string;
  cancelLabel: string;
  cancelHref: string;
  children: ReactNode;
}) {
  const org = getOrg();
  return (
    <div style={{ minHeight: "100vh", background: "var(--ground)" }}>
      <div className="topbar">
        <span className="brand">
          <span className="monogram" aria-hidden="true">
            SL
          </span>
          <b>{org.name}</b>
          <span className="flow">
            <i />
            {flowName}
          </span>
        </span>
        <Link href={cancelHref} style={{ fontSize: 14 }}>
          {cancelLabel}
        </Link>
      </div>
      <div className="focused-wrap">{children}</div>
    </div>
  );
}

/** Public header: shield wordmark, plus the marketing nav on the full
    variant (Marketing.html: How it works · Security · Pricing · Docs /
    Sign in / Start your register). The plain variant is the wordmark
    with a Sign in link, as the signed-out surfaces draw it. */
export function PublicHeader({ variant = "plain" }: { variant?: "plain" | "marketing" }) {
  return (
    <header
      className="pub-head pub-wrap"
      style={{ maxWidth: 1200, paddingTop: 22, paddingBottom: 22 }}
    >
      <Link href="/" className="fm-word">
        <span className="shieldmark" aria-hidden="true">
          <IconShieldCheck />
        </span>
        <span className="fm-name">Crewspace</span>
      </Link>
      {variant === "marketing" ? (
        <>
          <nav className="pub-nav" aria-label="Main" style={{ gap: 30, fontSize: 15 }}>
            <Link href="#how">How it works</Link>
            <Link href="#">Security</Link>
            <Link href="#">Pricing</Link>
            <Link href="#">Docs</Link>
          </nav>
          <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
            <Link
              href="/signin"
              style={{
                color: "var(--ink)",
                textDecoration: "none",
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="btn pri"
              style={{ height: 40, padding: "0 16px", fontSize: 14 }}
            >
              Start your register
            </Link>
          </div>
        </>
      ) : (
        <nav className="pub-nav" aria-label="Public">
          <Link href="/signin">Sign in</Link>
        </nav>
      )}
    </header>
  );
}
