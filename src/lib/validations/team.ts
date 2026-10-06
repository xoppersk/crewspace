import { z } from "zod";

/** Team name: 2–60 chars. Description optional, max 280. */
export const createTeamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Team name must be at least 2 characters.")
    .max(60, "Team name must be at most 60 characters."),
  description: z
    .string()
    .trim()
    .max(280, "Description must be at most 280 characters.")
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  leadMembershipId: z.string().uuid().optional(),
});

export const updateTeamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Team name must be at least 2 characters.")
    .max(60, "Team name must be at most 60 characters."),
  description: z
    .string()
    .trim()
    .max(280, "Description must be at most 280 characters.")
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v)),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
