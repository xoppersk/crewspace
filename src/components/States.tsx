import Link from "next/link";
import type { ReactNode } from "react";
import { getMember, getRole, getTeam, roleAllows, roleMemberCount } from "@/lib/api";
import { ButtonLink } from "./Button";
import { GoogleButton } from "./GoogleButton";
import { LegalFooter } from "./LegalFooter";

/* Screen-literal avatar tints (SysEmptyTeam / SysReconnect draw these
   exact hexes per person; they are not token colours). */
const AVATAR_TINTS: Record<string, string> = {
  "011": "#DCE3F4", // Owen Clarke
  "008": "#E9E3D6", // Felix Grant
  "027": "#DDEBE2", // Rita Alvarez
};

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

/* X-01 — a signed-in person who can view a role but not change it.
   The scenario is persona-bound (HANDOVER §8): a Support lead opens a
   role's edit page, so it always presents the Support lead case,
   whichever role route the toggle is attached to. Layout per
   SysDenied.html: notice card left, dark "Access decision" panel right. */
export function DeniedState(_props: { roleId?: string } = {}) {
  const role = getRole("support-lead")!;
  const count = roleMemberCount("support-lead");
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
            . It protects what all {count} {role.name}s can do, including you.
            Only Sheku Koroma, the organization owner, has it.
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
                {role.name} · {count} members
              </dd>
            </div>
            <div>
              <dt>Your role</dt>
              <dd>
                {role.name} · allows {roleAllows(role)} of 18
              </dd>
            </div>
            <div>
              <dt>Ask</dt>
              <dd>Sheku Koroma · Organization owner</dd>
            </div>
          </dl>
          <ButtonLink variant="white" size="h40" href="#">
            Ask Sheku to make the change
          </ButtonLink>
        </section>
      </aside>
    </div>
  );
}

/* X-02 — a brand-new team with nobody on it. Rendered inside the app shell.
   Layout per SysEmptyTeam.html: header card + empty card left, suggested
   people card right. */
export function EmptyTeamState() {
  const team = getTeam("partnerships")!;
  const suggested = ["011", "008", "027"].map((id) => getMember(id)!);
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
              Team <span className="mono">{team.regNumber}</span> · created
              today by Daniel Okafor · no lead yet
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
            Add people who already belong to Sevyn Labs, or invite someone new
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

      <aside className="sys-aside">
        <section className="card sys-suggest" aria-labelledby="sys-sg">
          <h2 id="sys-sg">Suggested from Customer operations</h2>
          <div>
            {suggested.map((p) => (
              <div className="sys-sug" key={p.id}>
                <span
                  className="av"
                  aria-hidden="true"
                  style={{ border: 0, background: AVATAR_TINTS[p.id] }}
                >
                  {initialsOf(p.name)}
                </span>
                <b>{p.name}</b>
                <span className="role">{getRole(p.roleId)?.name}</span>
              </div>
            ))}
          </div>
          <p className="sys-sug-note">
            Suggested because they’re on accounts tagged “partner” this month.
          </p>
        </section>
      </aside>
    </div>
  );
}

/* Public state chrome (X-03/X-04/X-05): the screens sit on --ground with
   a shield-mark header and the shared one-line LegalFooter. */
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

/* X-03 — an invitation link that has expired. */
export function ExpiredState() {
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
              Invitation · expired October 1
            </span>
          </div>
          <h1 className="sys-h-public">This invitation has expired.</h1>
          <p className="sys-lead16">
            Daniel Okafor invited{" "}
            <span className="mono">nina.brooks@sevynlabs.io</span> to Sevyn
            Labs on September 24. Invitations last 7 days, so this link no
            longer works. Nothing was created and nobody was charged.
          </p>
          <div className="sys-actions gap10">
            <ButtonLink variant="pri" href="#" className="sys-h42">
              Ask Daniel to send a new one
            </ButtonLink>
            <ButtonLink href="/signin" className="sys-h42">
              Sign in instead
            </ButtonLink>
          </div>
          <span className="sys-pub-note">
            Asking sends Daniel one email. He decides; you’ll hear back at
            this address.
          </span>
        </section>
      </div>
    </SignedOutChrome>
  );
}

/* X-04 — signed in with Google, but in no organization. */
export function NoOrgState() {
  return (
    <SignedOutChrome
      headerAction={
        <Link href="#" className="sys-headlink">
          Sign out
        </Link>
      }
    >
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
              Signed in · jordan.bell@gmail.com
            </span>
          </div>
          <h1 className="sys-h-public">
            This account isn’t in any organization.
          </h1>
          <p className="sys-lead16">
            Crewspace only shows a register to people who were invited to it.
            If you were expecting one, the invitation probably went to a
            different address.
          </p>
          <div className="sys-wide-stack">
            <GoogleButton label="Use a different Google account" height={46} />
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

/* X-05 — a deactivated person tries to sign in. */
export function DeactivatedState() {
  const victor = getMember("033")!;
  return (
    <SignedOutChrome>
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
              Member {victor.id} · Sevyn Labs
            </span>
          </div>
          <h1 className="sys-h-public">
            Your access to Sevyn Labs was turned off.
          </h1>
          <p className="sys-lead16">
            Sheku Koroma deactivated{" "}
            <span className="mono">{victor.email}</span> on September 12. You
            can’t see the register while it’s off. Your history and anything
            you own were kept, so it can be turned back on.
          </p>
          <div className="sys-actions gap10">
            <ButtonLink variant="pri" href="#" className="sys-h42">
              Ask Sheku to reactivate
            </ButtonLink>
            <ButtonLink href="#" className="sys-h42">
              Sign out
            </ButtonLink>
          </div>
        </section>
        <aside
          className="sys-dpanel pad28"
          style={{ alignSelf: "flex-start", flex: "1 1 300px", maxWidth: 360 }}
        >
          <div className="sys-orghead">
            <span className="sl" aria-hidden="true">
              SL
            </span>
            <b>Sevyn Labs</b>
          </div>
          <dl className="sys-dk">
            <div>
              <dt>Organization</dt>
              <dd>Sevyn Labs</dd>
            </div>
            <div>
              <dt>Deactivated</dt>
              <dd>Sep 12, 2026</dd>
            </div>
            <div>
              <dt>By</dt>
              <dd>Sheku Koroma, owner</dd>
            </div>
            <div className="bb">
              <dt>Role kept</dt>
              <dd>{getRole(victor.roleId)?.name}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </SignedOutChrome>
  );
}
