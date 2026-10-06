/**
 * Human-readable audit sentences — "trust made visible".
 * =======================================================
 *
 * Every action in AUDIT_ACTIONS (the schema's audited-actions list) has a
 * formatter here. The audit log table, the live tail, and the CSV export all
 * render through formatAuditSentence, so the log reads like a story instead
 * of a database dump.
 *
 * Diff conventions producers should follow (all optional — every formatter
 * degrades gracefully to a generic sentence when pieces are missing):
 *
 *   membership.role_changed  diff: { role: { from: "Member", to: "Manager" } }
 *   membership.created       diff: { role: "Member" }, metadata: { via: "invitation" | "manual" }
 *   team.member_added        target = member name, diff: { team: "Design" }
 *   team.lead_changed        diff: { team: "Design", lead: { from, to } }
 *   role.permissions_changed diff: { added: string[], removed: string[] }
 *   invitation.sent          target = email, diff: { role: "Manager" }
 *   invitation.bulk_sent     diff: { count: n }  (or { sent, failed })
 *   settings.updated         diff: { field: { from, to }, ... }
 *   org.updated              diff: { field: { from, to }, ... }
 *   audit.exported           diff: { rows: n, format: "csv" }
 */

import type { AuditEvent } from "./types";

/** Input to the sentence formatters: the event plus the resolved actor name. */
export interface SentenceInput {
  action: string;
  targetLabel?: string | null;
  diff?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

type Formatter = (actor: string, event: SentenceInput) => string;

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function obj(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** "invite_policy" → "invite policy", "default_role_id" → "default role". */
function humanizeKey(key: string): string {
  return key.replace(/_id$/, "").replace(/_/g, " ");
}

function changePair(value: unknown): { from: string | null; to: string | null } | null {
  const o = obj(value);
  if (!o) return null;
  return { from: str(o.from), to: str(o.to) };
}

function target(event: SentenceInput, fallback = "something"): string {
  return str(event.targetLabel) ?? fallback;
}

function diffOf(event: SentenceInput): Record<string, unknown> {
  return event.diff ?? {};
}

const FORMATTERS: Record<string, Formatter> = {
  "org.created": (actor, event) =>
    `${actor} created the organization ${target(event, "an organization")}`,

  "org.updated": (actor, event) => {
    const keys = Object.keys(diffOf(event)).map(humanizeKey);
    return keys.length > 0
      ? `${actor} updated the organization (${keys.join(", ")})`
      : `${actor} updated the organization`;
  },

  "org.ownership_transferred": (actor, event) =>
    `${actor} transferred ownership to ${target(event, "a new owner")}`,

  "membership.created": (actor, event) => {
    const via = str(event.metadata?.via);
    const role = str(diffOf(event).role);
    const roleBit = role ? ` as ${role}` : "";
    if (via === "manual" && str(event.targetLabel)) {
      return `${actor} added ${event.targetLabel} to the organization${roleBit}`;
    }
    return `${actor} joined the organization${roleBit}`;
  },

  "membership.role_changed": (actor, event) => {
    const change = changePair(diffOf(event).role);
    if (change?.from && change.to) {
      return `${actor} changed ${target(event)}'s role from ${change.from} to ${change.to}`;
    }
    return `${actor} changed ${target(event)}'s role`;
  },

  "membership.deactivated": (actor, event) =>
    `${actor} deactivated ${target(event, "a member")}`,

  "membership.reactivated": (actor, event) =>
    `${actor} reactivated ${target(event, "a member")}`,

  "membership.removed": (actor, event) => {
    const via = str(event.metadata?.via);
    if (via === "self-leave") {
      return `${actor} left the organization`;
    }
    return `${actor} removed ${target(event, "a member")} from the organization`;
  },

  "team.created": (actor, event) =>
    `${actor} created the team ${target(event, "a team")}`,

  "team.updated": (actor, event) => {
    const keys = Object.keys(diffOf(event)).map(humanizeKey);
    return keys.length > 0
      ? `${actor} updated the team ${target(event, "a team")} (${keys.join(", ")})`
      : `${actor} updated the team ${target(event, "a team")}`;
  },

  "team.archived": (actor, event) =>
    `${actor} archived the team ${target(event, "a team")}`,

  "team.unarchived": (actor, event) =>
    `${actor} unarchived the team ${target(event, "a team")}`,

  "team.member_added": (actor, event) => {
    const team = str(diffOf(event).team);
    return team
      ? `${actor} added ${target(event, "a member")} to the ${team} team`
      : `${actor} added ${target(event, "a member")} to a team`;
  },

  "team.member_removed": (actor, event) => {
    const team = str(diffOf(event).team);
    return team
      ? `${actor} removed ${target(event, "a member")} from the ${team} team`
      : `${actor} removed ${target(event, "a member")} from a team`;
  },

  "team.lead_changed": (actor, event) => {
    const team = str(diffOf(event).team);
    const change = changePair(diffOf(event).lead);
    const teamBit = team ? ` for the ${team} team` : "";
    if (change?.from && change.to) {
      return `${actor} changed the team lead${teamBit} from ${change.from} to ${change.to}`;
    }
    return `${actor} changed the team lead${teamBit}`;
  },

  "role.created": (actor, event) =>
    `${actor} created the role ${target(event, "a role")}`,

  "role.updated": (actor, event) => {
    const keys = Object.keys(diffOf(event)).map(humanizeKey);
    return keys.length > 0
      ? `${actor} updated the role ${target(event, "a role")} (${keys.join(", ")})`
      : `${actor} updated the role ${target(event, "a role")}`;
  },

  "role.permissions_changed": (actor, event) => {
    const d = diffOf(event);
    const added = Array.isArray(d.added) ? d.added.length : 0;
    const removed = Array.isArray(d.removed) ? d.removed.length : 0;
    const bits: string[] = [];
    if (added > 0) bits.push(`+${added} added`);
    if (removed > 0) bits.push(`−${removed} removed`);
    const detail = bits.length > 0 ? ` (${bits.join(", ")})` : "";
    return `${actor} updated permissions for the ${target(event, "a role")} role${detail}`;
  },

  "role.deleted": (actor, event) =>
    `${actor} deleted the role ${target(event, "a role")}`,

  "invitation.sent": (actor, event) => {
    const role = str(diffOf(event).role);
    return role
      ? `${actor} invited ${target(event, "someone")} as ${role}`
      : `${actor} invited ${target(event, "someone")}`;
  },

  "invitation.bulk_sent": (actor, event) => {
    const d = diffOf(event);
    const count = num(d.count) ?? num(d.sent);
    if (count !== null) {
      const failed = num(d.failed);
      const failedBit = failed !== null && failed > 0 ? `, ${failed} failed` : "";
      return `${actor} sent ${count} invitations${failedBit}`;
    }
    return `${actor} sent bulk invitations`;
  },

  "invitation.resent": (actor, event) =>
    `${actor} resent the invitation to ${target(event, "someone")}`,

  "invitation.revoked": (actor, event) => {
    const via = str(event.metadata?.via);
    if (via === "declined") {
      return `${actor} declined the invitation`;
    }
    return `${actor} revoked the invitation to ${target(event, "someone")}`;
  },

  "invitation.accepted": (_actor, event) =>
    `${target(event, "Someone")} accepted the invitation`,

  "settings.updated": (actor, event) => {
    const keys = Object.keys(diffOf(event)).map(humanizeKey);
    return keys.length > 0
      ? `${actor} updated organization settings (${keys.join(", ")})`
      : `${actor} updated organization settings`;
  },

  "audit.exported": (actor, event) => {
    const rows = num(diffOf(event).rows);
    const format = str(diffOf(event).format) ?? "CSV";
    return rows !== null
      ? `${actor} exported the audit log (${rows} rows as ${format})`
      : `${actor} exported the audit log`;
  },
};

/** True when the action has a dedicated sentence formatter (not the fallback). */
export function hasSentenceFormatter(action: string): boolean {
  return Object.hasOwn(FORMATTERS, action);
}

/**
 * Renders the human-readable sentence for an audit event.
 * Unknown actions degrade to a generic-but-honest fallback — never blank.
 */
export function formatAuditSentence(
  actorName: string | null | undefined,
  event: SentenceInput,
): string {
  const actor = actorName?.trim() || "Someone";
  const formatter = FORMATTERS[event.action];
  if (!formatter) {
    return `${actor} performed ${event.action}`;
  }
  return formatter(actor, event);
}

/** Convenience overload for full rows (actor name resolved separately). */
export function formatAuditEvent(actorName: string | null | undefined, event: AuditEvent): string {
  return formatAuditSentence(actorName, {
    action: event.action,
    targetLabel: event.target_label,
    diff: event.diff,
    metadata: event.metadata,
  });
}

/**
 * Filter-bar grouping: Membership / Roles / Invitations / Teams / Settings /
 * Security (APP-FLOW §3, audit screen).
 */
export const AUDIT_ACTION_GROUPS: { id: string; label: string; actions: string[] }[] = [
  {
    id: "membership",
    label: "Membership",
    actions: [
      "membership.created",
      "membership.role_changed",
      "membership.deactivated",
      "membership.reactivated",
      "membership.removed",
    ],
  },
  {
    id: "roles",
    label: "Roles",
    actions: ["role.created", "role.updated", "role.permissions_changed", "role.deleted"],
  },
  {
    id: "invitations",
    label: "Invitations",
    actions: [
      "invitation.sent",
      "invitation.bulk_sent",
      "invitation.resent",
      "invitation.revoked",
      "invitation.accepted",
    ],
  },
  {
    id: "teams",
    label: "Teams",
    actions: [
      "team.created",
      "team.updated",
      "team.archived",
      "team.unarchived",
      "team.member_added",
      "team.member_removed",
      "team.lead_changed",
    ],
  },
  {
    id: "settings",
    label: "Settings",
    actions: ["org.created", "org.updated", "org.ownership_transferred", "settings.updated"],
  },
  {
    id: "security",
    label: "Security",
    actions: ["audit.exported"],
  },
];
