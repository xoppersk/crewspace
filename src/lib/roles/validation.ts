import { z } from "zod";

import { PERMISSION_KEYS } from "@/lib/permissions";

/**
 * Shared validation for role mutations — used by client forms (wizard) and
 * re-validated inside every server action. Permission keys are constrained
 * to the 18-key catalog: a custom role is always a subset, never a
 * superset — no key can be smuggled in that the catalog doesn't define.
 */

export const roleNameSchema = z
  .string()
  .trim()
  .min(2, "Role name must be at least 2 characters.")
  .max(60, "Role name must be at most 60 characters.");

export const roleDescriptionSchema = z
  .string()
  .trim()
  .max(280, "Description must be at most 280 characters.")
  .optional()
  .transform((v) => (v === "" ? undefined : v));

export const permissionKeysSchema = z
  .array(z.string())
  .refine((keys) => keys.every((key) => (PERMISSION_KEYS as readonly string[]).includes(key)), {
    message: "Unknown permission key.",
  })
  .transform((keys) => [...new Set(keys)]);

export const createRoleSchema = z.object({
  name: roleNameSchema,
  description: roleDescriptionSchema,
  permissionKeys: permissionKeysSchema,
  /** Explicit Deny decisions for the new role (optional). */
  denyKeys: permissionKeysSchema.optional().default([]),
  /** Active membership ids to assign the new role to (optional). */
  assignMembershipIds: z.array(z.string().uuid()).optional().default([]),
});

export const updateRolePermissionsSchema = z.object({
  roleId: z.string().uuid(),
  permissionKeys: permissionKeysSchema,
});

/**
 * Tri-state permission decisions (Flagship UI Designs artifact — the
 * register's Allow / Deny / Inherit control). `allow` grants the keys,
 * `deny` records explicit denials, and keys in neither follow the
 * organization baseline. A key can never be both allowed and denied.
 */
export const permissionDecisionsSchema = z
  .object({
    roleId: z.string().uuid(),
    allow: permissionKeysSchema,
    deny: permissionKeysSchema,
  })
  .refine((d) => d.allow.every((key) => !d.deny.includes(key)), {
    message: "A permission cannot be both allowed and denied.",
  });

export type PermissionDecisionsInput = z.infer<typeof permissionDecisionsSchema>;

export const updateRoleMetaSchema = z.object({
  roleId: z.string().uuid(),
  name: roleNameSchema,
  description: roleDescriptionSchema,
});

export const assignRoleSchema = z.object({
  membershipId: z.string().uuid(),
  roleId: z.string().uuid(),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
