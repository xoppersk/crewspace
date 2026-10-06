"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { ForbiddenError, requireOrgAccess } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { orgSettingsSchema } from "@/lib/validations/settings";

const SETTING_KEYS = [
  "name",
  "slug",
  "logo_url",
  "default_role_id",
  "invite_policy",
  "allowed_domains",
  "require_email_verification",
  "session_timeout_minutes",
  "require_reauth_destructive",
] as const;

/** General-tab identity fields are audited as org.updated; the rest as settings.updated. */
const ORG_IDENTITY_KEYS = new Set(["name", "slug", "logo_url"]);

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * Saves org settings (all tabs, one payload). Layer 2: `settings:manage`.
 * Writes a `settings.updated` audit row with a per-field before/after diff —
 * only when something actually changed.
 */
export async function saveOrgSettings(
  orgSlug: string,
  input: unknown,
): Promise<
  | { ok: true; slugChanged: boolean; newSlug: string }
  | { ok: false; error: string }
> {
  try {
    const parsed = orgSettingsSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Some settings look invalid — check the highlighted fields and try again.",
      };
    }
    const values = parsed.data;

    const supabase = await createClient();
    const { data: org } = await supabase
      .from("organizations")
      .select("id, slug")
      .eq("slug", orgSlug)
      .maybeSingle();
    if (!org) notFound();

    const { user } = await requireOrgAccess(org.id, "settings:manage");

    // The default role must belong to this org (defense in depth — RLS on
    // roles would hide foreign rows, but check explicitly for a clear error).
    const { data: defaultRole } = await supabase
      .from("roles")
      .select("id")
      .eq("id", values.default_role_id)
      .eq("org_id", org.id)
      .maybeSingle();
    if (!defaultRole) {
      return { ok: false, error: "That default role doesn't belong to this organization." };
    }

    const { data: current, error: loadError } = await supabase
      .from("organizations")
      .select(
        "name, slug, logo_url, default_role_id, invite_policy, allowed_domains, require_email_verification, session_timeout_minutes, require_reauth_destructive",
      )
      .eq("id", org.id)
      .single();
    if (loadError || !current) throw loadError ?? new Error("Organization not found.");

    const diff: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of SETTING_KEYS) {
      const next = key === "logo_url" ? (values.logo_url ?? null) : values[key];
      if (!sameValue(current[key], next)) {
        diff[key] = { from: current[key] ?? null, to: next ?? null };
      }
    }

    if (Object.keys(diff).length === 0) {
      return { ok: true, slugChanged: false, newSlug: org.slug };
    }

    const { error: updateError } = await supabase
      .from("organizations")
      .update({
        name: values.name,
        slug: values.slug,
        logo_url: values.logo_url ?? null,
        default_role_id: values.default_role_id,
        invite_policy: values.invite_policy,
        allowed_domains: values.allowed_domains,
        require_email_verification: values.require_email_verification,
        session_timeout_minutes: values.session_timeout_minutes,
        require_reauth_destructive: values.require_reauth_destructive,
      })
      .eq("id", org.id);
    if (updateError) {
      if (updateError.code === "23505") {
        return { ok: false, error: "That slug is taken — try another." };
      }
      throw updateError;
    }

    await writeAudit(org.id, user.id, "settings.updated", {
      targetType: "organization",
      targetId: org.id,
      targetLabel: values.name,
      diff,
    });
    const identityDiff = Object.fromEntries(
      Object.entries(diff).filter(([key]) => ORG_IDENTITY_KEYS.has(key)),
    );
    if (Object.keys(identityDiff).length > 0) {
      await writeAudit(org.id, user.id, "org.updated", {
        targetType: "organization",
        targetId: org.id,
        targetLabel: values.name,
        diff: identityDiff,
      });
    }

    const slugChanged = values.slug !== org.slug;
    revalidatePath(`/${org.slug}/settings`);
    if (slugChanged) revalidatePath(`/${values.slug}/settings`);
    return { ok: true, slugChanged, newSlug: values.slug };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { ok: false, error: "You don't have permission to change organization settings." };
    }
    throw error;
  }
}
