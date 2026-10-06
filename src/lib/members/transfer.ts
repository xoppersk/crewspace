/**
 * Ownership-transfer rules — pure, database-free pre-checks.
 * ============================================================================
 *
 * Lives outside actions.ts because "use server" modules may only export
 * async functions. The server action imports this; the DB function
 * (00014_transfer_ownership.sql) re-checks every rule itself.
 */

/**
 * Pure pre-checks for ownership transfer — unit-testable without a database.
 * The DB function re-checks every one of these (defense in depth), but the
 * action fails fast here with plain-language messages so the UI can show
 * the right error without a round trip.
 *
 * Returns a human-readable error, or null when the transfer may proceed.
 */
export function validateTransferTarget(args: {
  actorUserId: string;
  /** The caller's membership row carries the owner system role. */
  actorIsOwner: boolean;
  targetUserId: string;
  targetIsActive: boolean;
  targetName: string;
}): string | null {
  if (!args.actorIsOwner) {
    return "Only the organization owner can transfer ownership.";
  }
  if (args.targetUserId === args.actorUserId) {
    return "You can't transfer ownership to yourself — choose another member.";
  }
  if (!args.targetIsActive) {
    return `${args.targetName} is deactivated. Reactivate them before transferring ownership.`;
  }
  return null;
}

/**
 * DB raise() messages are namespaced "crewspace: <plain message>" — strip
 * the prefix so the UI shows the plain message. Anything else becomes a
 * generic failure (never leak raw Postgres text to the UI).
 */
export function toPlainTransferError(message: string): string {
  const marker = "crewspace:";
  const idx = message.indexOf(marker);
  if (idx >= 0) {
    const plain = message.slice(idx + marker.length).trim();
    if (plain) return plain.charAt(0).toUpperCase() + plain.slice(1);
  }
  return "The transfer couldn't be completed — try again.";
}
