import { notFound } from "next/navigation";

import { requireUser } from "./require-user";

/**
 * Multi-tenant authorization guard — the `requireOrgAccess` pattern.
 * ============================================================================
 *
 * Shape: get the user, load their membership in the org, assert it is active
 * and carries at least `minimumRole`. Use at the top of any org-scoped Server
 * Component, Route Handler, or Server Action:
 *
 *   const membership = await requireOrgAccess(orgId, "admin", loadMembership);
 *
 * Failure behavior (deliberate):
 *   * signed out            → requireUser() redirects to /login?next=...
 *   * no/inactive membership → notFound() — never confirm an org exists to a
 *                             stranger (avoids org-enumeration leaks).
 *   * active but under-ranked → throws OrgAccessDeniedError — catch it in an
 *                             `error.tsx` boundary to render a 403 page.
 *
 * The membership loader is injected (not hard-coded) because the starter ships
 * no org tables. A clone provides it against its own schema, e.g.:
 *
 *   -- organizations(id uuid pk, name text, ...)
 *   -- organization_memberships(org_id uuid fk, user_id uuid fk auth.users,
 *   --                         role text check (role in ('owner','admin','member','viewer')),
 *   --                         status text default 'active', ...)
 *   -- RLS: members can select their own orgs' memberships:
 *   --   create policy memberships_self_read on organization_memberships
 *   --     for select to authenticated
 *   --     using (user_id = (select auth.uid()));
 *
 *   async function loadMembership(userId: string, orgId: string) {
 *     const supabase = await createClient();
 *     const { data } = await supabase
 *       .from("organization_memberships")
 *       .select("role, status")
 *       .eq("org_id", orgId)
 *       .eq("user_id", userId)
 *       .maybeSingle();
 *     return data; // { role, status } | null
 *   }
 */

export type OrgRole = "owner" | "admin" | "member" | "viewer";

/** Higher number = more privilege. owner > admin > member > viewer. */
const ROLE_RANK: Record<OrgRole, number> = {
  viewer: 1,
  member: 2,
  admin: 3,
  owner: 4,
};

export interface OrgMembership {
  role: OrgRole;
  status: string;
}

export type MembershipLoader = (
  userId: string,
  orgId: string,
) => Promise<OrgMembership | null>;

/** Thrown when an active member lacks the minimum role. Render as 403. */
export class OrgAccessDeniedError extends Error {
  readonly orgId: string;

  constructor(orgId: string) {
    super(`Access denied: insufficient role for organization ${orgId}`);
    this.name = "OrgAccessDeniedError";
    this.orgId = orgId;
  }
}

/** Pure role comparison — unit-testable without a database. */
export function roleSatisfies(role: OrgRole, minimum: OrgRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/**
 * Pure assertion step of requireOrgAccess — unit-testable without a database.
 * Returns the membership when access is granted.
 */
export function assertOrgAccess(
  membership: OrgMembership | null,
  minimumRole: OrgRole,
  orgId: string,
): OrgMembership {
  // Missing or inactive membership: pretend the org doesn't exist.
  if (!membership || membership.status !== "active") {
    notFound();
  }

  if (!roleSatisfies(membership.role, minimumRole)) {
    throw new OrgAccessDeniedError(orgId);
  }

  return membership;
}

/**
 * Full guard: user → membership → role assertion.
 */
export async function requireOrgAccess(
  orgId: string,
  minimumRole: OrgRole,
  loadMembership: MembershipLoader,
): Promise<OrgMembership> {
  const user = await requireUser();
  const membership = await loadMembership(user.id, orgId);
  return assertOrgAccess(membership, minimumRole, orgId);
}
