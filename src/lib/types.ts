export type Setting = "allow" | "deny" | "inherit" | "locked";

export interface Permission {
  id: number;
  group: string;
  name: string;
  description: string;
}

export interface PermissionGroup {
  name: string;
  permissionIds: number[];
}

export interface Role {
  id: string;
  regNumber: string;
  name: string;
  type: "System" | "Custom";
  summary: string;
  settings: Record<string, Setting>;
  pendingChanges?: { permissionId: number; from: Setting; to: Setting }[];
  lastChanged: string;
  createdFrom?: string;
  createdOn?: string;
}

export interface Plan {
  name: string;
  seats: number;
  pricePerSeat: number;
  renews: string;
  nextInvoice: string;
  billingContactId: string;
}

export interface Org {
  name: string;
  domain: string;
  domainVerified: string;
  today: string;
  todayFull: string;
  plan: Plan;
  baseline: { allowedPermissionIds: number[] };
  groups: PermissionGroup[];
  permissions: Permission[];
  roles: Role[];
}

export interface MemberTeam {
  teamId: string;
  lead: boolean;
}

export interface Session {
  device: string;
  place: string;
  current: boolean;
  lastActive: string;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  roleId: string;
  status: "active" | "deactivated";
  teams: MemberTeam[];
  joined: string;
  lastActive: string;
  title?: string;
  isNew?: boolean;
  twoStep?: boolean;
  externalOrg?: string;
  deactivatedBy?: string;
  deactivatedOn?: string;
  sessions?: Session[];
}

export interface Team {
  id: string;
  regNumber: string;
  name: string;
  blurb: string;
  leadId: string | null;
  unlisted?: boolean;
}

export type InvitationStatus =
  | "open"
  | "bounced"
  | "accepted"
  | "expired"
  | "revoked";

export interface Invitation {
  id: string;
  name: string;
  email: string;
  suggestedEmail?: string;
  roleId: string;
  teamId: string;
  invitedById: string;
  sent: string;
  status: InvitationStatus;
  openedAt: string | null;
  expires: string;
  acceptedOn?: string;
}

export type AuditKind =
  | "access"
  | "sign-in"
  | "invitation"
  | "team"
  | "settings"
  | "review";

export interface AuditEntry {
  id: string;
  day: string;
  time: string;
  actorId: string;
  kind: AuditKind;
  summary: string;
  detail?: string;
  expanded?: boolean;
  before?: string;
  after?: string;
  affected?: string[];
  from?: string;
  note?: string;
}

export interface NeedsOwnerItem {
  id: string;
  severity: number;
  title: string;
  detail: string;
  action: string;
  href: string;
}

export type ImportRowStatus = "ready" | "fix" | "skipped";

export interface ImportRow {
  row: number;
  name: string;
  email: string;
  role: string;
  team: string;
  status: ImportRowStatus;
  issue?: string;
  fix?: string;
}
