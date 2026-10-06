/**
 * Plain-language catalog for the 18 permission keys (DATABASE-SCHEMA.md §1).
 * Used by the "My access" tab and anywhere a permission key needs a human
 * face. Labels mirror the seeded permissions catalog.
 */

export interface PermissionMeta {
  label: string;
  description: string;
  resource: string;
}

export const PERMISSION_META: Record<string, PermissionMeta> = {
  "org:read": {
    label: "View organization",
    description: "See the organization, its directory, and its data.",
    resource: "Organization",
  },
  "org:update": {
    label: "Edit organization",
    description: "Change the org name, slug, and logo.",
    resource: "Organization",
  },
  "org:transfer_ownership": {
    label: "Transfer ownership",
    description: "Hand ownership of the organization to another member.",
    resource: "Organization",
  },
  "members:read": {
    label: "View members",
    description: "Browse the member directory and profiles.",
    resource: "Members",
  },
  "members:invite": {
    label: "Invite members",
    description: "Invite new members, within the org's invite policy.",
    resource: "Members",
  },
  "members:change_role": {
    label: "Change roles",
    description: "Change another member's role.",
    resource: "Members",
  },
  "members:deactivate": {
    label: "Deactivate members",
    description: "Deactivate, reactivate, and remove members.",
    resource: "Members",
  },
  "teams:create": {
    label: "Create teams",
    description: "Create new teams.",
    resource: "Teams",
  },
  "teams:manage": {
    label: "Manage teams",
    description: "Rename and archive teams, manage members and leads.",
    resource: "Teams",
  },
  "roles:create": {
    label: "Create roles",
    description: "Create custom roles.",
    resource: "Roles",
  },
  "roles:assign": {
    label: "Assign roles",
    description: "Assign roles to members.",
    resource: "Roles",
  },
  "roles:update": {
    label: "Edit roles",
    description: "Edit a custom role's name, description, or permissions.",
    resource: "Roles",
  },
  "roles:delete": {
    label: "Delete roles",
    description: "Delete a custom role (only when nobody holds it).",
    resource: "Roles",
  },
  "invitations:manage": {
    label: "Manage invitations",
    description: "Resend and revoke invitations.",
    resource: "Invitations",
  },
  "audit:read": {
    label: "View audit log",
    description: "See the organization's audit trail.",
    resource: "Audit log",
  },
  "audit:export": {
    label: "Export audit log",
    description: "Export the audit trail to CSV (exports are themselves logged).",
    resource: "Audit log",
  },
  "settings:manage": {
    label: "Manage settings",
    description: "Change org settings and the member policy.",
    resource: "Settings",
  },
  "billing:view": {
    label: "View plan",
    description: "See the current plan and usage limits.",
    resource: "Plan",
  },
};

/** Resource group order for permission lists. */
export const PERMISSION_RESOURCES = [
  "Organization",
  "Members",
  "Teams",
  "Roles",
  "Invitations",
  "Audit log",
  "Settings",
  "Plan",
] as const;
