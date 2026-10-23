import Link from "next/link";
import type { Invitation, Member, Role, Team } from "@/lib/types";
import { RoleTag } from "./RoleTag";

/* Avatar tints (Directory.html): the screens draw one stable tint per
   person — the same person carries the same tint on every screen.
   Fixtures carry no tint field, so the pinned tints live here; members
   no screen pins fall back to a rotation over the same six tints.
   All six hexes are drawn literally by the screens. */
const TINTS: Record<string, string> = {
  "001": "#F0DDDA", // Sheku Koroma
  "007": "#F0DDDA", // Tomás Rivera
  "008": "#DCE3F4", // Felix Grant
  "011": "#F0DDDA", // Owen Clarke
  "012": "#E9E3D6", // Jonah Price
  "014": "#DDEBE2", // Grace Mensah
  "017": "#E9E3D6", // Daniel Okafor
  "019": "#E6E9EE", // Nadia Rahman
  "021": "#DDEBE2", // Elif Kaya
  "023": "#E3DDF0", // Ama Boateng
  "024": "#DDEBE2", // Iris Novak
  "026": "#DCE3F4", // Ken Ito
  "027": "#E3DDF0", // Rita Alvarez
  "029": "#DDEBE2", // Marcus Bell
  "031": "#DCE3F4", // Lucas Meyer
  "035": "#F0DDDA", // Sofia Duarte
  "036": "#E6E9EE", // Zoe Adams
  "040": "#E6E9EE", // Yusuf Ali
  "042": "#E6E9EE", // Maya Jordan
};
const TINT_ROTATION = [
  "#F0DDDA",
  "#DCE3F4",
  "#E9E3D6",
  "#DDEBE2",
  "#E3DDF0",
  "#E6E9EE",
];

export function tintFor(id: string): string {
  if (TINTS[id]) return TINTS[id]!;
  // Real member ids are uuids: rotate deterministically by hash.
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TINT_ROTATION[h % TINT_ROTATION.length]!;
}

/** Short register reference for a member id (uuid) in table cells. */
export function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

export function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function teamText(member: Member, teams: Team[]): React.ReactNode {
  if (member.status === "deactivated") return "—";
  if (member.teams.length === 0) return "—";
  return member.teams.map((t, i) => {
    const team = teams.find((x) => x.id === t.teamId)!;
    return (
      <span key={t.teamId}>
        {i > 0 ? ", " : ""}
        {team.name}
        {t.lead ? <span style={{ color: "var(--muted)" }}> · lead</span> : null}
      </span>
    );
  });
}

/** P-02 Directory row for a member. Clicking opens the member drawer. */
export function MemberRow({
  member,
  roles,
  teams,
  highlighted = false,
  you = false,
  href,
}: {
  member: Member;
  roles: Role[];
  teams: Team[];
  highlighted?: boolean;
  you?: boolean;
  /** Row target; the Directory passes one that keeps its filters in the URL. */
  href?: string;
}) {
  const role = roles.find((r) => r.id === member.roleId)!;
  const deactivated = member.status === "deactivated";
  return (
    <Link
      role="row"
      href={href ?? `/app/people?open=${member.id}`}
      className={highlighted ? "mr p-hl" : "mr"}
    >
      <span role="cell" className="rg mono">
        {shortId(member.id)}
      </span>
      <span role="cell" className="p-pm">
        <span
          className={deactivated ? "p-avr deact" : "p-avr"}
          aria-hidden="true"
          style={deactivated ? undefined : { background: tintFor(member.id) }}
        >
          {initialsOf(member.name)}
        </span>
        <span style={{ minWidth: 0 }}>
          <b
            style={{
              fontWeight: 600,
              color: deactivated ? "var(--muted)" : undefined,
            }}
          >
            {member.name}
          </b>{" "}
          {you ? (
            <span style={{ fontSize: 12, color: "var(--muted)" }}>(you)</span>
          ) : null}
          {member.isNew ? <span className="newmark">New</span> : null}
          <small>
            {member.email}
            {deactivated && member.deactivatedOn
              ? ` · deactivated ${member.deactivatedOn} by you`
              : ""}
            {member.externalOrg ? " · outside the organization" : ""}
          </small>
        </span>
      </span>
      <span role="cell">
        <RoleTag role={role} link={false} quiet={deactivated} />
      </span>
      <span
        role="cell"
        style={{ color: deactivated ? "var(--muted)" : "var(--ink-2)" }}
      >
        {teamText(member, teams)}
      </span>
      <span role="cell" className={deactivated ? "p-st is-off" : "p-st is-ok"}>
        {deactivated ? "Deactivated" : "Active"}
      </span>
      <span
        role="cell"
        style={{ color: deactivated ? "var(--muted)" : "var(--ink-2)" }}
      >
        {member.lastActive}
      </span>
    </Link>
  );
}

/** Directory row for an open invitation: no number yet, dashed tag. */
export function InvitationRow({
  invitation,
  roles,
  teams,
}: {
  invitation: Invitation;
  roles: Role[];
  teams: Team[];
}) {
  const role = roles.find((r) => r.id === invitation.roleId)!;
  const team = teams.find((t) => t.id === invitation.teamId);
  return (
    <div role="row" className="mr p-invrow">
      <span role="cell" className="rg">
        —
      </span>
      <span role="cell" className="p-pm">
        <span className="p-avr invited" aria-hidden="true">
          {initialsOf(invitation.name)}
        </span>
        <span style={{ minWidth: 0 }}>
          <b style={{ fontWeight: 600, color: "var(--ink-2)" }}>
            {invitation.name}
          </b>
          <small>{invitation.email}</small>
        </span>
      </span>
      <span role="cell">
        <RoleTag role={role} dashed quiet link={false} />
      </span>
      <span role="cell" style={{ color: "var(--ink-2)" }}>
        {team?.name ?? "—"}
      </span>
      <span role="cell" className="p-st is-pe">
        Invited
      </span>
      <span role="cell" style={{ color: "var(--muted)" }}>
        —
      </span>
    </div>
  );
}
