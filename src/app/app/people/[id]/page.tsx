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

/* P-04 Member detail — screens/MemberDetail.html.
   Maya Jordan (042) is the designed record; every other id renders the
   same template from fixture data. Permissions 1–10 and Read audit log
   (13) are listed individually; 11, 12 and 14–18 collapse into the
   screen's single "7 others" row. */

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

  const headGroups = org.groups.slice(0, 4);
  const tailGroups = org.groups.slice(4);
  const tailLabel = tailGroups.map((g) => g.name).join(", ");

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
    return (
      <div
        role="row"
        key={permission.id}
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 110px minmax(0, 1fr)",
          gap: 16,
          padding: "8px 24px",
          fontSize: 13,
          alignItems: "baseline",
          background: change ? "var(--sheet-tint)" : undefined,
        }}
      >
        <span role="cell">{permission.name}</span>
        <span
          role="cell"
          style={
            result === "Allowed"
              ? { fontWeight: 600, color: "var(--ink)" }
              : { color: "var(--muted)" }
          }
        >
          {result}
        </span>
        <span role="cell" style={{ color: "var(--muted)", fontSize: 12 }}>
          {sourceText}
          {permission.id === 4 && result === "Allowed"
            ? " · up to Product admin"
            : ""}
          {change ? (
            <>
              {" · "}
              <span style={{ color: "var(--seal)", fontWeight: 600 }}>
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

  return (
    <AppShell current="directory">
      <div className="crumb">
        <Link href="/app/people">Directory</Link> / {member.name}
      </div>

      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: 14,
          alignItems: "flex-start",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="register">Member {member.id}</span>
          <h1 className="title">{member.name}</h1>
          <span style={{ fontSize: 14, color: "var(--ink-2)" }}>
            {title ? `${title} · ` : ""}
            {member.email} ·{" "}
            {deactivated ? (
              <span style={{ color: "var(--muted)", fontWeight: 600 }}>
                Deactivated {member.deactivatedOn ?? ""}
                {member.deactivatedBy ? ` by ${member.deactivatedBy}` : ""}
              </span>
            ) : (
              <>
                <span style={{ color: "var(--active)", fontWeight: 600 }}>
                  Active
                </span>{" "}
                since {member.joined}
              </>
            )}
          </span>
        </div>
        <div className="head-actions">
          <Button>Sign out everywhere</Button>
          <Button variant="pri">Change role</Button>
        </div>
      </header>

      {isMaya ? (
        <p className="lead" style={{ maxWidth: "52em" }}>
          Maya is a <Link href="/app/roles/product-admin">Product admin</Link>{" "}
          on the Product team. She can invite people, change roles and
          organize teams. She can’t edit what roles allow, deactivate anyone,
          or see billing.
        </p>
      ) : (
        <p className="lead" style={{ maxWidth: "52em" }}>
          {firstName} is a <Link href={`/app/roles/${role.id}`}>{role.name}</Link>
          {firstTeam ? <> on the {firstTeam.name} team</> : null}.{" "}
          {role.summary}
        </p>
      )}

      <div className="cols">
        <section
          className="sheet"
          aria-labelledby="ea"
          style={{ flex: "999 1 600px", minWidth: 0, overflowX: "auto" }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 8,
              padding: "16px 24px 12px",
            }}
          >
            <h2 id="ea" className="section">
              What {firstName} can do, and why
            </h2>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>
              {allowedCount} of 18 allowed
            </span>
          </div>
          <div
            role="table"
            aria-label="Effective permissions"
            style={{ minWidth: 560, paddingBottom: 10 }}
          >
            <div
              role="row"
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) 110px minmax(0, 1fr)",
                gap: 16,
                padding: "8px 24px",
                fontSize: 12,
                color: "var(--muted)",
                borderTop: "1px solid var(--rule-strong)",
                alignItems: "baseline",
              }}
            >
              <span role="columnheader">Permission</span>
              <span role="columnheader">Result</span>
              <span role="columnheader">Comes from</span>
            </div>
            {headGroups.map((g) => (
              <div key={g.name}>
                <div
                  role="row"
                  style={{
                    padding: "12px 24px 4px",
                    borderTop: "1px solid var(--rule-strong)",
                    font: "600 13px/1.2 var(--font-sans)",
                  }}
                >
                  <span role="columnheader">{g.name}</span>
                </div>
                {g.permissionIds.map(renderRow)}
              </div>
            ))}
            <div>
              <div
                role="row"
                style={{
                  padding: "12px 24px 4px",
                  borderTop: "1px solid var(--rule-strong)",
                  font: "600 13px/1.2 var(--font-sans)",
                }}
              >
                <span role="columnheader">{tailLabel}</span>
              </div>
              {renderRow(13)}
              <div
                role="row"
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) 110px minmax(0, 1fr)",
                  gap: 16,
                  padding: "8px 24px",
                  fontSize: 13,
                  alignItems: "baseline",
                }}
              >
                <span role="cell">7 others</span>
                <span role="cell" style={{ color: "var(--muted)" }}>
                  Blocked
                </span>
                <span
                  role="cell"
                  style={{ color: "var(--muted)", fontSize: 12 }}
                >
                  Sign-in methods, sign members out, export audit, view
                  billing, manage plan, organization settings, transfer
                  ownership
                </span>
              </div>
            </div>
          </div>
        </section>

        <aside className="side-col">
          <section className="sheet panel-box" aria-labelledby="pf">
            <h2 id="pf" className="panel">
              Record
            </h2>
            <dl className="kv" style={{ gridTemplateColumns: "110px minmax(0, 1fr)" }}>
              <dt>Role</dt>
              <dd>
                <Link href={`/app/roles/${role.id}`}>{role.name}</Link>{" "}
                <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
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

          <section className="sheet panel-box" aria-labelledby="ss">
            <h2 id="ss" className="panel">
              Sign-in and sessions
            </h2>
            <dl className="kv" style={{ gridTemplateColumns: "110px minmax(0, 1fr)" }}>
              <dt>Method</dt>
              <dd>Google, {org.domain}</dd>
              <dt>2-step</dt>
              <dd>{member.twoStep === false ? "Off" : "On, authenticator app"}</dd>
            </dl>
            <div>
              {(member.sessions ?? []).map((s) => (
                <div
                  key={s.device}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "52px minmax(0, 1fr)",
                    gap: 10,
                    padding: "9px 0",
                    borderTop: "1px solid var(--rule)",
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  <span
                    className="mono"
                    style={{ fontSize: 12, color: "var(--muted)" }}
                  >
                    {s.lastActive}
                  </span>
                  <span>
                    {deviceLabel(s.device)} · {placeLabel(s.place)}
                    {s.current ? (
                      <>
                        <br />
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>
                          this session is current
                        </span>
                      </>
                    ) : null}
                  </span>
                </div>
              ))}
              {!member.sessions?.length ? (
                <div
                  style={{
                    padding: "9px 0",
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
            className="sheet"
            aria-labelledby="ah"
            style={{ padding: "18px 20px 10px" }}
          >
            <h2 id="ah" className="panel" style={{ marginBottom: 6 }}>
              Access history
            </h2>
            <div>
              {history.map((h, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "52px minmax(0, 1fr)",
                    gap: 10,
                    padding: "9px 0",
                    borderTop: "1px solid var(--rule)",
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  <span
                    className="mono"
                    style={{ fontSize: 12, color: "var(--muted)" }}
                  >
                    {h.when}
                  </span>
                  <span>{h.text}</span>
                </div>
              ))}
            </div>
          </section>

          <section
            style={{
              padding: "4px 4px 0",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              fontSize: 13,
              lineHeight: 1.5,
              color: "var(--ink-2)",
            }}
          >
            {deactivated ? (
              <>
                <Button style={{ alignSelf: "flex-start" }}>
                  Reactivate {firstName}
                </Button>
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
                <Button
                  variant="dest"
                  style={{ alignSelf: "flex-start" }}
                >
                  Deactivate {firstName}
                </Button>
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
