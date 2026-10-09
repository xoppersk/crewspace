/**
 * Pure member lifecycle logic: deactivation/reactivation effects and bulk
 * action confirmation summaries. Server actions apply these; the unit tests
 * assert them without a database.
 */

export interface MembershipLifecyclePatch {
  is_active: boolean;
  deactivated_at: string | null;
  deactivated_by: string | null;
}

export interface DeactivationEffect {
  /** The exact patch to write to the memberships row. */
  patch: MembershipLifecyclePatch;
  /** Audit action key to record. */
  auditAction: "membership.deactivated" | "membership.reactivated";
  /** Plain-language consequence copy for dialogs. */
  description: string;
  /** Toast copy after success. */
  toast: string;
}

/**
 * Compute the full effect of deactivating or reactivating a member. Pure.
 *
 * Deactivation: access is revoked immediately (RLS checks is_active), but
 * the role and team memberships are preserved so reactivation restores them.
 */
export function computeDeactivationEffect(
  opts: {
    /** Current is_active state of the target membership. */
    currentlyActive: boolean;
    actorId: string;
    memberName: string;
    /** Desired end state: false = deactivate, true = reactivate. */
    targetActive: boolean;
    nowIso?: string;
  },
): DeactivationEffect {
  const now = opts.nowIso ?? new Date().toISOString();

  if (!opts.targetActive) {
    if (!opts.currentlyActive) {
      throw new Error(`${opts.memberName} is already deactivated.`);
    }
    return {
      patch: {
        is_active: false,
        deactivated_at: now,
        deactivated_by: opts.actorId,
      },
      auditAction: "membership.deactivated",
      description: `This will immediately remove ${opts.memberName}'s access to the organization. Their role and teams are kept, so you can reactivate them later without losing anything.`,
      toast: `${opts.memberName} has been deactivated.`,
    };
  }

  if (opts.currentlyActive) {
    throw new Error(`${opts.memberName} is already active.`);
  }
  return {
    patch: {
      is_active: true,
      deactivated_at: null,
      deactivated_by: null,
    },
    auditAction: "membership.reactivated",
    description: `${opts.memberName}'s previous role and teams will be restored immediately.`,
    toast: `${opts.memberName} has been reactivated.`,
  };
}

// ---------------------------------------------------------------------------
// Bulk actions
// ---------------------------------------------------------------------------

export type BulkActionKind = "change-role" | "change-team" | "deactivate" | "reactivate";

export interface BulkActionSummary {
  /** Dialog title. */
  title: string;
  /** Plain-language consequence copy. */
  description: string;
  /** Confirm button label. */
  confirmLabel: string;
  affectedCount: number;
  destructive: boolean;
  /** Permission key the server action will assert (informational). */
  permission: string;
}

/**
 * Build the confirmation content for a bulk member action. Pure.
 * The affected set is pre-computed by the caller (excludes self-targets and
 * the last owner where the guard would reject them).
 */
export function summarizeBulkAction(
  action: BulkActionKind,
  affectedCount: number,
  detailLabel?: string,
): BulkActionSummary {
  const plural = affectedCount === 1 ? "member" : "members";
  switch (action) {
    case "change-role":
      return {
        title: `Change role for ${affectedCount} ${plural}`,
        description: `This will change the role of ${affectedCount} ${plural} to “${detailLabel ?? "role"}”. Their permissions update on their next request.`,
        confirmLabel: "Change role",
        affectedCount,
        destructive: false,
        permission: "members:change_role",
      };
    case "change-team":
      return {
        title: `Move ${affectedCount} ${plural} to ${detailLabel ?? "team"}`,
        description: `${affectedCount} ${plural} will be added to “${detailLabel ?? "team"}”. Existing team memberships are kept.`,
        confirmLabel: "Add to team",
        affectedCount,
        destructive: false,
        permission: "teams:manage",
      };
    case "deactivate":
      return {
        title: `Deactivate ${affectedCount} ${plural}`,
        description: `This will immediately remove access for ${affectedCount} ${plural}. Their roles and teams are kept for reactivation.`,
        confirmLabel: "Deactivate",
        affectedCount,
        destructive: true,
        permission: "members:deactivate",
      };
    case "reactivate":
      return {
        title: `Reactivate ${affectedCount} ${plural}`,
        description: `${affectedCount} ${plural} will regain access with their previous roles and teams.`,
        confirmLabel: "Reactivate",
        affectedCount,
        destructive: false,
        permission: "members:deactivate",
      };
  }
}

/** Shared row shape for member listings (directory, pickers, cards). */
export interface DirectoryMember {
  membershipId: string;
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  title: string | null;
  timezone: string;
  isActive: boolean;
  lastActiveAt: string | null;
  joinedAt: string;
  deactivatedAt: string | null;
  roleId: string;
  roleName: string;
  roleSystemKey: string | null;
  roleColor: string;
  teamIds: string[];
  teamNames: string[];
}
