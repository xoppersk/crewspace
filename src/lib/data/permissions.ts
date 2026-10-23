/**
 * The UI register (types.ts Permission, ids 1–18) ↔ the database
 * permission catalog (public.permissions, text keys from migration
 * 00002). This table follows Worker S's SINGLE SOURCE mapping
 * (production/WORKER-S-SCHEMA.md), used identically by migration
 * 00017 (create_workspace) and the production seed:
 *
 *   DB-enforced (14 keys): a role's setting for these ids is a row in
 *   role_permissions (allow) or role_permission_denies (deny), or
 *   neither (inherit). Permission 3 is special: the org baseline
 *   allows it, so a seeded inherit on #3 is stored as a GRANT.
 *   Permission 18 is special: "locked" for non-owners is stored as an
 *   explicit DENY of org:transfer_ownership.
 *
 *   App-layer only (12, 14, 16): no catalog key and no grant/deny row
 *   exists for these register rows. Their committed state is not
 *   stored; the register displays them as Inherit (neither grant nor
 *   deny) and they are not editable through the propose/apply RPCs.
 *   For server-side permission CHECKS the nearest catalog key is used
 *   (12 → members:invite, 14 → members:deactivate, 16 → billing:view).
 */
export const PERMISSION_KEY_BY_ID: Record<number, string> = {
  1: "members:invite",
  2: "members:deactivate",
  3: "members:read",
  4: "members:change_role",
  5: "roles:update",
  6: "roles:create",
  7: "audit:read",
  8: "audit:export",
  9: "teams:create",
  10: "teams:manage",
  11: "invitations:manage",
  13: "settings:manage",
  15: "billing:view",
  17: "org:update",
  18: "org:transfer_ownership",
};

/** Register ids with no DB key — display-only in the register. */
export const APP_LAYER_PERMISSION_IDS = new Set([12, 14, 16]);

/**
 * Register copy for the app-layer rows (no catalog row exists to read
 * it from). This is the register's own UI copy, not workspace data.
 */
export const APP_LAYER_PERMISSION_META: Record<
  number,
  { name: string; description: string }
> = {
  12: {
    name: "Import members from CSV",
    description: "Can invite many people at once from a file.",
  },
  14: {
    name: "Sign members out everywhere",
    description: "Can end every active session for a member.",
  },
  16: {
    name: "Manage plan and payment",
    description: "Can change seats, plan and the card on file.",
  },
};

/** Nearest catalog key for permission checks on app-layer rows. */
export const NEAREST_KEY_BY_ID: Record<number, string> = {
  12: "members:invite",
  14: "members:deactivate",
  16: "billing:view",
};

/** Register order: permission ids 1–18 in display order (key or null). */
export const PERMISSION_ORDER: (string | null)[] = [
  "members:invite",
  "members:deactivate",
  "members:read",
  "members:change_role",
  "roles:update",
  "roles:create",
  "audit:read",
  "audit:export",
  "teams:create",
  "teams:manage",
  "invitations:manage",
  null, // 12 Import members from CSV — app-layer only
  "settings:manage",
  null, // 14 Sign members out everywhere — app-layer only
  "billing:view",
  null, // 16 Manage plan and payment — app-layer only
  "org:update",
  "org:transfer_ownership",
];

export function permissionIdForKey(key: string): number | undefined {
  const idx = PERMISSION_ORDER.indexOf(key);
  return idx === -1 ? undefined : idx + 1;
}

/** DB key for a register id, or null for app-layer-only ids. */
export function permissionKeyForId(id: number): string | null {
  return PERMISSION_KEY_BY_ID[id] ?? null;
}

/** Key to use for a has_permission check (nearest for app-layer ids). */
export function checkKeyForId(id: number): string {
  return PERMISSION_KEY_BY_ID[id] ?? NEAREST_KEY_BY_ID[id] ?? "";
}

/**
 * The platform baseline (Worker S translation rule): the org baseline
 * allows permission 3 (Edit member profiles / members:read). It has no
 * per-org storage — create_workspace and the seed bake it into the
 * template — so the app layer carries it as this constant.
 */
export const BASELINE_PERMISSION_IDS: number[] = [3];

/** The register's eight groups, by permission id (types.ts Org.groups). */
export const PERMISSION_GROUPS: { name: string; permissionIds: number[] }[] = [
  { name: "People", permissionIds: [1, 2, 3] },
  { name: "Access", permissionIds: [4, 5, 6] },
  { name: "Governance", permissionIds: [7, 8] },
  { name: "Teams", permissionIds: [9, 10] },
  { name: "Invitations", permissionIds: [11, 12] },
  { name: "Security", permissionIds: [13, 14] },
  { name: "Billing", permissionIds: [15, 16] },
  { name: "Organization", permissionIds: [17, 18] },
];
