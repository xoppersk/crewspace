/**
 * Permission-catalog helpers (Worker 3 — RBAC track).
 *
 * The `permissions` table is a static, globally-seeded catalog (migration
 * 00002) — the app never writes it at runtime. These helpers group the flat
 * rows into the resource sections the PermissionMatrix renders.
 */

export interface CatalogPermission {
  key: string;
  label: string;
  description: string | null;
  action: string;
}

export interface ResourceGroup {
  resource: string;
  label: string;
  permissions: CatalogPermission[];
}

/** Matrix row order (APP-FLOW §3, roles/[roleId]). */
export const RESOURCE_ORDER = [
  "org",
  "members",
  "teams",
  "roles",
  "invitations",
  "audit",
  "settings",
  "billing",
] as const;

export const RESOURCE_LABELS: Record<string, string> = {
  org: "Organization",
  members: "Members",
  teams: "Teams",
  roles: "Roles",
  invitations: "Invitations",
  audit: "Audit log",
  settings: "Settings",
  billing: "Billing",
};

export interface CatalogRow {
  key: string;
  resource: string;
  action: string;
  label: string;
  description: string | null;
}

/**
 * Groups flat catalog rows into ordered resource sections. Unknown
 * resources (a future catalog key) are appended at the end rather than
 * dropped — the matrix stays complete.
 */
export function groupCatalog(rows: CatalogRow[]): ResourceGroup[] {
  const byResource = new Map<string, CatalogPermission[]>();
  for (const row of rows) {
    const list = byResource.get(row.resource) ?? [];
    list.push({
      key: row.key,
      label: row.label,
      description: row.description,
      action: row.action,
    });
    byResource.set(row.resource, list);
  }

  const ordered = RESOURCE_ORDER.filter((resource) => byResource.has(resource));
  const extra = [...byResource.keys()]
    .filter((resource) => !(RESOURCE_ORDER as readonly string[]).includes(resource))
    .sort();

  return [...ordered, ...extra].map((resource) => ({
    resource,
    label: RESOURCE_LABELS[resource] ?? resource,
    permissions: (byResource.get(resource) ?? []).sort((a, b) =>
      a.key.localeCompare(b.key),
    ),
  }));
}
