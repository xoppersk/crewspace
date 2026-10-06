"use server";

import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { createOrgSchema } from "@/lib/validations/org";

export interface CreateOrgResult {
  ok: boolean;
  slug?: string;
  error?: string;
}

/**
 * Creates an organization for the signed-in user via the create_organization()
 * DB function (one transaction: org + 5 system roles + owner membership).
 * Validation is shared with the client via createOrgSchema.
 */
export async function createOrganizationAction(
  input: unknown,
): Promise<CreateOrgResult> {
  // Signed-in check (redirects to /sign-in when signed out); the user id
  // itself isn't needed — create_organization() uses auth.uid() internally.
  await requireUser("/onboarding");

  const parsed = createOrgSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { data: orgId, error } = await supabase.rpc("create_organization", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_logo_url: parsed.data.logoUrl ?? null,
  });

  if (error) {
    // Slug collisions surface as a unique-violation — translate to copy.
    const message = /duplicate|unique/i.test(error.message)
      ? "That slug is taken — try another."
      : error.message;
    return { ok: false, error: message };
  }

  // Look up the slug for the redirect (RLS: the caller is now a member).
  const { data: org } = await supabase
    .from("organizations")
    .select("slug")
    .eq("id", orgId as string)
    .single();

  return { ok: true, slug: org?.slug ?? parsed.data.slug };
}
