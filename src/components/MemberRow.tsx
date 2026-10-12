import Link from "next/link";
import { getRole, getTeam } from "@/lib/api";
import type { Invitation, Member } from "@/lib/types";
import { RoleTag } from "./RoleTag";

function teamText(member: Member): React.ReactNode {
  if (member.status === "deactivated") return "—";
  if (member.teams.length === 0) return "—";
  return member.teams.map((t, i) => {
    const team = getTeam(t.teamId)!;
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
  highlighted = false,
  you = false,
  href,
}: {
  member: Member;
  highlighted?: boolean;
  you?: boolean;
  /** Row target; the Directory passes one that keeps its filters in the URL. */
  href?: string;
}) {
  const role = getRole(member.roleId)!;
  const deactivated = member.status === "deactivated";
  return (
    <Link
      role="row"
      href={href ?? `/app/people?open=${member.id}`}
      className="mr"
      style={highlighted ? { background: "var(--sheet-tint)" } : undefined}
    >
      <span role="cell" className="rg">
        {member.id}
      </span>
      <span role="cell">
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
      <span role="cell">
        <RoleTag role={role} link={false} />
      </span>
      <span role="cell" style={{ color: "var(--ink-2)" }}>
        {teamText(member)}
      </span>
      <span role="cell" className={deactivated ? "off" : "ok"}>
        {deactivated ? "Deactivated" : "Active"}
      </span>
      <span role="cell" style={{ color: "var(--ink-2)" }}>
        {member.lastActive}
      </span>
    </Link>
  );
}

/** Directory row for an open invitation: no number yet, dashed tag. */
export function InvitationRow({ invitation }: { invitation: Invitation }) {
  const role = getRole(invitation.roleId)!;
  const team = getTeam(invitation.teamId);
  return (
    <div
      role="row"
      className="mr"
      style={{ background: "var(--sheet-sunk)" }}
    >
      <span role="cell" className="rg">
        —
      </span>
      <span role="cell">
        <b style={{ fontWeight: 600, color: "var(--ink-2)" }}>
          {invitation.name}
        </b>
        <small>{invitation.email}</small>
      </span>
      <span role="cell">
        <RoleTag role={role} dashed quiet link={false} />
      </span>
      <span role="cell" style={{ color: "var(--ink-2)" }}>
        {team?.name ?? "—"}
      </span>
      <span role="cell" className="pe">
        Invited
      </span>
      <span role="cell" style={{ color: "var(--muted)" }}>
        —
      </span>
    </div>
  );
}
