import Link from "next/link";
import { getMember, getRole, getTeam, roleAllows, roleMemberCount } from "@/lib/api";
import { ButtonLink } from "./Button";
import { GoogleButton } from "./GoogleButton";
import { LegalFooter } from "./LegalFooter";

/* X-01 — a signed-in person who can view a role but not change it.
   The scenario is persona-bound (HANDOVER §8): a Support lead opens a
   role's edit page, so it always presents the Support lead case,
   whichever role route the toggle is attached to. */
export function DeniedState(_props: { roleId?: string } = {}) {
  const role = getRole("support-lead")!;
  const count = roleMemberCount("support-lead");
  return (
    <>
      <div className="crumb" style={{ paddingTop: 2 }}>
        <Link href="/app/roles">Roles</Link> / {role.name} / Edit
      </div>
      <section
        className="sheet"
        role="alert"
        style={{
          maxWidth: 760,
          padding: 28,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <span className="register">Access decision · Denied</span>
        <h1 className="title" style={{ lineHeight: 1.2 }}>
          You can view this role, but you can’t change it.
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 15,
            lineHeight: 1.6,
            color: "var(--ink-2)",
          }}
        >
          Changing a role needs the permission{" "}
          <b style={{ fontWeight: 600, color: "var(--ink)" }}>
            Edit role permissions
          </b>
          . It protects what all {count} {role.name}s can do, including you.
          Only Sheku Koroma, the organization owner, has it.
        </p>
        <dl
          className="kv wide"
          style={{
            padding: "14px 16px",
            background: "var(--sheet-sunk)",
            borderRadius: 6,
          }}
        >
          <dt>Missing</dt>
          <dd>Edit role permissions</dd>
          <dt>Protected</dt>
          <dd>
            {role.name} · {count} members
          </dd>
          <dt>Your role</dt>
          <dd>
            {role.name} · allows {roleAllows(role)} of 18
          </dd>
          <dt>Ask</dt>
          <dd>Sheku Koroma · Organization owner</dd>
        </dl>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <ButtonLink variant="pri" size="h40" href="#" style={{ fontSize: 14 }}>
            Ask Sheku to make the change
          </ButtonLink>
          <ButtonLink href="/app/me" size="h40" style={{ fontSize: 14 }}>
            Review my access
          </ButtonLink>
          <ButtonLink
            href="/app/roles"
            size="h40"
            style={{ borderColor: "transparent", fontSize: 14 }}
          >
            Back to the role
          </ButtonLink>
        </div>
      </section>
    </>
  );
}

/* X-02 — a brand-new team with nobody on it. Rendered inside the app shell. */
export function EmptyTeamState() {
  const team = getTeam("partnerships")!;
  const suggested = ["011", "008", "027"].map((id) => getMember(id)!);
  return (
    <>
      <div className="crumb">
        <Link href="/app/teams">Teams</Link> / {team.name}
      </div>
      <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h1 className="title">{team.name}</h1>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>
          Team <span className="mono">{team.regNumber}</span> · created today
          by Daniel Okafor · no lead yet
        </span>
      </header>
      <div className="cols">
        <section
          className="sheet main-sheet"
          style={{
            flex: "999 1 560px",
            padding: "32px 28px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <span className="register">0 members</span>
          <h2
            style={{
              margin: 0,
              font: "700 24px/1.2 var(--font-sans)",
            }}
          >
            This team has no one on it yet.
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              lineHeight: 1.6,
              color: "var(--ink-2)",
              maxWidth: "40em",
            }}
          >
            Add people who already belong to Sevyn Labs, or invite someone new
            straight onto this team. Adding people here doesn’t change their
            role or what they can do.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <ButtonLink
              variant="pri"
              size="h40"
              href="/app/people"
              style={{ fontSize: 14 }}
            >
              Add existing members
            </ButtonLink>
            <ButtonLink
              href="/app/invitations"
              size="h40"
              style={{ fontSize: 14 }}
            >
              Invite someone new
            </ButtonLink>
          </div>
        </section>
        <aside className="sheet side-col" style={{ padding: "18px 20px" }}>
          <h2 className="panel">Suggested from Customer operations</h2>
          <div>
            {suggested.map((p) => (
              <div className="ll big" key={p.id}>
                <span>{p.name}</span>
                <i />
                <span style={{ color: "var(--muted)" }}>
                  {getRole(p.roleId)?.name}
                </span>
              </div>
            ))}
          </div>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 12,
              lineHeight: 1.5,
              color: "var(--muted)",
            }}
          >
            Suggested because they’re on accounts tagged “partner” this month.
          </p>
        </aside>
      </div>
    </>
  );
}

function SignedOutChrome({
  headerAction,
  children,
}: {
  headerAction: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="pub">
      <header className="auth-head">
        <Link href="/" className="wordmark">
          Crewspace
        </Link>
        {headerAction}
      </header>
      {children}
      <LegalFooter />
    </div>
  );
}

/* X-03 — an invitation link that has expired. */
export function ExpiredState() {
  return (
    <SignedOutChrome
      headerAction={
        <nav className="pub-nav">
          <Link href="/signin">Sign in</Link>
        </nav>
      }
    >
      <div className="auth-grid">
        <div
          style={{
            flex: "1 1 440px",
            maxWidth: 520,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <span className="register">Invitation · expired October 1</span>
          <h1 className="public-title">This invitation has expired.</h1>
          <p
            style={{
              margin: 0,
              fontSize: 16,
              lineHeight: 1.6,
              color: "var(--ink-2)",
            }}
          >
            Daniel Okafor invited nina.brooks@sevynlabs.io to Sevyn Labs on
            September 24. Invitations last 7 days, so this link no longer
            works. Nothing was created and nobody was charged.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <ButtonLink
              variant="pri"
              size="h40"
              href="#"
              style={{ fontSize: 14 }}
            >
              Ask Daniel to send a new one
            </ButtonLink>
            <ButtonLink size="h40" href="/signin" style={{ fontSize: 14 }}>
              Sign in instead
            </ButtonLink>
          </div>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            Asking sends Daniel one email. He decides; you’ll hear back at
            this address.
          </span>
        </div>
      </div>
    </SignedOutChrome>
  );
}

/* X-04 — signed in with Google, but in no organization. */
export function NoOrgState() {
  return (
    <SignedOutChrome
      headerAction={
        <nav className="pub-nav">
          <Link href="#">Sign out</Link>
        </nav>
      }
    >
      <div className="auth-grid">
        <div
          className="auth-form"
          style={{ flex: "1 1 440px", maxWidth: 520 }}
        >
          <span className="register">Signed in · jordan.bell@gmail.com</span>
          <h1 className="public-title">
            This account isn’t in any organization.
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 16,
              lineHeight: 1.6,
              color: "var(--ink-2)",
            }}
          >
            Crewspace only shows a register to people who were invited to it.
            If you were expecting one, the invitation probably went to a
            different address.
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              maxWidth: 380,
            }}
          >
            <GoogleButton label="Use a different Google account" />
            <ButtonLink size="h44" href="/signup" style={{ width: "100%" }}>
              Start a new organization
            </ButtonLink>
          </div>
        </div>
        <aside
          style={{
            flex: "1 1 280px",
            maxWidth: 340,
            paddingTop: 34,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <h2 className="panel">Things to check</h2>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              fontSize: 14,
              lineHeight: 1.5,
              color: "var(--ink-2)",
            }}
          >
            <span>
              Search your work inbox for “invited you to” from Crewspace.
            </span>
            <span>
              Invitations last 7 days. An expired one needs a new one from
              whoever sent it.
            </span>
            <span>
              Your organization’s owner can see every open invitation.
            </span>
          </div>
        </aside>
      </div>
    </SignedOutChrome>
  );
}

/* X-05 — a deactivated person tries to sign in. */
export function DeactivatedState() {
  const victor = getMember("033")!;
  return (
    <SignedOutChrome
      headerAction={<span />}
    >
      <div className="auth-grid">
        <div
          className="auth-form"
          style={{ flex: "1 1 440px", maxWidth: 520 }}
        >
          <span className="register">Member 033 · Sevyn Labs</span>
          <h1 className="public-title">
            Your access to Sevyn Labs was turned off.
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 16,
              lineHeight: 1.6,
              color: "var(--ink-2)",
            }}
          >
            Sheku Koroma deactivated {victor.email} on September 12. You
            can’t see the register while it’s off. Your history and anything
            you own were kept, so it can be turned back on.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <ButtonLink
              variant="pri"
              size="h40"
              href="#"
              style={{ fontSize: 14 }}
            >
              Ask Sheku to reactivate
            </ButtonLink>
            <ButtonLink size="h40" href="#" style={{ fontSize: 14 }}>
              Sign out
            </ButtonLink>
          </div>
        </div>
        <aside
          style={{ flex: "1 1 280px", maxWidth: 340, paddingTop: 34 }}
        >
          <dl className="kv wide" style={{ margin: 0 }}>
            <dt>Organization</dt>
            <dd>Sevyn Labs</dd>
            <dt>Deactivated</dt>
            <dd>Sep 12, 2026</dd>
            <dt>By</dt>
            <dd>Sheku Koroma, owner</dd>
            <dt>Role kept</dt>
            <dd>Member</dd>
          </dl>
        </aside>
      </div>
    </SignedOutChrome>
  );
}
