/**
 * Pure team validation logic. Server actions enforce these; the unit tests
 * assert them without a database.
 */

export interface LeadRemovalInput {
  /** Membership id currently leading the team (null = no lead). */
  teamLeadMembershipId: string | null;
  /** Membership id being removed from the team. */
  removingMembershipId: string;
  /** Successor picked in the UI (undefined when the field wasn't offered). */
  successorMembershipId?: string | null;
  /** Membership ids that will remain in the team after the removal. */
  remainingMemberIds: string[];
  teamName: string;
  memberName: string;
}

export type LeadRemovalResult =
  | { ok: true; newLeadMembershipId: string | null }
  | { ok: false; error: string };

/**
 * Validate removing a member from a team when a lead is involved.
 *
 * Rules:
 *  - Removing a non-lead: always fine, lead unchanged.
 *  - Removing the lead: a successor is required, and the successor must be
 *    one of the remaining members (not the person being removed).
 *  - Removing the last member: lead is cleared to null automatically.
 */
export function validateLeadRemoval(input: LeadRemovalInput): LeadRemovalResult {
  const { teamLeadMembershipId, removingMembershipId, teamName, memberName } = input;

  const isLead = teamLeadMembershipId !== null && teamLeadMembershipId === removingMembershipId;
  if (!isLead) {
    return { ok: true, newLeadMembershipId: teamLeadMembershipId };
  }

  const successor = input.successorMembershipId ?? null;
  if (!successor) {
    return {
      ok: false,
      error: `${memberName} leads “${teamName}”. Pick a successor lead before removing them.`,
    };
  }
  if (successor === removingMembershipId) {
    return {
      ok: false,
      error: "The successor can't be the member being removed.",
    };
  }
  if (!input.remainingMemberIds.includes(successor)) {
    return {
      ok: false,
      error: "The successor must be a member of the team.",
    };
  }
  return { ok: true, newLeadMembershipId: successor };
}

/** Guard: archiving a team with open invitations? v1: teams archive freely. */
export function archiveConfirmation(teamName: string, memberCount: number): string {
  return `Archiving “${teamName}” hides it from the team list and member pickers. Its ${memberCount} member${memberCount === 1 ? "" : "s"} keep their org access and can be re-added after unarchiving.`;
}
