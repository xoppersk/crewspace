import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";

/**
 * The complete audited-actions list (DATABASE-SCHEMA.md §1, audit_log).
 * Coverage contract: every action here must be producible by some app path
 * AND have a sentence formatter in ./sentences.ts. Enforced by
 * src/lib/audit/coverage.test.ts.
 */
export const AUDIT_ACTIONS = [
  "org.created",
  "org.updated",
  "org.ownership_transferred",
  "membership.created",
  "membership.role_changed",
  "membership.deactivated",
  "membership.reactivated",
  "membership.removed",
  "team.created",
  "team.updated",
  "team.archived",
  "team.unarchived",
  "team.member_added",
  "team.member_removed",
  "team.lead_changed",
  "role.created",
  "role.updated",
  "role.permissions_changed",
  "role.deleted",
  "invitation.sent",
  "invitation.bulk_sent",
  "invitation.resent",
  "invitation.revoked",
  "invitation.accepted",
  "settings.updated",
  "audit.exported",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditOpts {
  /** e.g. 'invitation', 'membership', 'role', 'team', 'organization'. */
  targetType?: string;
  /** UUID of the target row, when the target has one. */
  targetId?: string;
  /** Human-readable target, stable even if the target row is later deleted. */
  targetLabel?: string;
  /** Before/after payload, e.g. { role: { from: "Member", to: "Manager" } }. */
  diff?: Record<string, unknown>;
  /** Request metadata: IP, user agent, request id, counts. */
  metadata?: Record<string, unknown>;
}

/**
 * Captures request metadata for the audit row when called inside a request
 * (server actions / route handlers). Best-effort: headers() throws outside a
 * request context (tests, scripts) and the audit row must still be writable.
 */
async function requestMetadata(): Promise<Record<string, unknown>> {
  try {
    const h = await headers();
    const forwardedFor = h.get("x-forwarded-for");
    return {
      ip: forwardedFor?.split(",")[0]?.trim() || h.get("x-real-ip") || null,
      user_agent: h.get("user-agent"),
      request_id: h.get("x-request-id") || null,
    };
  } catch {
    return {};
  }
}

/**
 * Shared audit writer — the single way server actions record audit_log rows.
 * ============================================================================
 *
 * Documented signature (Worker 5's audit-log UI reuses this module):
 *   writeAudit(orgId, actorId, action, opts)
 *
 * (2026-10-06, Worker 5) Moved from src/lib/audit.ts to src/lib/audit/index.ts
 * so the sentence formatters could live at src/lib/audit/sentences.ts without
 * breaking the "@/lib/audit" specifier other workers already import.
 * Request metadata (IP, user agent, request id) is now auto-captured from
 * request headers; caller-supplied opts.metadata still wins on conflicts.
 * AUDIT_ACTIONS is the coverage contract (see ./sentences.ts, coverage.test.ts).
 *
 * Writes via the RLS-scoped server client: audit_log's INSERT policy permits
 * any active org member to insert, and the row is immutable afterwards (no
 * UPDATE/DELETE RLS policy + a BEFORE trigger). Throws on write failure —
 * callers treat a failed audit write as a failed action.
 */

export interface AuditOpts {
  /** e.g. 'invitation', 'membership', 'role', 'team', 'organization'. */
  targetType?: string;
  /** UUID of the target row, when the target has one. */
  targetId?: string;
  /** Human-readable target, stable even if the target row is later deleted. */
  targetLabel?: string;
  /** Before/after payload, e.g. { role: { from: "Member", to: "Manager" } }. */
  diff?: Record<string, unknown>;
  /** Request metadata: IP, user agent, request id, counts. */
  metadata?: Record<string, unknown>;
}

export async function writeAudit(
  orgId: string,
  actorId: string,
  action: string,
  opts: AuditOpts = {},
): Promise<void> {
  const supabase = await createClient();
  // Caller-supplied metadata wins over the auto-captured request metadata.
  const metadata = { ...(await requestMetadata()), ...(opts.metadata ?? {}) };
  const { error } = await supabase.from("audit_log").insert({
    org_id: orgId,
    actor_id: actorId,
    action,
    target_type: opts.targetType ?? null,
    target_id: opts.targetId ?? null,
    target_label: opts.targetLabel ?? null,
    diff: opts.diff ?? {},
    metadata,
  });
  if (error) {
    throw new Error(`audit write failed (${action}): ${error.message}`);
  }
}
