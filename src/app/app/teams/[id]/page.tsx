import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getInvitations,
  getMember,
  getRole,
  getTeam,
  roleAllows,
  teamMembers,
  teamRoleMix,
} from "@/lib/api";
import {
  getActiveWorkspace,
  getMyPermissionKeys,
  loadActiveWorkspaceData,
} from "@/lib/data/server";
import { shortId } from "@/components/MemberRow";
import { TeamRowActions } from "./TeamRowActions";
import type { Member, Role } from "@/lib/types";
import { AppShell } from "@/components/Shell";
import { ButtonLink } from "@/components/Button";
import { PermissionStrip } from "@/components/PermissionStrip";
import { RoleTag } from "@/components/RoleTag";
import { EmptyTeamState } from "@/components/States";
import { IconTeams } from "@/components/icons";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await loadActiveWorkspaceData();
  const team = data ? getTeam(data, id) : undefined;
  return {
    title: team ? `Crewspace — ${team.name} team` : "Crewspace — Teams",
  };
}

/**
 * R-02 Team detail (screens/TeamDetail.html): header card with the
 * role-mix caption, the member table (avatars, Lead/New chips, the
 * invited row), and side panels — access mix with 8px strips, the
 * DARK lead panel, and recent changes in a card.
 */

/** Avatar tints exactly as TeamDetail.html draws the Product rows,
    keyed by member id; other teams rotate the same palette. */
const AV_TINTS: Record<string, string> = {
  "017": "#E9E3D6",
  "023": "#E3DDF0",
  "031": "#DCE3F4",
  "042": "#E6E9EE",
  "019": "#E6E9EE",
  "026": "#DCE3F4",
  "035": "#F0DDDA",
  "012": "#E9E3D6",
  "021": "#DDEBE2",
  "029": "#DDEBE2",
  "036": "#E6E9EE",
  "040": "#E6E9EE",
};
const AV_FALLBACK = ["#E9E3D6", "#E3DDF0", "#DCE3F4", "#DDEBE2", "#F0DDDA", "#E6E9EE"];

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

function tintFor(m: Member, index: number): string {
  return AV_TINTS[m.id] ?? AV_FALLBACK[index % AV_FALLBACK.length]!;
}

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <circle cx="3.5" cy="8" r="1" fill="currentColor" />
      <circle cx="8" cy="8" r="1" fill="currentColor" />
      <circle cx="12.5" cy="8" r="1" fill="currentColor" />
    </svg>
  );
}

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await loadActiveWorkspaceData();
  if (!data) {
    return <AppShell current="teams">{null}</AppShell>;
  }
  const team = getTeam(data, id);
  if (!team) notFound();
  const ws = await getActiveWorkspace();
  const myKeys = ws ? await getMyPermissionKeys(ws.orgId) : [];
  const canManageTeam = myKeys.includes("teams:manage");

  /* X-02: a real team with nobody on it yet. */
  if (teamMembers(data, id).length === 0) {
    return (
      <AppShell current="teams">
        <EmptyTeamState
          team={team}
          orgName={data.org.name}
          suggestions={data.members
            .filter((m) => m.status === "active")
            .slice(0, 3)
            .map((m) => ({
              member: m,
              roleName: getRole(data, m.roleId)?.name ?? "",
            }))}
        />
      </AppShell>
    );
  }

  const lead = team.leadId ? getMember(data, team.leadId) : undefined;
  const rows = teamMembers(data, id)
    .filter((m) => m.status === "active")
    .sort((a, b) => {
      const byRole =
        roleAllows(data, getRole(data, b.roleId)!) -
        roleAllows(data, getRole(data, a.roleId)!);
      return byRole !== 0 ? byRole : a.id.localeCompare(b.id);
    });
  // Designed TeamDetail shows only the open invitation (Priya). A bounced
  // invitation never arrived, so it gets no invited row on the team.
  const invited = getInvitations(data).filter(
    (i) => i.teamId === id && i.status === "open",
  );
  const mix = teamRoleMix(data, id)
    .filter((x) =>
      teamMembers(data, id).some(
        (m) => m.roleId === x.role.id && m.status === "active",
      ),
    )
    .sort((a, b) => roleAllows(data, b.role) - roleAllows(data, a.role));
  const mixCaption = mix
    .map(({ role, count }: { role: Role; count: number }) =>
      role.id === "owner"
        ? "Owner"
        : `${count} ${role.name}${count === 1 ? "" : "s"}`,
    )
    .join(" · ");
  const recentFromAudit = data.auditEntries
    .filter((e) => e.summary.includes(team.name))
    .slice(0, 3)
    .map((e) => ({
      when: e.day.replace(/^[A-Za-z]+,\s*/, "").replace(/^(\w{3})[a-z]+ /, "$1 "),
      text: e.summary,
    }));
  const recent =
    recentFromAudit.length > 0
      ? recentFromAudit
      : [{ when: "—", text: "Last change recorded in the audit log" }];

  return (
    <AppShell current="teams">
      <div className="crumb">
        <Link href="/app/teams">Teams</Link>{" "}
        <span className="sep">/</span>{" "}
        {team.name}
      </div>
      <div className="split-340">
        <div className="main-col-stack">
          <header className="card team-head">
            <div className="head-top">
              <div className="id-row">
                <span className="tile52" aria-hidden="true">
                  <IconTeams strokeWidth={1.3} />
                </span>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  <h1 className="stitle">{team.name}</h1>
                  <span className="subline">
                    Team <span className="mono">{team.regNumber}</span> ·{" "}
                    {team.blurb}
                    {lead ? ` · led by ${lead.name}` : " · no lead yet"}
                  </span>
                </div>
              </div>
              <div className="head-actions">
                <ButtonLink href="/app/settings">Team settings</ButtonLink>
                <ButtonLink variant="pri" href="/app/invitations">
                  <PlusIcon />
                  Add people
                </ButtonLink>
              </div>
            </div>
            <div className="meta-row">
              <span className="av-stack" aria-hidden="true">
                {rows.slice(0, 5).map((m, i) => (
                  <span
                    key={m.id}
                    className="av"
                    style={{ background: tintFor(m, i) }}
                  >
                    {initialsOf(m.name)}
                  </span>
                ))}
              </span>
              <span className="mixcap">{mixCaption}</span>
            </div>
          </header>

          <section className="card" style={{ overflow: "hidden" }}>
            <div className="card-head">
              <h2>Members · {rows.length}</h2>
              <span className="sub">Sorted by role, then register number</span>
            </div>
            <div className="rows-scroll">
              <div
                role="table"
                aria-label={`${team.name} team members`}
                style={{ minWidth: 680 }}
              >
                <div role="row" className="team-mr th">
                  <span role="columnheader">No.</span>
                  <span role="columnheader">Person</span>
                  <span role="columnheader">Role</span>
                  <span role="columnheader">Also on</span>
                  <span role="columnheader">Joined</span>
                  <span role="columnheader">
                    <span className="sr-only">Actions</span>
                  </span>
                </div>
                {rows.map((m, i) => {
                  const role = getRole(data, m.roleId)!;
                  const alsoOn = m.teams.filter((t) => t.teamId !== id);
                  const isLead = m.teams.find((t) => t.teamId === id)?.lead;
                  return (
                    <div
                      role="row"
                      className={`team-mr${m.isNew ? " hl" : ""}`}
                      key={m.id}
                    >
                      <span role="cell" className="rg mono">
                        {shortId(m.id)}
                      </span>
                      <span role="cell" className="person">
                        <span
                          className="avr"
                          aria-hidden="true"
                          style={{ background: tintFor(m, i) }}
                        >
                          {initialsOf(m.name)}
                        </span>
                        <span style={{ minWidth: 0 }}>
                          <b>{m.name}</b>
                          {isLead ? (
                            <span className="lead-chip">Lead</span>
                          ) : null}
                          {m.isNew ? (
                            <span className="lead-chip">New</span>
                          ) : null}
                          <small>{m.email}</small>
                        </span>
                      </span>
                      <span role="cell">
                        {/* TeamDetail.html: only the Product admin tag
                            is a link; every other role tag is a span. */}
                        <RoleTag role={role} link />
                      </span>
                      <span
                        role="cell"
                        style={{
                          color: alsoOn.length
                            ? "var(--ink-2)"
                            : "var(--muted)",
                        }}
                      >
                        {alsoOn.length
                          ? alsoOn
                              .map((t) => getTeam(data, t.teamId)?.name)
                              .join(", ")
                          : "—"}
                      </span>
                      <span role="cell" style={{ color: "var(--ink-2)" }}>
                        {m.joined}
                      </span>
                      <span role="cell">
                        {canManageTeam ? (
                          <TeamRowActions
                            membershipId={m.id}
                            teamId={id}
                            memberName={m.name}
                          />
                        ) : (
                          <button
                            type="button"
                            className="mx"
                            aria-label={`More for ${m.name}`}
                          >
                            <DotsIcon />
                          </button>
                        )}
                      </span>
                    </div>
                  );
                })}
                {invited.map((inv) => {
                  const role = getRole(data, inv.roleId)!;
                  const inviter = getMember(data, inv.invitedById);
                  return (
                    <div role="row" className="team-mr invited-row" key={inv.id}>
                      <span role="cell" className="rg">
                        —
                      </span>
                      <span role="cell" className="person">
                        <span className="avr invited" aria-hidden="true">
                          {initialsOf(inv.name)}
                        </span>
                        <span style={{ minWidth: 0 }}>
                          <b style={{ color: "var(--ink-2)" }}>{inv.name}</b>
                          <small>
                            {inv.email} · invited {inv.sent} by {inviter?.name}
                          </small>
                        </span>
                      </span>
                      <span role="cell">
                        <RoleTag role={role} dashed quiet link={false} />
                      </span>
                      <span role="cell">
                        <span className="inv-state">
                          Invited · expires {inv.expires}
                        </span>
                      </span>
                      <span role="cell">
                        <Link
                          href="/app/invitations"
                          style={{ fontSize: 13, fontWeight: 600 }}
                        >
                          Resend
                        </Link>
                      </span>
                      <span role="cell" />
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        <aside className="aside-sticky" style={{ position: "static" }}>
          <section
            className="card"
            aria-labelledby="acc"
            style={{
              padding: "18px 18px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <h2
              id="acc"
              style={{ margin: 0, font: "700 15px/1.3 var(--font-sans)" }}
            >
              Where this team’s access comes from
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                lineHeight: 1.5,
                color: "var(--ink-2)",
              }}
            >
              Being on {team.name} grants nothing by itself. Each person’s
              role decides what they can do anywhere in {data.org.name}.
            </p>
            <div>
              {mix.map(({ role, count }) => (
                <div className="access-mix" key={role.id}>
                  <div className="ll">
                    {/* Access panel: only Product admin is a link
                        (TeamDetail.html); the rest are plain names. */}
                    <Link href={`/app/roles/${role.id}`}>{role.name}</Link>
                    <i />
                    <span className="mono">{count}</span>
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>
                      allows {roleAllows(data, role)} of 18
                    </span>
                  </div>
                  <PermissionStrip role={role} permissions={data.org.permissions} baselineIds={data.org.baseline.allowedPermissionIds} full showCount={false} />
                </div>
              ))}
            </div>
            <p className="access-note">
              Removing someone from this team leaves their role and access
              unchanged. To change what they can do,{" "}
              <Link href="/app/roles">change their role</Link>.
            </p>
          </section>

          {lead ? (
            <section className="dpanel" aria-labelledby="leadp" style={{ gap: 10 }}>
              <div className="lead-head">
                <span className="av dk-av" aria-hidden="true">
                  {initialsOf(lead.name)}
                </span>
                <h2 id="leadp">What the lead does</h2>
              </div>
              <span className="lead-body">
                {lead.name.split(" ")[0]} gets a copy of every invitation to
                this team and is asked first when someone requests a role
                change here. Leading a team is not a permission.
              </span>
            </section>
          ) : null}

          <section className="card recent-card" aria-labelledby="ch">
            <h2 id="ch">Recent changes</h2>
            {recent.map((r, i) => (
              <span className="rrow" key={i}>
                <span
                  className="mono"
                  style={{ fontSize: 12, color: "var(--muted)" }}
                >
                  {r.when}
                </span>{" "}
                · {r.text}
              </span>
            ))}
            <Link href="/app/audit" className="rlink">
              Open in audit log
            </Link>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
