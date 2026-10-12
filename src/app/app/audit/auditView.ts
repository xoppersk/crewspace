import type { AuditEntry } from "@/lib/types";

/**
 * Fixture-only fields the designed AuditLog needs on top of the shared
 * AuditEntry type (src/lib/types.ts is shared and read-only for this batch,
 * so the audit screens read these through this local extension):
 * - dateISO: machine-readable day ("2026-10-05") so the Range filter and
 *   day-group ordering can parse real dates;
 * - actorLabel / actorLabelDeny: the designed actor-column label
 *   ("System · on acceptance", "System · needs action");
 * - roleChange: marks the role-change subset the Kind "Roles" filter shows;
 * - category: the invitation/session flavour of an access entry, used by
 *   the Kind "Invitations" / "Sessions" filters;
 * - strong / mono: summary phrases the screen sets in 600 weight / mono.
 */
export type AuditEntryExt = AuditEntry & {
  dateISO: string;
  actorLabel?: string;
  actorLabelDeny?: boolean;
  roleChange?: boolean;
  category?: "invitation" | "session";
  strong?: string[];
  mono?: string[];
};

/** A fixture entry plus everything the list renders, resolved server-side. */
export type AuditEntryView = AuditEntryExt & {
  actorName: string;
};
