"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { updateProfileSchema } from "@/lib/validations/profile";

/**
 * Updates the viewer's own profile. Layer 1 is the profile page itself;
 * RLS (profiles UPDATE: own row only) is the backstop.
 */
export async function updateProfile(
  orgSlug: string,
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Some profile fields look invalid — check them and try again.",
    };
  }
  const user = await requireUser(`/${orgSlug}/profile`);
  const supabase = await createClient();
  const values = parsed.data;

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: values.full_name,
      title: values.title || null,
      bio: values.bio || null,
      timezone: values.timezone,
      ...(values.avatar_url !== undefined ? { avatar_url: values.avatar_url } : {}),
    })
    .eq("id", user.id);
  if (error) throw error;

  revalidatePath(`/${orgSlug}/profile`);
  return { ok: true };
}

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.");

/**
 * Starts the Supabase Auth email-change flow: a confirmation link goes to
 * the NEW address, and the change only takes effect when it's clicked
 * (re-verification, per APP-FLOW §3).
 */
export async function updateAccountEmail(
  email: string,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid email address." };
  }
  await requireUser();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.email?.toLowerCase() === parsed.data) {
    return { ok: false, error: "That's already your email address." };
  }

  const { error } = await supabase.auth.updateUser({ email: parsed.data });
  if (error) {
    if (/already/i.test(error.message)) {
      return { ok: false, error: "That email is already in use by another account." };
    }
    return { ok: false, error: "Couldn't start the email change — try again." };
  }

  return {
    ok: true,
    message: `We've sent a confirmation link to ${parsed.data}. Your email changes when you click it.`,
  };
}
