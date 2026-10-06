import { notFound } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

/**
 * Permission plumbing — the single choke point for org-scoped server code.
 * ============================================================================
 *
 * Shape: requireOrgAccess(orgId, permissionKey) →
 *   1. reads the authenticated user (requireUser redirects to /sign-in when
 *      signed out),
 *   2. loads their ACTIVE membership in the org (missing/inactive → notFound,
 *      so a stranger can never confirm an org exists — no org-enumeration),
 *   3. resolves the permission union via the user_permissions() DB function
 *      and asserts the required key,
 *   4. returns { user, membership, permissions, supabase } — the RLS-scoped
 *      client for subsequent queries.
 *
 * Failure behavior (deliberate):
 *   * signed out            → requireUser() redirects to /sign-in?next=...
 *   * no/inactive membership → notFound() — never confirm the org exists
 *   * active but lacking the key → throws ForbiddenError — catch it in an
 *     `error.tsx` boundary to render a 403 page.
 *
 * The client-side counterpart is usePermissions(), which reads the
 * [orgSlug] layout's OrgContext (see src/app/(app)/[orgSlug]/org-context.tsx).
 * UI gating with usePermissions() is layer 1; this module is layer 2 — every
 * Server Action re-asserts here even when the UI hides the control.
 */

/** All 18 permission keys (mirrors the permissions catalog seed, 00002). */
export const PERMISSION_KEYS = [
  "org:read",
  "org:update",
  "org:transfer_ownership",
  "members:read",
  "members:invite",
  "members:change_role",
  "members:deactivate",
  "teams:create",
  "teams:manage",
  "roles:create",
  "roles:assign",
  "roles:update",
  "roles:delete",
  "invitations:manage",
  "audit:read",
  "audit:export",
  "settings:manage",
  "billing:view",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

/** Thrown when an active member lacks the required permission key. Render as 403. */
export class ForbiddenError extends Error {
  readonly orgId: string;
  readonly permission: string;

  constructor(orgId: string, permission: string) {
    super(`Forbidden: missing '${permission}' in organization ${orgId}`);
    this.name = "ForbiddenError";
    this.orgId = orgId;
    this.permission = permission;
  }
}

export interface OrgMembershipSummary {
  id: string;
  org_id: string;
  user_id: string;
  role_id: string;
  role_name: string;
  role_system_key: string | null;
  is_active: boolean;
}

/**
 * Pure union of permission-key sets (e.g. across multiple roles, if the model
 * ever grants more than one role per membership). Dedupes, preserves first-seen
 * order. Unit-testable without a database.
 */
export function unionPermissions(sets: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const set of sets) {
    for (const key of set) {
      if (!seen.has(key)) {
        seen.add(key);
        out.push(key);
      }
    }
  }
  return out;
}

/**
 * Pure assertion step — unit-testable without a database.
 * Returns the granted keys when access is allowed.
 */
export function assertPermission(
  granted: string[] | null,
  orgId: string,
  required: string,
): string[] {
  // Missing/inactive membership: pretend the org doesn't exist.
  if (!granted) {
    notFound();
  }
  if (!granted.includes(required)) {
    throw new ForbiddenError(orgId, required);
  }
  return granted;
}

/**
 * Resolves the permission union for the current user in an org.
 * Returns null when signed out or when there is no ACTIVE membership
 * (deactivated members resolve to null — T5, stale sessions lose access on
 * the next request because every check re-resolves here).
 */
export async function getMyPermissions(orgId: string): Promise<string[] | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("memberships")
    .select("id")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!membership) return null;

  // The DB function computes the union from role_permissions; the RLS policy
  // on memberships lets the caller read their own row.
  const { data, error } = await supabase.rpc("user_permissions", {
    p_org_id: orgId,
    p_user_id: user.id,
  });
  if (error) throw error;
  return (data ?? []) as string[];
}

/**
 * Full guard: user → active membership → permission assertion.
 *
 * Also rejects self-targeted role changes one layer up from RLS (T1): pass
 * `targetUserId` when the action targets another member; when it equals the
 * caller's id and the permission is members:change_role/members:deactivate,
 * the call is rejected before any write.
 */
export async function requireOrgAccess(
  orgId: string,
  permissionKey: string,
  targetUserId?: string,
): Promise<{
  user: User;
  membership: OrgMembershipSummary;
  permissions: string[];
  supabase: Awaited<ReturnType<typeof createClient>>;
}> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("memberships")
    .select("id, org_id, user_id, role_id, is_active")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!membership) {
    notFound();
  }

  const { data: role } = await supabase
    .from("roles")
    .select("name, system_key")
    .eq("id", membership.role_id)
    .single();

  const { data: permissionData, error } = await supabase.rpc("user_permissions", {
    p_org_id: orgId,
    p_user_id: user.id,
  });
  if (error) throw error;
  const permissions = assertPermission((permissionData ?? []) as string[], orgId, permissionKey);

  // T1, server-side: never let a caller escalate/deactivate themselves, even
  // if they somehow hold the permission (the RLS policy + trigger agree).
  if (
    targetUserId === user.id &&
    (permissionKey === "members:change_role" || permissionKey === "members:deactivate")
  ) {
    throw new ForbiddenError(orgId, `${permissionKey} (self-targeted)`);
  }

  return {
    user,
    membership: {
      id: membership.id,
      org_id: membership.org_id,
      user_id: membership.user_id,
      role_id: membership.role_id,
      role_name: role?.name ?? "Unknown",
      role_system_key: role?.system_key ?? null,
      is_active: membership.is_active,
    },
    permissions,
    supabase,
  };
}
