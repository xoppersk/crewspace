import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getInvitations,
  getMember,
  getOrg,
  getRole,
  getTeam,
  memberEffectivePermissions,
  settingResult,
} from "@/lib/api";
import { AppShell } from "@/components/Shell";
import { Button } from "@/components/Button";
import { PermissionStrip } from "@/components/PermissionStrip";
import { IconCheck, IconLock } from "@/components/icons";
import { initialsOf, tintFor } from "@/components/MemberRow";

/* P-04 Member detail — screens/MemberDetail.html.
   Maya Jordan (042) is the designed record; every other id renders the
   same template from fixture data. The table follows the screen's group
   order (People, Access, Teams, Invitations, then the combined tail
   group); permissions are listed individually except the tail set
   (13, 14, 8, 15, 16, 17, 18), which the screen collapses into one
   "7 others" row under Read audit log (#7, §13 register). */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const member = getMember(id);
  return {
    title: member ? `Crewspace — ${member.name}` : "Crewspace — Directory",
  };
}

/** "Oct 5" -> "Oct 5, 2026"; values that already carry a year pass through. */
function joinedFull(joined: string): string {
  return /^[A-Z][a-z]{2} \d{1,2}$/.test(joined) ? `${joined}, 2026` : joined;
}

/** Fixture device "MacBook Pro · Chrome" -> the screen's "Chrome on Mac". */
function deviceLabel(device: string): string {
  const [machine, browser] = device.split(" · ");
  if (!browser) return device;
  if (machine === "MacBook Pro") return `${browser} on Mac`;
  return `${browser} on ${machine}`;
}

function placeLabel(place: string): string {
  return place.replace(/, US$/, "");
}

function IconLaptop({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="2" y="3" width="12" height="8" rx="1.2" />
      <path d="M5.5 13.5h5" />
    </svg>
  );
}

function IconPhone({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="4.5" y="1.8" width="7" height="12.4" rx="1.5" />
      <path d="M7.3 11.8h1.4" />
    </svg>
  );
}

const TABLE_GROUPS: { label: string; ids: number[] }[] = [
  { label: "People", ids: [1, 2, 3] },
  { label: "Access", ids: [4, 5, 6] },
  { label: "Teams", ids: [9, 10] },
  { label: "Invitations", ids: [11, 12] },
];
const TAIL_LABEL = "Security, Governance, Billing, Organization";
/* The screen's "7 others" names, in the screen's order. */
const TAIL_OTHERS: { id: number; name: string }[] = [
  { id: 13, name: "Sign-in methods" },
  { id: 14, name: "sign members out" },
  { id: 8, name: "export audit" },
  { id: 15, name: "view billing" },
  { id: 16, name: "manage plan" },
  { id: 17, name: "organization settings" },
  { id: 18, name: "transfer ownership" },
];

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const member = getMember(id);
  if (!member) notFound();

  const org = getOrg();
  const role = getRole(member.roleId)!;
  const firstName = member.name.split(" ")[0]!;
  const isMaya = member.id === "042";
  /* The screen gives Maya the title "Product designer"; her fixture
     record has no title (reported as a fixture gap). */
  const title = member.title ?? (isMaya ? "Product designer" : undefined);
  const effective = memberEffectivePermissions(member);
  const allowedCount = effective.filter((e) => e.result === "Allowed").length;
  const pending = role.pendingChanges ?? [];
  const firstTeam = member.teams[0]
    ? getTeam(member.teams[0].teamId)
    : undefined;
  const lead =
    firstTeam?.leadId && firstTeam.leadId !== member.id
      ? getMember(firstTeam.leadId)
      : undefined;
  const invitation = getInvitations().find((i) => i.email === member.email);
  const inviter = invitation ? getMember(invitation.invitedById) : undefined;
  const deactivated = member.status === "deactivated";

  const history: { when: string; text: string }[] = [];
  if (invitation?.acceptedOn) {
    history.push({
      when: invitation.acceptedOn,
      text: `${role.name} applied to Member ${member.id}`,
    });
    history.push({
      when: invitation.acceptedOn,
      text: "Accepted with the invited work email; identity verified by Google",
    });
  }
  if (invitation) {
    history.push({
      when: invitation.sent,
      text: `Invited as ${role.name} by ${inviter?.name ?? "—"}`,
    });
  }
  if (history.length === 0) {
    history.push({ when: member.joined, text: `Joined ${org.name}` });
  }

  const renderRow = (permissionId: number) => {
    const entry = effective.find((e) => e.permission.id === permissionId)!;
    const { permission, result, source } = entry;
    const setting = role.settings[String(permission.id)]!;
    const change = pending.find((c) => c.permissionId === permission.id);
    const nextResult = change
      ? settingResult(change.to, permission.id)
      : result;
    const sourceText =
      setting === "locked"
        ? "Owner only"
        : source === "baseline"
          ? "Organization baseline"
          : role.name;
    const allowed = result === "Allowed";
    return (
      <div
        role="row"
        key={permission.id}
        className={change ? "p-ar changed" : "p-ar"}
      >
        <span role="cell" className="pname">
          {permission.name}
        </span>
        <span role="cell">
          <span className={allowed ? "res" : "res bl"}>
            <span className={allowed ? "dot ok" : "dot"}>
              {allowed ? <IconCheck /> : <IconLock />}
            </span>
            {result}
          </span>
        </span>
        <span role="cell" className="why">
          {sourceText}
          {permission.id === 4 && allowed ? " · up to Product admin" : ""}
          {change ? (
            <>
              {" · "}
              <span className="soon">
                {nextResult === result
                  ? `stays ${result} if ${pending.length} waiting changes apply`
                  : `becomes ${nextResult} if ${pending.length} waiting changes apply`}
              </span>
            </>
          ) : null}
        </span>
      </div>
    );
  };

  const tailResults = TAIL_OTHERS.map(
    (o) => effective.find((e) => e.permission.id === o.id)!.result,
  );
  const tailAllBlocked = tailResults.every((r) => r === "Blocked");
  const tailAllAllowed = tailResults.every((r) => r === "Allowed");
  const tailResult = tailAllBlocked
    ? "Blocked"
    : tailAllAllowed
      ? "Allowed"
      : "Mixed";

  return (
    <AppShell current="directory">
      <div className="crumb">
        <Link href="/app/people">Directory</Link>{" "}
        <span className="sep">/</span>{" "}
        {member.name}
      </div>

      <div className="p-cols">
        <div className="p-stack">
          <header
            className="card"
            style={{
              padding: "24px 24px 22px",
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                gap: 16,
                alignItems: "flex-start",
              }}
            >
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <span
                  className="p-mono52"
                  aria-hidden="true"
                  style={
                    isMaya
                      ? { background: "#DCE3F4", color: "var(--seal)" }
                      : { background: tintFor(member.id), color: "var(--ink)" }
                  }
                >
                  {initialsOf(member.name)}
                </span>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <h1 className="p-title">{member.name}</h1>
                    <span className="p-rno big">Member {member.id}</span>
                  </div>
                  <span style={{ fontSize: 14, color: "var(--ink-2)" }}>
                    {title ? `${title} · ` : ""}
                    {member.email} ·{" "}
                    {deactivated ? (
                      <span style={{ color: "var(--muted)", fontWeight: 600 }}>
                        Deactivated {member.deactivatedOn ?? ""}
                        {member.deactivatedBy
                          ? ` by ${member.deactivatedBy}`
                          : ""}
                      </span>
                    ) : (
                      <>
                        <span
                          style={{ color: "var(--active)", fontWeight: 600 }}
                        >
                          Active
                        </span>{" "}
                        since {member.joined}
                      </>
                    )}
                  </span>
                </div>
              </div>
              <div className="head-actions">
                <Button>Sign out everywhere</Button>
                <Button variant="pri">Change role</Button>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                paddingTop: 18,
                borderTop: "1px solid var(--rule)",
              }}
            >
              {isMaya ? (
                <p
                  style={{
                    margin: 0,
                    maxWidth: 660,
                    fontSize: 14.5,
                    lineHeight: 1.55,
                    color: "var(--ink-2)",
                  }}
                >
                  Maya is a{" "}
                  <Link href="/app/roles/product-admin">Product admin</Link>{" "}
                  on the Product team. She can invite people, change roles and
                  organize teams. She can’t edit what roles allow, deactivate
                  anyone, or see billing.
                </p>
              ) : (
                <p
                  style={{
                    margin: 0,
                    maxWidth: 660,
                    fontSize: 14.5,
                    lineHeight: 1.55,
                    color: "var(--ink-2)",
                  }}
                >
                  {firstName} is a{" "}
                  <Link href={`/app/roles/${role.id}`}>{role.name}</Link>
                  {firstTeam ? <> on the {firstTeam.name} team</> : null}.{" "}
                  {role.summary}
                </p>
              )}
              <PermissionStrip role={role} big showCount={false} />
            </div>
          </header>

          <section className="card p-perms" aria-labelledby="ea" style={{ overflow: "hidden" }}>
            <div className="p-ch">
              <h2 id="ea" className="p-h2">
                What {firstName} can do, and why
              </h2>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--seal)" }}>
                {allowedCount} of 18 allowed
              </span>
            </div>
            <div role="table" aria-label="Effective permissions">
              <div role="row" className="p-ar head">
                <span role="columnheader">Permission</span>
                <span role="columnheader">Result</span>
                <span role="columnheader">Comes from</span>
              </div>
              {TABLE_GROUPS.map((g) => (
                <div key={g.label}>
                  <div role="row" className="grp">
                    <span role="columnheader">{g.label}</span>
                  </div>
                  {g.ids.map(renderRow)}
                </div>
              ))}
              <div>
                <div role="row" className="grp">
                  <span role="columnheader">{TAIL_LABEL}</span>
                </div>
                {renderRow(7)}
                <div role="row" className="p-ar">
                  <span role="cell" className="pname">
                    {TAIL_OTHERS.length} others
                  </span>
                  <span role="cell">
                    <span className={tailAllAllowed ? "res" : "res bl"}>
                      <span className={tailAllAllowed ? "dot ok" : "dot"}>
                        {tailAllAllowed ? <IconCheck /> : <IconLock />}
                      </span>
                      {tailResult}
                    </span>
                  </span>
                  <span role="cell" className="why">
                    {TAIL_OTHERS.map((o) => o.name).join(", ")}
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="p-aside">
          <section
            className="card"
            aria-labelledby="pf"
            style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}
          >
            <h2 id="pf" className="p-panel">
              Record
            </h2>
            <dl className="kv p-kv96">
              <dt>Role</dt>
              <dd>
                <Link href={`/app/roles/${role.id}`}>{role.name}</Link>{" "}
                <span
                  className="p-rno"
                  style={{ height: 20, fontSize: 11.5, marginLeft: 2 }}
                >
                  {role.regNumber}
                </span>
              </dd>
              <dt>Team</dt>
              <dd>
                {member.teams.length > 0
                  ? member.teams.map((t, i) => {
                      const team = getTeam(t.teamId)!;
                      return (
                        <span key={t.teamId}>
                          {i > 0 ? ", " : ""}
                          <Link href={`/app/teams/${team.id}`}>{team.name}</Link>
                        </span>
                      );
                    })
                  : "—"}
                {lead ? ` · reports to ${lead.name}` : ""}
              </dd>
              {title ? (
                <>
                  <dt>Title</dt>
                  <dd>{title}</dd>
                </>
              ) : null}
              <dt>Joined</dt>
              <dd>{joinedFull(member.joined)}</dd>
            </dl>
          </section>

          <section
            className="card"
            aria-labelledby="ss"
            style={{ padding: "18px 18px 8px", display: "flex", flexDirection: "column", gap: 12 }}
          >
            <h2 id="ss" className="p-panel">
              Sign-in and sessions
            </h2>
            <dl className="kv p-kv96">
              <dt>Method</dt>
              <dd>Google, {org.domain}</dd>
              <dt>2-step</dt>
              <dd>{member.twoStep === false ? "Off" : "On, authenticator app"}</dd>
            </dl>
            <div>
              {(member.sessions ?? []).map((s) => {
                const phone = s.device.includes("iPhone");
                return (
                  <div key={s.device} className="p-sess">
                    <span
                      className={s.current ? "p-ico32 is-seal" : "p-ico32 is-flat"}
                      aria-hidden="true"
                    >
                      {phone ? <IconPhone /> : <IconLaptop />}
                    </span>
                    <span>
                      {deviceLabel(s.device)} · {placeLabel(s.place)}
                      {s.current ? (
                        <>
                          <br />
                          <span
                            style={{
                              fontSize: 12,
                              color: "var(--active)",
                              fontWeight: 600,
                            }}
                          >
                            this session is current
                          </span>
                        </>
                      ) : null}
                    </span>
                    <span className="mono stamp">{s.lastActive}</span>
                  </div>
                );
              })}
              {!member.sessions?.length ? (
                <div
                  style={{
                    padding: "10px 0",
                    borderTop: "1px solid var(--rule)",
                    fontSize: 13,
                    color: "var(--ink-2)",
                  }}
                >
                  Last active {member.lastActive}
                </div>
              ) : null}
            </div>
          </section>

          <section
            className="card"
            aria-labelledby="ah"
            style={{ padding: "18px 18px 8px" }}
          >
            <h2 id="ah" className="p-panel" style={{ marginBottom: 8 }}>
              Access history
            </h2>
            <div>
              {history.map((h, i) => (
                <div key={i} className="p-ev">
                  <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
                    {h.when}
                  </span>
                  <span>{h.text}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="p-deact">
            {deactivated ? (
              <>
                <Button>Reactivate {firstName}</Button>
                <span>
                  {firstName} was deactivated
                  {member.deactivatedOn ? ` on ${member.deactivatedOn}` : ""}
                  {member.deactivatedBy ? ` by ${member.deactivatedBy}` : ""}.
                  Their history is kept, and reactivating restores the{" "}
                  {role.name} role.
                </span>
              </>
            ) : (
              <>
                <Button variant="dest">Deactivate {firstName}</Button>
                <span>
                  Deactivating blocks sign-in at once.{" "}
                  {isMaya ? "Her" : "Their"} teams, history and anything{" "}
                  {isMaya ? "she owns" : "they own"} stay, and you can
                  reactivate {isMaya ? "her" : "them"} later.
                </span>
              </>
            )}
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
