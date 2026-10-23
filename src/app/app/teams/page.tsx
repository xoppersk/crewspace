import type { Metadata } from "next";
import Link from "next/link";
import {
  getMember,
  getMembers,
  getRole,
  getTeams,
  roleAllows,
  teamMemberCount,
  teamRoleMix,
  totalPlacements,
  type WorkspaceData,
} from "@/lib/api";
import { loadActiveWorkspaceData } from "@/lib/data/server";
import { NewTeamForm } from "./NewTeamForm";
import type { Role, Team } from "@/lib/types";
import { AppShell } from "@/components/Shell";
import { tintFor } from "@/components/MemberRow";
import { IconTeams } from "@/components/icons";

/**
 * R-01 Teams (screens/Teams.html): a 3-column grid of team cards —
 * icon tile, member count, role-mix bar + caption, lead and last
 * change. Counts, leads, mixes, descriptions and last-change
 * strings all derive from the workspace's real data.
 */

export const metadata: Metadata = { title: "Crewspace — Teams" };

/**
 * The designed mix order (Teams.html): the team's lead's role first,
 * then by allows descending, with Member/Guest last. The same order
 * drives the caption and the bar segments for every team.
 */
function orderedMix(data: WorkspaceData, team: Team): { role: Role; count: number }[] {
  const leadRoleId = team.leadId ? getMember(data, team.leadId)?.roleId : undefined;
  const isBase = (r: Role) => r.id === "member" || r.id === "guest";
  return [...teamRoleMix(data, team.id)].sort((a, b) => {
    const aLead = a.role.id === leadRoleId && !isBase(a.role) ? 0 : 1;
    const bLead = b.role.id === leadRoleId && !isBase(b.role) ? 0 : 1;
    if (aLead !== bLead) return aLead - bLead;
    const aBase = isBase(a.role) ? 1 : 0;
    const bBase = isBase(b.role) ? 1 : 0;
    if (aBase !== bBase) return aBase - bBase;
    return roleAllows(data, b.role) - roleAllows(data, a.role);
  });
}

/**
 * Bar colours anchored by role tier, not segment position (Teams.html):
 * Organization owner → --ink-bar; the admin tier (roles allowing ≥ 3)
 * → --seal for the first such segment and --seal-mid after; viewer
 * roles (Analyst, Finance viewer, Auditor) → --seal-mid;
 * Member/Guest → --control.
 */
function mixColor(data: WorkspaceData, role: Role, firstAdmin: boolean): string {
  if (role.id === "owner") return "var(--ink-bar)";
  if (role.id === "member" || role.id === "guest") return "var(--control)";
  if (roleAllows(data, role) >= 3)
    return firstAdmin ? "var(--seal)" : "var(--seal-mid)";
  return "var(--seal-mid)";
}

function isAdminTier(data: WorkspaceData, role: Role): boolean {
  return (
    role.id !== "owner" &&
    role.id !== "member" &&
    role.id !== "guest" &&
    roleAllows(data, role) >= 3
  );
}

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

function mixCaption(data: WorkspaceData, team: Team): string {
  const mix = orderedMix(data, team);
  /* Teams.html folds the Guest into "Members" in the caption (the
     Marketing card reads "3 Members" for 2 Members + 1 Guest, and the
     bar draws them as one --control segment). */
  const guestCount = mix.find((x) => x.role.id === "guest")?.count ?? 0;
  return mix
    .filter(({ role }) => role.id !== "guest")
    .map(({ role, count }) => {
      if (role.id === "owner") return "Owner";
      const n = role.id === "member" ? count + guestCount : count;
      return `${n} ${role.name}${n === 1 ? "" : "s"}`;
    })
    .join(" · ");
}

function TeamCard({ data, team }: { data: WorkspaceData; team: Team }) {
  const lead = team.leadId ? getMember(data, team.leadId) : undefined;
  const leadRole = lead ? getRole(data, lead.roleId) : undefined;
  const count = teamMemberCount(data, team.id);
  const mix = orderedMix(data, team);
  /* Adjacent segments of the same colour merge into one (Marketing:
     Member and Guest are both --control, drawn as a single 60%). */
  const segments: { color: string; pct: number }[] = [];
  let adminSeen = false;
  for (const { role, count: n } of mix) {
    const admin = isAdminTier(data, role);
    const color = mixColor(data, role, admin && !adminSeen);
    if (admin) adminSeen = true;
    const pct = count ? (n / count) * 100 : 0;
    const last = segments[segments.length - 1];
    if (last && last.color === color) last.pct += pct;
    else segments.push({ color, pct });
  }

  return (
    <Link role="listitem" href={`/app/teams/${team.id}`} className="card team-card">
      <span className="tc-head">
        <span className="tc-id">
          <span className="tile40" aria-hidden="true">
            <IconTeams strokeWidth={1.4} />
          </span>
          <span style={{ minWidth: 0 }}>
            <span className="tname">{team.name}</span>
            <span className="tblurb">
              {team.blurb}
            </span>
          </span>
        </span>
        <span className="tcount">
          <span className="mono">{count}</span>
          <span className="lbl">members</span>
        </span>
      </span>
      <span className="mix">
        <span className="mlbl">Roles inside the team</span>
        <span className="mixbar" aria-hidden="true">
          {segments.map((seg, i) => (
            <i
              key={i}
              style={{ width: `${seg.pct}%`, background: seg.color }}
            />
          ))}
        </span>
        <span className="mixcap">{mixCaption(data, team)}</span>
      </span>
      <span className="tc-foot">
        {lead ? (
          <span className="lead">
            <span
              className="lead-av"
              aria-hidden="true"
              style={{ background: tintFor(team.id) }}
            >
              {initialsOf(lead.name)}
            </span>
            <span>
              <b>{lead.name}</b>
              <small>{leadRole?.name}</small>
            </span>
          </span>
        ) : (
          <span className="lead">No lead yet</span>
        )}
        <span className="lastchg">
          <span className="lbl">Last change</span>—
        </span>
      </span>
    </Link>
  );
}


export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const data = await loadActiveWorkspaceData();
  if (!data) {
    return <AppShell current="teams">{null}</AppShell>;
  }
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  let teams = [...getTeams(data)];
  if (q) {
    teams = teams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        getMembers(data).some(
          (m) =>
            m.teams.some((x) => x.teamId === t.id) &&
            m.name.toLowerCase().includes(q),
        ),
    );
  }
  if (sp.sort === "Name") {
    teams.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    teams.sort(
      (a, b) => teamMemberCount(data, b.id) - teamMemberCount(data, a.id),
    );
  }
  const members = getMembers(data);
  const onTwoTeams = members.filter((m) => m.teams.length === 2).length;

  return (
    <AppShell current="teams">
      <header className="spage-head">
        <div className="stack">
          <h1 className="stitle">Teams</h1>
          <p className="sled">
            {teams.length} teams group the work. Everyone is on at least one
            team and {onTwoTeams} people are on two. Teams never grant
            access on their own: what someone can do comes from their role.
          </p>
        </div>
        <NewTeamForm />
      </header>

      <div className="teams-toolbar">
        <form
          method="get"
          role="search"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
          }}
        >
          <label htmlFor="q" className="sr-only">
            Find a team or person
          </label>
          <span className="srch">
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <circle cx="7" cy="7" r="4.5" />
              <path d="m10.5 10.5 3.5 3.5" />
            </svg>
            <input
              id="q"
              name="q"
              className="in"
              placeholder="Find a team or person"
              defaultValue={sp.q ?? ""}
              style={{ width: 270 }}
            />
          </span>
          <label htmlFor="s" className="sr-only">
            Sort
          </label>
          <select id="s" name="sort" className="in" defaultValue={sp.sort ?? "Most members"}>
            <option>Most members</option>
            <option>Name</option>
          </select>
          <button type="submit" className="btn" style={{ height: 38 }}>
            Search
          </button>
        </form>
        <span className="note">
          Bar shows each team’s mix of roles, darkest = most access
        </span>
      </div>

      <div role="list" aria-label="Teams" className="teams-grid">
        {teams.map((team) => (
          <TeamCard key={team.id} data={data} team={team} />
        ))}
      </div>

      <div className="teams-foot">
        <span>
          {totalPlacements(data)} placements across {teams.length} teams ·{" "}
          {members.length} people
        </span>
      </div>
    </AppShell>
  );
}
