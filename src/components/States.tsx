import Link from "next/link";
import type { ReactNode } from "react";
import { signOutAction } from "@/lib/auth/actions";
import type { Member, Role, Team } from "@/lib/types";
import { ButtonLink } from "./Button";
import { GoogleButton } from "./GoogleButton";
import { LegalFooter } from "./LegalFooter";

/**
 * State screens — every value on these screens comes from the real
 * session / database row that produced the state (the signed-in user's
 * own deactivated membership, a real expired invitation, the actual
 * role the actor holds). There is no persona or query-string state
 * machinery: callers pass the real records in as props.
 */

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

/* X-01 — a signed-in person who can view a role but not change it:
   rendered from the REAL permission check (the actor lacks
   roles:update / "Edit role permissions") on the role they opened. */
export function DeniedState({
  role,
  memberCount,
  yourRoleName,
  yourAllows,
  ownerName,
}: {
  role: Role;
  memberCount: number;
  yourRoleName?: string;
  yourAllows?: number;
  ownerName?: string;
}) {
  return (
    <div className="sys-two">
      <div className="sys-stack">
        <div className="crumb">
          <Link href="/app/roles">Roles</Link>{" "}
          <span className="sep">/</span>{" "}
          {role.name}{" "}
          <span className="sep">/</span>{" "}
          Edit
        </div>
        <section
          className="card"
          role="alert"
          style={{
            padding: "28px 28px 26px",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <div className="sys-toprow">
            <span className="sys-tile deny" aria-hidden="true">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
                <rect x="3.5" y="7" width="9" height="6.5" rx="1.2" />
                <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
              </svg>
            </span>
            <span className="sys-chip deny">
              <i aria-hidden="true" />
              Access decision · Denied
            </span>
          </div>
          <h1 className="sys-h-state">
            You can view this role, but you can’t change it.
          </h1>
          <p className="sys-lead15" style={{ maxWidth: 620 }}>
            Changing a role needs the permission{" "}
            <b style={{ fontWeight: 600, color: "var(--ink)" }}>
              Edit role permissions
            </b>
            . It protects what all {memberCount} {role.name}s can do,
            including you.
            {ownerName
              ? ` Only ${ownerName}, the organization owner, has it.`
              : ""}
          </p>
          <div className="sys-missbox">
            <div className="sys-missrow">
              <b style={{ fontWeight: 600 }}>Edit role permissions</b>
              <span className="missing">Missing</span>
            </div>
            <div
              className="sys-miss-strip"
              role="img"
              aria-label="Permission 5 of 18, Edit role permissions, is missing from your role"
            >
              {Array.from({ length: 18 }, (_, i) => (
                <i key={i} className={i === 4 ? "miss" : undefined} aria-hidden="true" />
              ))}
            </div>
          </div>
          <div className="sys-actions">
            <ButtonLink href="/app/me">Review my access</ButtonLink>
            <ButtonLink href="/app/roles" className="sys-ghost">
              Back to the role
            </ButtonLink>
          </div>
        </section>
      </div>

      <aside className="sys-aside">
        <section className="sys-dpanel" aria-label="Access decision">
          <dl className="sys-dk">
            <div>
              <dt>Missing</dt>
              <dd>Edit role permissions</dd>
            </div>
            <div>
              <dt>Protected</dt>
              <dd>
                {role.name} · {memberCount} members
              </dd>
            </div>
            {yourRoleName ? (
              <div>
                <dt>Your role</dt>
                <dd>
                  {yourRoleName}
                  {yourAllows !== undefined
                    ? ` · allows ${yourAllows} of 18`
                    : ""}
                </dd>
              </div>
            ) : null}
            {ownerName ? (
              <div>
                <dt>Ask</dt>
                <dd>{ownerName} · Organization owner</dd>
              </div>
            ) : null}
          </dl>
        </section>
      </aside>
    </div>
  );
}

/* X-02 — a real team with nobody on it yet. Rendered inside the app shell. */
export function EmptyTeamState({
  team,
  orgName,
  suggestions = [],
}: {
  team: Team;
  orgName: string;
  suggestions?: { member: Member; roleName: string }[];
}) {
  return (
    <div className="sys-two">
      <div className="sys-stack">
        <div className="crumb">
          <Link href="/app/teams">Teams</Link>{" "}
          <span className="sep">/</span>{" "}
          {team.name}
        </div>
        <header className="card sys-teamhead">
          <span className="tile52" aria-hidden="true">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
              <circle cx="5.5" cy="6" r="2" />
              <circle cx="11" cy="6" r="2" />
              <path d="M1.5 13c.4-1.8 2-2.8 4-2.8s3.6 1 4 2.8M9.5 10.3c.5-.1 1-.1 1.5-.1 2 0 3.6 1 4 2.8" />
            </svg>
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <h1 className="sys-h-team">{team.name}</h1>
            <span className="meta">
              Team <span className="mono">{team.regNumber}</span> · no lead yet
            </span>
          </div>
        </header>
        <section className="card sys-emptycard">
          <div className="sys-dashstack" aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
          <span className="sys-chip grey" style={{ alignSelf: "flex-start" }}>
            <i aria-hidden="true" />0 members
          </span>
          <h2 className="sys-h-empty">This team has no one on it yet.</h2>
          <p className="sys-lead15" style={{ maxWidth: "40em" }}>
            Add people who already belong to {orgName}, or invite someone new
            straight onto this team. Adding people here doesn’t change their
            role or what they can do.
          </p>
          <div className="sys-actions">
            <ButtonLink variant="pri" href="/app/people">
              Add existing members
            </ButtonLink>
            <ButtonLink href="/app/invitations">Invite someone new</ButtonLink>
          </div>
        </section>
      </div>

      {suggestions.length ? (
        <aside className="sys-aside">
          <section className="card sys-suggest" aria-labelledby="sys-sg">
            <h2 id="sys-sg">People in this workspace</h2>
            <div>
              {suggestions.map(({ member: p, roleName }) => (
                <div className="sys-sug" key={p.id}>
                  <span className="av" aria-hidden="true" style={{ border: 0 }}>
                    {initialsOf(p.name)}
                  </span>
                  <b>{p.name}</b>
                  <span className="role">{roleName}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      ) : null}
    </div>
  );
}
/* Public state chrome (X-03/X-04/X-05). */
function SignedOutChrome({
  headerAction,
  children,
}: {
  headerAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="sys-pub">
      <header className="sys-pub-head">
        <Link href="/" className="sys-brand">
          <span className="sys-brandmark" aria-hidden="true">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 1.8 13.5 4v4c0 3.2-2.4 5.4-5.5 6.2C4.9 13.4 2.5 11.2 2.5 8V4z" />
              <path d="m5.6 8 1.7 1.7L10.6 6.4" />
            </svg>
          </span>
          <b>Crewspace</b>
        </Link>
        {headerAction}
      </header>
      {children}
      <LegalFooter />
    </div>
  );
}

function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOutAction}>
      <button type="submit" className={className ?? "sys-headlink"}>
        Sign out
      </button>
    </form>
  );
}

/* X-03 — a real invitation whose token is expired or revoked. */
export function ExpiredState({
  orgName,
  email,
  inviterName,
  expiredLabel,
}: {
  orgName?: string;
  email?: string;
  inviterName?: string;
  expiredLabel?: string;
}) {
  return (
    <SignedOutChrome
      headerAction={
        <Link href="/signin" className="sys-headlink">
          Sign in
        </Link>
      }
    >
      <div className="sys-pub-center">
        <section className="card sys-pub-card">
          <div className="sys-toprow">
            <span className="sys-tile deny" aria-hidden="true">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
                <circle cx="8" cy="8" r="5.8" />
                <path d="M8 4.8V8l2.2 1.6" />
              </svg>
            </span>
            <span className="sys-chip deny">
              <i aria-hidden="true" />
              Invitation · expired{expiredLabel ? ` ${expiredLabel}` : ""}
            </span>
          </div>
          <h1 className="sys-h-public">This invitation has expired.</h1>
          <p className="sys-lead16">
            {inviterName ? `${inviterName} invited ` : "You were invited "}
            {email ? <span className="mono">{email}</span> : "this address"}
            {orgName ? ` to ${orgName}` : ""}. Invitations last 7 days, so
            this link no longer works. Nothing was created and nobody was
            charged.
          </p>
          <div className="sys-actions gap10">
            <ButtonLink href="/signin" className="sys-h42">
              Sign in instead
            </ButtonLink>
          </div>
          <span className="sys-pub-note">
            Ask whoever invited you to send a new invitation — they can
            resend it from the workspace’s Invitations page.
          </span>
        </section>
      </div>
    </SignedOutChrome>
  );
}

/* X-04 — signed in, but a member of no organization. */
export function NoOrgState({ email }: { email: string }) {
  return (
    <SignedOutChrome headerAction={<SignOutButton />}>
      <div className="sys-pub-center split">
        <section className="card sys-pub-card split">
          <div className="sys-toprow">
            <span className="sys-tile seal" aria-hidden="true">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
                <circle cx="8" cy="5.5" r="2.5" />
                <path d="M3 13.5c.6-2.4 2.6-3.5 5-3.5s4.4 1.1 5 3.5" />
              </svg>
            </span>
            <span className="sys-chip ok">
              <i aria-hidden="true" />
              Signed in · {email}
            </span>
          </div>
          <h1 className="sys-h-public">
            This account isn’t in any organization.
          </h1>
          <p className="sys-lead16">
            Crewspace only shows a register to people who were invited to it.
            If you were expecting one, the invitation probably went to a
            different address — or open the invitation link while signed in
            here to accept it.
          </p>
          <div className="sys-wide-stack">
            <GoogleButton
              label="Use a different Google account"
              height={46}
              href="/auth/google"
            />
            <ButtonLink href="/signup" className="sys-wide sys-flat">
              Start a new organization
            </ButtonLink>
          </div>
        </section>
        <aside className="card sys-checkcard">
          <h2>Things to check</h2>
          <div className="sys-check">
            <span className="n">01</span>
            <span>Search your work inbox for “invited you to” from Crewspace.</span>
          </div>
          <div className="sys-check">
            <span className="n">02</span>
            <span>
              Invitations last 7 days. An expired one needs a new one from
              whoever sent it.
            </span>
          </div>
          <div className="sys-check">
            <span className="n">03</span>
            <span>Your organization’s owner can see every open invitation.</span>
          </div>
        </aside>
      </div>
    </SignedOutChrome>
  );
}

/* X-05 — the signed-in user's own membership is deactivated. */
export function DeactivatedState({
  orgName,
  email,
  deactivatedBy,
  deactivatedOn,
  roleName,
}: {
  orgName: string;
  email: string;
  deactivatedBy?: string;
  deactivatedOn?: string;
  roleName?: string;
}) {
  const initials = orgName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <SignedOutChrome headerAction={<SignOutButton />}>
      <div className="sys-pub-center split">
        <section className="card sys-pub-card split">
          <div className="sys-toprow">
            <span className="sys-tile deny" aria-hidden="true">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
                <path d="M8 1.8 13.5 4v4c0 3.2-2.4 5.4-5.5 6.2C4.9 13.4 2.5 11.2 2.5 8V4z" />
                <path d="M5.8 8h4.4" />
              </svg>
            </span>
            <span className="sys-chip">
              <i aria-hidden="true" style={{ background: "var(--deny)" }} />
              {orgName}
            </span>
          </div>
          <h1 className="sys-h-public">
            Your access to {orgName} was turned off.
          </h1>
          <p className="sys-lead16">
            {deactivatedBy ? `${deactivatedBy} deactivated ` : "Your account "}
            <span className="mono">{email}</span>
            {deactivatedOn ? ` on ${deactivatedOn}` : ""}. You can’t see the
            register while it’s off. Your history and anything you own were
            kept, so it can be turned back on.
          </p>
          <div className="sys-actions gap10">
            <SignOutButton className="btn sys-h42" />
          </div>
        </section>
        <aside
          className="sys-dpanel pad28"
          style={{ alignSelf: "flex-start", flex: "1 1 300px", maxWidth: 360 }}
        >
          <div className="sys-orghead">
            <span className="sl" aria-hidden="true">
              {initials || "CS"}
            </span>
            <b>{orgName}</b>
          </div>
          <dl className="sys-dk">
            <div>
              <dt>Organization</dt>
              <dd>{orgName}</dd>
            </div>
            {deactivatedOn ? (
              <div>
                <dt>Deactivated</dt>
                <dd>{deactivatedOn}</dd>
              </div>
            ) : null}
            {deactivatedBy ? (
              <div>
                <dt>By</dt>
                <dd>{deactivatedBy}</dd>
              </div>
            ) : null}
            {roleName ? (
              <div className="bb">
                <dt>Role kept</dt>
                <dd>{roleName}</dd>
              </div>
            ) : null}
          </dl>
        </aside>
      </div>
    </SignedOutChrome>
  );
}
