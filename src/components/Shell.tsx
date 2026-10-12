import Link from "next/link";
import type { ReactNode } from "react";
import { getOrg } from "@/lib/api";
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
        <span style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
          <b style={{ font: "700 15px/1.2 var(--font-sans)" }}>{org.name}</b>
          <span style={{ color: "var(--muted)", fontSize: 14 }}>{flowName}</span>
        </span>
        <Link href={cancelHref} style={{ fontSize: 14 }}>
          {cancelLabel}
        </Link>
      </div>
      <div className="focused-wrap">{children}</div>
    </div>
  );
}

/** Public header: wordmark, plus the marketing nav on the full variant. */
export function PublicHeader({ variant = "plain" }: { variant?: "plain" | "marketing" }) {
  return (
    <header className="pub-head pub-wrap" style={{ maxWidth: 1200 }}>
      <Link href="/" className="wordmark">
        Crewspace
      </Link>
      {variant === "marketing" ? (
        <>
          <nav className="pub-nav" aria-label="Main" style={{ gap: 28, fontSize: 15 }}>
            <Link href="#how">How it works</Link>
            <Link href="#">Security</Link>
            <Link href="#">Pricing</Link>
            <Link href="#">Docs</Link>
          </nav>
          <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
            <Link
              href="/signin"
              style={{ color: "var(--ink-2)", textDecoration: "none", fontSize: 15 }}
            >
              Sign in
            </Link>
            <Link href="/signup" className="btn pri h40">
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
