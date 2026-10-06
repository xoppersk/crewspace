/**
 * CSV export for the audit log — pure row mapping, no I/O.
 * The server action in app/(app)/[orgSlug]/audit/actions.ts streams the
 * output and writes the `audit.exported` audit row.
 */

import { formatAuditEvent } from "./sentences";
import type { ActorInfo, AuditEvent } from "./types";

export const AUDIT_CSV_HEADERS = [
  "Timestamp",
  "Actor",
  "Action",
  "Summary",
  "Target",
  "Target type",
  "IP address",
  "Request ID",
] as const;

/** RFC 4180 field escaping. */
export function csvEscape(value: string | null | undefined): string {
  const text = value ?? "";
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function metaString(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key];
  return typeof value === "string" ? value : "";
}

/** Maps one audit event to its CSV row (same column order as the headers). */
export function auditEventToCsvRow(
  event: AuditEvent,
  actorName: string | null,
): string[] {
  return [
    event.created_at,
    actorName ?? "",
    event.action,
    formatAuditEvent(actorName, event),
    event.target_label ?? "",
    event.target_type ?? "",
    metaString(event.metadata, "ip"),
    metaString(event.metadata, "request_id"),
  ];
}

/**
 * Builds the full CSV document. `actors` maps actor_id → resolved profile;
 * events whose actor is unknown render with an empty actor cell (never a
 * broken row).
 */
export function auditEventsToCsv(
  events: AuditEvent[],
  actors: Map<string, ActorInfo>,
): string {
  const lines = [AUDIT_CSV_HEADERS.map(csvEscape).join(",")];
  for (const event of events) {
    const actor = actors.get(event.actor_id);
    lines.push(auditEventToCsvRow(event, actor?.full_name ?? null).map(csvEscape).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}
