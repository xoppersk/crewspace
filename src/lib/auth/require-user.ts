import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { getUser } from "./get-user";

/**
 * The single choke point for authenticated server code.
 *
 * Use at the top of every protected Server Component, Route Handler, and
 * Server Action:
 *
 *   const user = await requireUser();
 *
 * Returns the authenticated user, or redirects to /login?next=<path> when
 * signed out. Pass `next` explicitly from Route Handlers / Server Actions
 * where the current pathname isn't available via navigation.
 *
 * Per-project extension: add org/workspace scoping here following the same
 * shape — e.g. `requireOrgAccess(orgId)` that calls `requireUser()` first,
 * then checks membership. Keep every auth decision behind this one module.
 */
export async function requireUser(next?: string): Promise<User> {
  const user = await getUser();

  if (!user) {
    redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }

  return user;
}
