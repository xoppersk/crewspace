import { z } from "zod";

import { orgSlugSchema } from "./org";

/**
 * Organization settings validation — shared between the settings form and
 * the saveOrgSettings server action.
 */

const MAX_DOMAINS = 20;

/** A bare domain like "example.com" (no scheme, no path). */
export const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Enter a domain like example.com.")
  .max(253, "That domain is too long.")
  .regex(
    /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/,
    "Enter a valid domain like example.com.",
  );

/** Who may send invitations (mirrors the organizations.invite_policy check). */
export const invitePolicySchema = z.enum(["owners", "admins", "managers"], {
  message: "Choose who can invite.",
});

/** Session timeout in minutes; null = never expire. */
export const sessionTimeoutSchema = z
  .number()
  .int()
  .min(15, "Session timeout must be at least 15 minutes.")
  .max(43200, "Session timeout must be at most 30 days.")
  .nullable();

export const orgSettingsSchema = z.object({
  // General
  name: z
    .string()
    .trim()
    .min(2, "Organization name must be at least 2 characters.")
    .max(80, "Organization name must be at most 80 characters."),
  slug: orgSlugSchema,
  logo_url: z
    .union([z.string().url("Logo must be a valid URL."), z.literal("")])
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  // Member policy
  default_role_id: z.string().uuid("Choose a valid default role."),
  invite_policy: invitePolicySchema,
  allowed_domains: z
    .array(domainSchema)
    .max(MAX_DOMAINS, `At most ${MAX_DOMAINS} domains.`),
  require_email_verification: z.boolean(),
  // Security
  session_timeout_minutes: sessionTimeoutSchema,
  require_reauth_destructive: z.boolean(),
});

export type OrgSettingsInput = z.infer<typeof orgSettingsSchema>;

/** Labels for the invite-policy radio (plain language, per the design brief). */
export const INVITE_POLICY_OPTIONS = [
  { value: "owners", label: "Owners only", description: "Only organization owners can invite." },
  {
    value: "admins",
    label: "Admins and up",
    description: "Owners and admins can invite.",
  },
  {
    value: "managers",
    label: "Managers and up",
    description: "Owners, admins, and managers can invite.",
  },
] as const;

/** Session timeout choices for the select. */
export const SESSION_TIMEOUT_OPTIONS = [
  { value: "15", label: "15 minutes" },
  { value: "60", label: "1 hour" },
  { value: "480", label: "8 hours" },
  { value: "1440", label: "24 hours" },
  { value: "never", label: "Never (stay signed in)" },
] as const;
