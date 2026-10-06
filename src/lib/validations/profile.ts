import { z } from "zod";

/**
 * Profile validation — shared between client forms and server actions.
 * Mirrors public.profiles (bio ≤ 500 chars is enforced app-side per the spec).
 */

export const updateProfileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(80, "Name must be at most 80 characters."),
  title: z
    .string()
    .trim()
    .max(120, "Title must be at most 120 characters.")
    .optional()
    .or(z.literal("")),
  bio: z
    .string()
    .trim()
    .max(500, "Bio must be at most 500 characters.")
    .optional()
    .or(z.literal("")),
  timezone: z
    .string()
    .trim()
    .min(1, "Timezone is required.")
    .max(64, "Timezone must be at most 64 characters."),
  avatar_url: z
    .union([z.string().url("Avatar must be a valid URL."), z.literal("")])
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? undefined : v)),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
