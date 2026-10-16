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
} from "@/lib/api";
import type { Role, Team } from "@/lib/types";
import { AppShell } from "@/components/Shell";
import { ButtonLink } from "@/components/Button";
import { IconTeams } from "@/components/icons";

/**
 * R-01 Teams (screens/Teams.html): a 3-column grid of team cards —
 * icon tile, member count, role-mix bar + caption, lead and last
 * change. Counts, leads and mixes are derived from the fixtures.
 * The one-line team descriptions and "last change" strings are the
 * screen's exact copy.
 */
const LIST_BLURB: Record<string, string> = {
  "customer-operations": "Support, onboarding and renewals",
  product: "Roadmap, design and research",
  engineering: "Platform and integrations",
  finance: "Billing, payroll and reporting",
  marketing: "Brand, content and events",
  leadership: "Company decisions and approvals",
};

const LIST_LAST_CHANGE: Record<string, string> = {
  "customer-operations": "Oct 4",
  product: "Oct 5 · Maya joined",
  engineering: "Sep 29",
  finance: "Sep 22",
  marketing: "Sep 18",
  leadership: "Sep 10",
};

/** Lead avatar tints, exactly as Teams.html draws each team's lead. */
const LEAD_TINTS: Record<string, string> = {
  "customer-operations": "#F0DDDA",
  product: "#E9E3D6",
  engineering: "#F0DDDA",
  finance: "#DDEBE2",
  marketing: "#E3DDF0",
  leadership: "#F0DDDA",
};

export const metadata: Metadata = { title: "Crewspace — Teams" };

/**
 * The designed mix order (Teams.html): the team's lead's role first,
 * then by allows descending, with Member/Guest last. The same order
 * drives the caption and the bar segments for every team.
 */
function orderedMix(team: Team): { role: Role; count: number }[] {
  const leadRoleId = team.leadId ? getMember(team.leadId)?.roleId : undefined;
  const isBase = (r: Role) => r.id === "member" || r.id === "guest";
  return [...teamRoleMix(team.id)].sort((a, b) => {
    const aLead = a.role.id === leadRoleId && !isBase(a.role) ? 0 : 1;
    const bLead = b.role.id === leadRoleId && !isBase(b.role) ? 0 : 1;
    if (aLead !== bLead) return aLead - bLead;
    const aBase = isBase(a.role) ? 1 : 0;
    const bBase = isBase(b.role) ? 1 : 0;
    if (aBase !== bBase) return aBase - bBase;
    return roleAllows(b.role) - roleAllows(a.role);
  });
}

/**
 * Bar colours anchored by role tier, not segment position (Teams.html):
 * Organization owner → --ink-bar; the admin tier (roles allowing ≥ 3)
 * → --seal for the first such segment and --seal-mid after; viewer
 * roles (Analyst, Finance viewer, Auditor) → --seal-mid;
 * Member/Guest → --control.
 */
function mixColor(role: Role, firstAdmin: boolean): string {
  if (role.id === "owner") return "var(--ink-bar)";
  if (role.id === "member" || role.id === "guest") return "var(--control)";
  if (roleAllows(role) >= 3)
    return firstAdmin ? "var(--seal)" : "var(--seal-mid)";
  return "var(--seal-mid)";
}

function isAdminTier(role: Role): boolean {
  return (
    role.id !== "owner" &&
    role.id !== "member" &&
    role.id !== "guest" &&
    roleAllows(role) >= 3
  );
}

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

function mixCaption(team: Team): string {
  const mix = orderedMix(team);
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

function TeamCard({ team }: { team: Team }) {
  const lead = team.leadId ? getMember(team.leadId) : undefined;
  const leadRole = lead ? getRole(lead.roleId) : undefined;
  const count = teamMemberCount(team.id);
  const mix = orderedMix(team);
  /* Adjacent segments of the same colour merge into one (Marketing:
     Member and Guest are both --control, drawn as a single 60%). */
  const segments: { color: string; pct: number }[] = [];
  let adminSeen = false;
  for (const { role, count: n } of mix) {
    const admin = isAdminTier(role);
    const color = mixColor(role, admin && !adminSeen);
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
              {LIST_BLURB[team.id] ?? team.blurb}
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
        <span className="mixcap">{mixCaption(team)}</span>
      </span>
      <span className="tc-foot">
        {lead ? (
          <span className="lead">
            <span
              className="lead-av"
              aria-hidden="true"
              style={{ background: LEAD_TINTS[team.id] ?? "var(--fill)" }}
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
          <span className="lbl">Last change</span>
          {LIST_LAST_CHANGE[team.id] ?? "—"}
        </span>
      </span>
    </Link>
  );
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

export default function TeamsPage() {
  const teams = [...getTeams()].sort(
    (a, b) => teamMemberCount(b.id) - teamMemberCount(a.id),
  );
  const members = getMembers();
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
        <ButtonLink variant="pri" href="#">
          <PlusIcon />
          New team
        </ButtonLink>
      </header>

      <div className="teams-toolbar">
        <div
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
              className="in"
              placeholder="Find a team or person"
              style={{ width: 270 }}
            />
          </span>
          <label htmlFor="s" className="sr-only">
            Sort
          </label>
          <select id="s" className="in" defaultValue="Most members">
            <option>Most members</option>
            <option>Name</option>
            <option>Recently changed</option>
          </select>
        </div>
        <span className="note">
          Bar shows each team’s mix of roles, darkest = most access
        </span>
      </div>

      <div role="list" aria-label="Teams" className="teams-grid">
        {teams.map((team) => (
          <TeamCard key={team.id} team={team} />
        ))}
      </div>

      <div className="teams-foot">
        <span>
          {totalPlacements()} placements across {teams.length} teams ·{" "}
          {members.length} people
        </span>
      </div>
    </AppShell>
  );
}
