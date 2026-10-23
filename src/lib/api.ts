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

/**
 * Pure data helpers — the UI contract.
 * ==========================================================================
 * This module NO LONGER reads fixtures. Every function takes the
 * workspace data explicitly (loaded from Supabase by
 * `src/lib/data/server.ts`) and derives the shapes in types.ts from it.
 * Server components load the data and pass it in; client components
 * receive the pieces they need as props. Nothing here touches the
 * network, cookies, or `data/*.json`.
 */

export interface WorkspaceData {
  org: Org;
  members: Member[];
  teams: Team[];
  invitations: Invitation[];
  auditEntries: AuditEntry[];
  needsOwner: NeedsOwnerItem[];
}

/* ------------------------------------------------------------------ */
/* Lookups                                                             */
/* ------------------------------------------------------------------ */

export function getOrg(data: WorkspaceData): Org {
  return data.org;
}
export function getPermissions(data: WorkspaceData): Permission[] {
  return data.org.permissions;
}
export function getPermission(data: WorkspaceData, id: number): Permission {
  return data.org.permissions.find((p) => p.id === id)!;
}
export function getRoles(data: WorkspaceData): Role[] {
  return data.org.roles;
}
export function getRole(data: WorkspaceData, id: string): Role | undefined {
  return data.org.roles.find((r) => r.id === id);
}
export function getMembers(data: WorkspaceData): Member[] {
  return data.members;
}
export function getMember(data: WorkspaceData, id: string): Member | undefined {
  return data.members.find((m) => m.id === id);
}
export function getTeams(data: WorkspaceData): Team[] {
  return data.teams.filter((t) => !t.unlisted);
}
export function getAllTeams(data: WorkspaceData): Team[] {
  return data.teams;
}
export function getTeam(data: WorkspaceData, id: string): Team | undefined {
  return data.teams.find((t) => t.id === id);
}
export function getInvitations(data: WorkspaceData): Invitation[] {
  return data.invitations;
}
export function getAuditEntries(data: WorkspaceData): AuditEntry[] {
  return data.auditEntries;
}
export function getNeedsOwner(data: WorkspaceData): NeedsOwnerItem[] {
  return data.needsOwner;
}

/* ------------------------------------------------------------------ */
/* Permission resolution                                               */
/* ------------------------------------------------------------------ */

export function baselineAllows(data: WorkspaceData, permissionId: number): boolean {
  return data.org.baseline.allowedPermissionIds.includes(permissionId);
}

/** The result a setting produces once the baseline is applied.
    This form takes the baseline explicitly so client components
    (which receive slices of the data as props) can use it too. */
export function settingResultFor(
  setting: Setting,
  permissionId: number,
  baselineIds: number[],
): "Allowed" | "Blocked" {
  if (setting === "allow") return "Allowed";
  if (setting === "inherit")
    return baselineIds.includes(permissionId) ? "Allowed" : "Blocked";
  return "Blocked"; // deny and locked
}

export function settingResult(
  data: WorkspaceData,
  setting: Setting,
  permissionId: number,
): "Allowed" | "Blocked" {
  return settingResultFor(
    setting,
    permissionId,
    data.org.baseline.allowedPermissionIds,
  );
}

/** Effective number of permissions a role allows today. */
export function roleAllows(data: WorkspaceData, role: Role): number {
  return data.org.permissions.filter(
    (p) => settingResult(data, role.settings[String(p.id)]!, p.id) === "Allowed",
  ).length;
}

/** Allows count if the role's pending changes were applied. */
export function roleAllowsAfterReview(data: WorkspaceData, role: Role): number {
  if (!role.pendingChanges?.length) return roleAllows(data, role);
  const next: Role = { ...role, settings: { ...role.settings } };
  for (const c of role.pendingChanges) {
    next.settings[String(c.permissionId)] = c.to;
  }
  return roleAllows(data, next);
}

/** Settings across the custom roles currently set to Inherit (baseline panel). */
export function customInheritCount(data: WorkspaceData): number {
  return data.org.roles
    .filter((r) => r.type === "Custom")
    .reduce(
      (n, r) =>
        n + Object.values(r.settings).filter((s) => s === "inherit").length,
      0,
    );
}

/* ------------------------------------------------------------------ */
/* Lookups                                                             */
/* ------------------------------------------------------------------ */

export function roleMemberCount(data: WorkspaceData, roleId: string): number {
  return data.members.filter((m) => m.roleId === roleId).length;
}

export function roleMembers(data: WorkspaceData, roleId: string): Member[] {
  return data.members.filter((m) => m.roleId === roleId);
}

/** Can this member do this, through their role? (Display only — the
    server enforces via the has_permission RPC before any write.) */
export function memberCan(
  data: WorkspaceData,
  member: Member,
  permissionId: number,
): boolean {
  const role = getRole(data, member.roleId);
  if (!role) return false;
  return (
    settingResult(data, role.settings[String(permissionId)]!, permissionId) ===
    "Allowed"
  );
}

export function memberEffectivePermissions(
  data: WorkspaceData,
  member: Member,
): {
  permission: Permission;
  result: "Allowed" | "Blocked";
  source: "role" | "baseline";
}[] {
  const role = getRole(data, member.roleId)!;
  return data.org.permissions.map((p) => {
    const setting = role.settings[String(p.id)]!;
    return {
      permission: p,
      result: settingResult(data, setting, p.id),
      source: setting === "inherit" ? ("baseline" as const) : ("role" as const),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Teams — membership organizes people; it never changes permissions   */
/* ------------------------------------------------------------------ */

export function teamMembers(data: WorkspaceData, teamId: string): Member[] {
  return data.members.filter((m) => m.teams.some((t) => t.teamId === teamId));
}

export function teamMemberCount(data: WorkspaceData, teamId: string): number {
  return teamMembers(data, teamId).length;
}

export function totalPlacements(data: WorkspaceData): number {
  return data.members.reduce((n, m) => n + m.teams.length, 0);
}

export function teamRoleMix(
  data: WorkspaceData,
  teamId: string,
): { role: Role; count: number }[] {
  const inTeam = teamMembers(data, teamId);
  return data.org.roles
    .map((role) => ({
      role,
      count: inTeam.filter((m) => m.roleId === role.id).length,
    }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
}

/**
 * Adding a person to a team (pure preview). Returns the updated member;
 * the member's role — and therefore everything they can do — is
 * untouched by design. Persistence lives in the server actions.
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

export function openInvitations(data: WorkspaceData): Invitation[] {
  return data.invitations.filter(
    (i) => i.status === "open" || i.status === "bounced",
  );
}

export function getDirectoryEntries(data: WorkspaceData): DirectoryEntry[] {
  return [
    ...data.members.map((member) => ({ kind: "member" as const, member })),
    ...openInvitations(data).map((invitation) => ({
      kind: "invitation" as const,
      invitation,
    })),
  ];
}

export function directoryCounts(data: WorkspaceData): {
  all: number;
  active: number;
  invited: number;
  deactivated: number;
} {
  return {
    all: data.members.length + openInvitations(data).length,
    active: data.members.filter((m) => m.status === "active").length,
    invited: openInvitations(data).length,
    deactivated: data.members.filter((m) => m.status === "deactivated").length,
  };
}

export function invitationTabCounts(data: WorkspaceData): {
  open: number;
  accepted: number;
  expired: number;
  revoked: number;
} {
  return {
    open: openInvitations(data).length,
    accepted: data.invitations.filter((i) => i.status === "accepted").length,
    expired: data.invitations.filter((i) => i.status === "expired").length,
    revoked: data.invitations.filter((i) => i.status === "revoked").length,
  };
}

/* ------------------------------------------------------------------ */
/* Seats + audit                                                       */
/* ------------------------------------------------------------------ */

export function getSeats(data: WorkspaceData): {
  used: number;
  held: number;
  free: number;
  total: number;
} {
  const used = data.members.filter((m) => m.status === "active").length;
  const held = openInvitations(data).length;
  const total = data.org.plan.seats;
  return { used, held, free: total - used - held, total };
}

export function auditAccessChangeCount(data: WorkspaceData): number {
  return data.auditEntries.filter((e) => e.kind === "access").length;
}

export function auditTotals(data: WorkspaceData): {
  entries: number;
  accessChanges: number;
} {
  return {
    entries: data.auditEntries.length,
    accessChanges: auditAccessChangeCount(data),
  };
}

export function importCounts(
  rows: ImportRow[],
  seats: { used: number; held: number },
): {
  ready: number;
  fix: number;
  skipped: number;
  seatsNeeded: number;
} {
  const ready = rows.filter((r) => r.status === "ready").length;
  return {
    ready,
    fix: rows.filter((r) => r.status === "fix").length,
    skipped: rows.filter((r) => r.status === "skipped").length,
    seatsNeeded: seats.used + seats.held + ready,
  };
}

/** People in scope for "Deactivate members": every active member
    except the owner, counted from real membership data (the server
    action re-checks the permission per target). */
export function deactivateScopeCount(data: WorkspaceData): number {
  return data.members.filter(
    (m) => m.roleId !== "owner" && m.status === "active",
  ).length;
}
