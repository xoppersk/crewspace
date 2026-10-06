/**
 * Shared audit-log shapes used by the audit page, CSV export, and the
 * sentence formatters.
 */

export interface AuditEvent {
  id: string;
  org_id: string;
  actor_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_label: string | null;
  diff: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ActorInfo {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

/** URL-driven filter state for the audit log page (and the CSV export). */
export interface AuditFilters {
  /** Free text: matches action key, target label, and IP. */
  q: string;
  /** Action keys; empty = all. */
  actions: string[];
  /** Actor user id; null = any. */
  actorId: string | null;
  preset: "today" | "7d" | "30d" | "custom" | "all";
  /** ISO strings; only used with preset === "custom". */
  from: string | null;
  to: string | null;
  page: number;
}

export const AUDIT_PAGE_SIZE = 50;

/** Max rows a single CSV export will include. */
export const AUDIT_EXPORT_MAX_ROWS = 5000;
