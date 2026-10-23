import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import {
  getActiveWorkspace,
  getGateState,
  loadWorkspaceData,
} from "@/lib/data/server";
import { IconShieldCheck } from "./icons";
import { SideNav, type NavKey } from "./SideNav";
import { DeactivatedState, NoOrgState } from "./States";

/**
 * The app shell: SideNav on the ground, sheets in the main column.
 * ==========================================================================
 * AppShell is also the /app/** session gate (the middleware is the
 * first line; this is the per-page server check): signed-out →
 * /signin; signed-in with no workspace → the real no-org state; the
 * user's own membership deactivated → the real deactivated state.
 * Only an active membership renders children.
 */
export async function AppShell({
  current,
  children,
  banner,
  navVariant,
}: {
  current: NavKey | "none";
  children: ReactNode;
  banner?: ReactNode;
  /** Legacy prop kept for call-site compatibility — the person shown
      is always the real session user now. */
  personId?: string;
  navVariant?: "profile";
}) {
  const gate = await getGateState();
  if (gate.kind === "signed-out") redirect("/signin");
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
  const data = gate.data;
  const me = data.members.find((m) => m.id === gate.ws.membershipId);
  return (
    <div>
      {banner}
      <div className="shell">
        <SideNav current={current} variant={navVariant} data={data} me={me} />
        <main className="main-col">{children}</main>
      </div>
    </div>
  );
}

/** Focused flows (wizard, CSV import, onboarding): white top bar, no SideNav. */
export async function FocusedShell({
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
  const data = await loadWorkspaceData();
  const ws = await getActiveWorkspace();
  void ws;
  const orgName = data?.org.name ?? "Crewspace";
  const initials = orgName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div style={{ minHeight: "100vh", background: "var(--ground)" }}>
      <div className="topbar">
        <span className="brand">
          <span className="monogram" aria-hidden="true">
            {initials || "CS"}
          </span>
          <b>{orgName}</b>
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
    variant. The plain variant is the wordmark with a Sign in link. */
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
