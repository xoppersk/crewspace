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

/**
 * R-01 Teams (screens/Teams.html).
 * Counts, leads and the role-mix bar/captions are derived from the
 * fixtures via teamRoleMix / teamMemberCount. The one-line team
 * descriptions and "last change" strings are the screen's exact copy —
 * the fixture `blurb` strings differ for four teams and the fixtures
 * carry no per-team last-change field, so those strings live here.
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
 * → --seal; viewer roles (Analyst, Finance viewer, Auditor) →
 * --seal-mid; Member/Guest → --control. Only the first admin-tier
 * segment in the ordered mix takes --seal — in Customer operations
 * the seal segment sits on the Support leads (the lead's role) and
 * Product admin takes --seal-mid, exactly as the canvas draws it.
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

const ROW_GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0,1.4fr) 170px 90px minmax(0,1.3fr) 120px",
  gap: 18,
  alignItems: "center",
  padding: "14px 24px",
  borderTop: "1px solid var(--rule)",
  fontSize: 14,
  color: "var(--ink)",
  textDecoration: "none",
};

function mixCaption(team: Team): string {
  const mix = orderedMix(team);
  return mix
    .map(({ role, count }) => {
      if (role.id === "owner") return "Owner";
      return `${count} ${role.name}${count === 1 ? "" : "s"}`;
    })
    .join(" · ");
}

function TeamRow({ team }: { team: Team }) {
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
    <Link role="row" href={`/app/teams/${team.id}`} style={ROW_GRID}>
      <span role="cell">
        <b style={{ fontWeight: 600 }}>{team.name}</b>
        <small
          style={{
            display: "block",
            fontSize: 12,
            color: "var(--muted)",
            marginTop: 2,
          }}
        >
          {LIST_BLURB[team.id] ?? team.blurb}
        </small>
      </span>
      <span role="cell">
        {lead ? (
          <>
            {lead.name}
            <small
              style={{
                display: "block",
                fontSize: 12,
                color: "var(--muted)",
                marginTop: 2,
              }}
            >
              {leadRole?.name}
            </small>
          </>
        ) : (
          "—"
        )}
      </span>
      <span role="cell" className="mono">
        {count}
      </span>
      <span role="cell">
        <span
          aria-hidden="true"
          style={{
            display: "flex",
            height: 8,
            borderRadius: 2,
            overflow: "hidden",
            background: "var(--rule)",
          }}
        >
          {segments.map((seg, i) => (
            <i
              key={i}
              style={{
                display: "block",
                height: "100%",
                width: `${seg.pct}%`,
                background: seg.color,
              }}
            />
          ))}
        </span>
        <small
          style={{
            display: "block",
            fontSize: 12,
            color: "var(--muted)",
            marginTop: 2,
          }}
        >
          {mixCaption(team)}
        </small>
      </span>
      <span role="cell" style={{ color: "var(--ink-2)" }}>
        {LIST_LAST_CHANGE[team.id] ?? "—"}
      </span>
    </Link>
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
      <div className="page-head">
        <div className="stack">
          <h1 className="title">Teams</h1>
          <p className="lead" style={{ maxWidth: "48em" }}>
            {teams.length} teams group the work. Everyone is on at least one
            team and {onTwoTeams} people are on two. Teams never grant
            access on their own: what someone can do comes from their role.
          </p>
        </div>
        <div className="head-actions">
          <ButtonLink variant="pri" href="#">
            New team
          </ButtonLink>
        </div>
      </div>

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
        <input
          id="q"
          className="in"
          placeholder="Find a team or person"
          style={{ width: 260 }}
        />
        <label htmlFor="s" className="sr-only">
          Sort
        </label>
        <select id="s" className="in" defaultValue="Most members">
          <option>Most members</option>
          <option>Name</option>
          <option>Recently changed</option>
        </select>
      </div>

      <section className="sheet">
        <div className="rows-scroll">
          <div role="table" aria-label="Teams" style={{ minWidth: 820 }}>
            <div
              role="row"
              style={{
                ...ROW_GRID,
                borderTop: 0,
                paddingTop: 10,
                paddingBottom: 10,
                fontSize: 12,
                color: "var(--muted)",
              }}
            >
              <span role="columnheader">Team</span>
              <span role="columnheader">Lead</span>
              <span role="columnheader">Members</span>
              <span role="columnheader">Roles inside the team</span>
              <span role="columnheader">Last change</span>
            </div>
            {teams.map((team) => (
              <TeamRow key={team.id} team={team} />
            ))}
          </div>
        </div>
        <div
          style={{
            padding: "12px 24px",
            borderTop: "1px solid var(--rule-strong)",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            gap: 10,
            fontSize: 13,
            color: "var(--muted)",
          }}
        >
          <span>
            {totalPlacements()} placements across {teams.length} teams ·{" "}
            {members.length} people
          </span>
          <span>Bar shows each team’s mix of roles, darkest = most access</span>
        </div>
      </section>
    </AppShell>
  );
}
