/**
 * Invitation constants — pure values with no dependencies.
 * ============================================================================
 *
 * These live in their own module (deliberately NOT imported through a
 * "use server" re-export) because Next.js forbids non-function exports from
 * server-action modules. `policy.ts` (pure rules) and `actions.ts`
 * (server actions) both import from here.
 */

/** Invitations expire 7 days after issue (matches the DB default). */
export const INVITATION_TTL_DAYS = 7;

/** Hard cap: at most this many invitations issued per org per calendar day. */
export const MAX_INVITES_PER_DAY = 50;

/** Org invite policies (organizations.invite_policy). */
export const INVITE_POLICIES = ["owners", "admins", "managers"] as const;
export type InvitePolicy = (typeof INVITE_POLICIES)[number];

/** Human labels for the member-policy settings UI. */
export const INVITE_POLICY_LABELS: Record<InvitePolicy, string> = {
  owners: "Owners only",
  admins: "Admins and up",
  managers: "Managers and up",
};

/** Expected header for the downloadable invite-CSV template. */
export const INVITE_CSV_HEADERS = ["email", "full_name", "role", "team"] as const;
