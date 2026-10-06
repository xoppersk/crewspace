/**
 * Plan constants for the portfolio demo. Billing is out of scope for v1, so
 * the "Free" plan is informational: limits render as usage bars on the
 * Settings → Plan tab, and the upgrade CTA is disabled with "coming soon".
 */

export const FREE_PLAN = {
  name: "Free",
  limits: {
    /** Active members per organization. */
    members: 25,
    /** Teams per organization. */
    teams: 10,
    /** Custom (non-system) roles per organization. */
    customRoles: 5,
    /** Months of audit history retained. */
    auditRetentionMonths: 12,
  },
} as const;

/** Retention note shown under the audit log (APP-FLOW §3). */
export const AUDIT_RETENTION_LABEL = "Events retained 1 year on this plan";
