import { z } from "zod";

/**
 * Organization validation — shared between client forms and server actions.
 */

/** Slugs that collide with app routes or look like system pages. */
export const RESERVED_SLUGS = [
  "api",
  "app",
  "auth",
  "admin",
  "account",
  "onboarding",
  "invite",
  "invites",
  "invitations",
  "dashboard",
  "directory",
  "teams",
  "roles",
  "audit",
  "settings",
  "profile",
  "billing",
  "support",
  "help",
  "new",
  "create",
  "join",
  "demo",
  "test",
  "www",
] as const;

/**
 * Derives a URL-safe slug from an org name: "Hale & Fern Studio" →
 * "hale-fern-studio". Idempotent-ish and safe to run on already-slugified
 * input for live preview.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 48);
}

/** URL-safe, lowercase, 3–48 chars, no leading/trailing hyphen, not reserved. */
export const orgSlugSchema = z
  .string()
  .trim()
  .min(3, "Slug must be at least 3 characters.")
  .max(48, "Slug must be at most 48 characters.")
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
    "Use lowercase letters, numbers, and hyphens (no leading/trailing hyphen).",
  )
  .refine((s) => !(RESERVED_SLUGS as readonly string[]).includes(s), {
    message: "That slug is reserved — pick another.",
  });

export const createOrgSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Organization name must be at least 2 characters.")
    .max(80, "Organization name must be at most 80 characters."),
  slug: orgSlugSchema,
  logoUrl: z
    .union([z.string().url("Logo must be a valid URL."), z.literal("")])
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
});

export type CreateOrgInput = z.infer<typeof createOrgSchema>;
