import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";
import { ForbiddenError, requireOrgAccess } from "@/lib/permissions";
import { groupCatalog, type ResourceGroup } from "@/lib/roles/catalog";
import { createClient } from "@/lib/supabase/server";

/**
 * Server-only helpers shared by the roles pages and server actions.
 * (Deliberately NOT a "use server" module — pages import these directly;
 *  actions.ts imports them too.)
 */

export interface OrgRef {
  id: string;
  name: string;
  slug: string;
}

/**
 * Resolves an org by slug for the signed-in user. Mirrors the [orgSlug]
 * layout's bootstrap: unknown slug (or not an active member — RLS hides it)
 * → notFound(), so strangers can never confirm an org exists.
 */
export async function getOrgBySlug(slug: string): Promise<OrgRef> {
  await requireUser(`/${slug}`);
  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (!org) notFound();
  return org;
}

/**
 * Non-throwing permission check for UI gating (e.g. showing/hiding the
 * "New role" button). Catches ForbiddenError only — a missing/inactive
 * membership still surfaces as notFound(), never as a quiet `false`.
 */
export async function hasOrgPermission(orgId: string, permissionKey: string): Promise<boolean> {
  try {
    await requireOrgAccess(orgId, permissionKey);
    return true;
  } catch (error) {
    if (error instanceof ForbiddenError) return false;
    throw error;
  }
}

/**
 * Loads the static permission catalog grouped into matrix resource
 * sections. Readable by any signed-in user (permissions_select, 00005);
 * the table is seeded once and never written at runtime.
 */
export async function getPermissionCatalog(): Promise<ResourceGroup[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("permissions")
    .select("key, resource, action, label, description");
  if (error) throw error;
  return groupCatalog(data ?? []);
}
