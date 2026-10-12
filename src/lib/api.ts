import orgData from "../../data/org.json";
import membersData from "../../data/members.json";
import teamsData from "../../data/teams.json";
import invitationsData from "../../data/invitations.json";
import auditData from "../../data/audit.json";
import overviewData from "../../data/overview.json";
import importData from "../../data/import.json";
import type {
  AuditEntry,
  ImportRow,
  Invitation,
  Member,
  NeedsOwnerItem,
  Org,
  Permission,
  Role,
  Setting,
  Team,
} from "./types";

/* ------------------------------------------------------------------ */
/* Raw fixture access                                                  */
/* ------------------------------------------------------------------ */

const org = orgData as Org;
const members = (membersData as { members: Member[] }).members;
const teams = (teamsData as { teams: Team[] }).teams;
const invitations = (invitationsData as { invitations: Invitation[] })
  .invitations;
const auditEntries = (auditData as { entries: AuditEntry[] }).entries;

export function getOrg(): Org {
  return org;
}
export function getPermissions(): Permission[] {
  return org.permissions;
}
export function getPermission(id: number): Permission {
  return org.permissions.find((p) => p.id === id)!;
}
export function getRoles(): Role[] {
  return org.roles;
}
export function getRole(id: string): Role | undefined {
  return org.roles.find((r) => r.id === id);
}
export function getMembers(): Member[] {
  return members;
}
export function getMember(id: string): Member | undefined {
  return members.find((m) => m.id === id);
}
export function getTeams(): Team[] {
  return teams.filter((t) => !t.unlisted);
}
export function getTeam(id: string): Team | undefined {
  return teams.find((t) => t.id === id);
}
export function getInvitations(): Invitation[] {
  return invitations;
}
export function getAuditEntries(): AuditEntry[] {
  return auditEntries;
}
export function getNeedsOwner(): NeedsOwnerItem[] {
  return (overviewData as { needsOwner: NeedsOwnerItem[] }).needsOwner;
}
export function getImportRows(): ImportRow[] {
  return (importData as { rows: ImportRow[] }).rows;
}
export function getImportMapping(): { from: string; to: string }[] {
  return (importData as { columnMapping: { from: string; to: string }[] })
    .columnMapping;
}
export function getImportFileName(): string {
  return (importData as { fileName: string }).fileName;
}

/* ------------------------------------------------------------------ */
/* Permission resolution                                               */
/* ------------------------------------------------------------------ */

export function baselineAllows(permissionId: number): boolean {
  return org.baseline.allowedPermissionIds.includes(permissionId);
}

/** The result a setting produces once the baseline is applied. */
export function settingResult(
  setting: Setting,
  permissionId: number,
): "Allowed" | "Blocked" {
  if (setting === "allow") return "Allowed";
  if (setting === "inherit") return baselineAllows(permissionId) ? "Allowed" : "Blocked";
  return "Blocked"; // deny and locked
}

/** Effective number of permissions a role allows today. */
export function roleAllows(role: Role): number {
  return org.permissions.filter(
    (p) => settingResult(role.settings[String(p.id)]!, p.id) === "Allowed",
  ).length;
}

/** Allows count if the role's pending changes were applied. */
export function roleAllowsAfterReview(role: Role): number {
  if (!role.pendingChanges?.length) return roleAllows(role);
  const next: Role = {
    ...role,
    settings: { ...role.settings },
  };
  for (const c of role.pendingChanges) {
    next.settings[String(c.permissionId)] = c.to;
  }
  return roleAllows(next);
}

/** Settings across the custom roles currently set to Inherit (baseline panel). */
export function customInheritCount(): number {
  return org.roles
    .filter((r) => r.type === "Custom")
    .reduce(
      (n, r) =>
        n + Object.values(r.settings).filter((s) => s === "inherit").length,
      0,
    );
}

export function roleMemberCount(roleId: string): number {
  return members.filter((m) => m.roleId === roleId).length;
}

export function roleMembers(roleId: string): Member[] {
  return members.filter((m) => m.roleId === roleId);
}

/** Can this member do this, through their role? (UI + api enforcement.) */
export function memberCan(member: Member, permissionId: number): boolean {
  const role = getRole(member.roleId);
  if (!role) return false;
  return settingResult(role.settings[String(permissionId)]!, permissionId) === "Allowed";
}

export function memberEffectivePermissions(member: Member): {
  permission: Permission;
  result: "Allowed" | "Blocked";
  source: "role" | "baseline";
}[] {
  const role = getRole(member.roleId)!;
  return org.permissions.map((p) => {
    const setting = role.settings[String(p.id)]!;
    return {
      permission: p,
      result: settingResult(setting, p.id),
      source: setting === "inherit" ? ("baseline" as const) : ("role" as const),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Teams — membership organizes people; it never changes permissions   */
/* ------------------------------------------------------------------ */

export function teamMembers(teamId: string): Member[] {
  return members.filter((m) => m.teams.some((t) => t.teamId === teamId));
}

export function teamMemberCount(teamId: string): number {
  return teamMembers(teamId).length;
}

export function totalPlacements(): number {
  return members.reduce((n, m) => n + m.teams.length, 0);
}

export function teamRoleMix(teamId: string): { role: Role; count: number }[] {
  const inTeam = teamMembers(teamId);
  return org.roles
    .map((role) => ({
      role,
      count: inTeam.filter((m) => m.roleId === role.id).length,
    }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
}

/**
 * Adding a person to a team. Returns the updated member; the member's role —
 * and therefore everything they can do — is untouched by design (§10).
 */
export function addToTeam(member: Member, teamId: string): Member {
  if (member.teams.some((t) => t.teamId === teamId)) return member;
  return { ...member, teams: [...member.teams, { teamId, lead: false }] };
}

export function removeFromTeam(member: Member, teamId: string): Member {
  return { ...member, teams: member.teams.filter((t) => t.teamId !== teamId) };
}

/* ------------------------------------------------------------------ */
/* Directory + invitations                                             */
/* ------------------------------------------------------------------ */

export type DirectoryEntry =
  | { kind: "member"; member: Member }
  | { kind: "invitation"; invitation: Invitation };

export function openInvitations(): Invitation[] {
  return invitations.filter((i) => i.status === "open" || i.status === "bounced");
}

export function getDirectoryEntries(): DirectoryEntry[] {
  return [
    ...members.map((member) => ({ kind: "member" as const, member })),
    ...openInvitations().map((invitation) => ({
      kind: "invitation" as const,
      invitation,
    })),
  ];
}

export function directoryCounts(): {
  all: number;
  active: number;
  invited: number;
  deactivated: number;
} {
  return {
    all: members.length + openInvitations().length,
    active: members.filter((m) => m.status === "active").length,
    invited: openInvitations().length,
    deactivated: members.filter((m) => m.status === "deactivated").length,
  };
}

/**
 * The designed first page of the Directory (P-02): a representative page in
 * register order — the owner, one person per role and state, Maya (newest),
 * then the open invitation row. Filters and search run over all 45 entries.
 */
export const DIRECTORY_SPOTLIGHT_IDS = [
  "001",
  "008",
  "011",
  "012",
  "014",
  "017",
  "019",
  "024",
  "027",
  "033",
  "042",
];

export function getDirectorySpotlight(): DirectoryEntry[] {
  const rows: DirectoryEntry[] = DIRECTORY_SPOTLIGHT_IDS.map((id) => ({
    kind: "member" as const,
    member: getMember(id)!,
  }));
  const priya = invitations.find((i) => i.id === "inv-priya")!;
  rows.push({ kind: "invitation", invitation: priya });
  return rows;
}

export function invitationTabCounts(): {
  open: number;
  accepted: number;
  expired: number;
  revoked: number;
} {
  return {
    open: openInvitations().length,
    accepted: invitations.filter((i) => i.status === "accepted").length,
    expired: invitations.filter((i) => i.status === "expired").length,
    revoked: invitations.filter((i) => i.status === "revoked").length,
  };
}

/* ------------------------------------------------------------------ */
/* Seats + audit                                                       */
/* ------------------------------------------------------------------ */

export function getSeats(): {
  used: number;
  held: number;
  free: number;
  total: number;
} {
  const used = members.filter((m) => m.status === "active").length;
  const held = openInvitations().length;
  const total = org.plan.seats;
  return { used, held, free: total - used - held, total };
}

export function auditAccessChangeCount(): number {
  return auditEntries.filter((e) => e.kind === "access").length;
}

export function auditTotals(): { entries: number; accessChanges: number } {
  return {
    entries: (auditData as { totals: { entries: number } }).totals.entries,
    accessChanges: auditAccessChangeCount(),
  };
}

export function importCounts(): {
  ready: number;
  fix: number;
  skipped: number;
  seatsNeeded: number;
} {
  const rows = getImportRows();
  const seats = getSeats();
  const ready = rows.filter((r) => r.status === "ready").length;
  return {
    ready,
    fix: rows.filter((r) => r.status === "fix").length,
    skipped: rows.filter((r) => r.status === "skipped").length,
    seatsNeeded: seats.used + seats.held + ready,
  };
}

/** People a Product admin could suspend with "Deactivate members": everyone
    except the owner and the Product admins themselves (R-04 effect panel). */
export function deactivateScopeCount(): number {
  return (
    members.length - roleMemberCount("owner") - roleMemberCount("product-admin")
  );
}
