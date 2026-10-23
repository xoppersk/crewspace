"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * Real auth flows (Supabase Auth). No hard-coded logins, no persona
 * parameters — every state on the auth screens derives from the real
 * session and the user's real memberships.
 */

export interface AuthFormState {
  error?: string;
  notice?: string;
}

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3102"
  );
}

/** Only same-site paths may be redirect targets. */
function safeNext(formData: FormData): string | null {
  const next = String(formData.get("next") ?? "");
  return next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { error: error.message };
  // Default: /app resolves the real state — active membership →
  // workspace; deactivated membership → the deactivated screen; no
  // membership → workspace creation. A same-site `next` (e.g. an
  // invite link the visitor was sent to sign in for) wins.
  redirect(safeNext(formData) ?? "/app");
}

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!fullName) return { error: "Enter your name." };
  if (!email) return { error: "Enter your work email." };
  if (password.length < 8)
    return { error: "Use a password of at least 8 characters." };
  const next = safeNext(formData);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${appUrl()}/auth/callback?next=${encodeURIComponent(next ?? "/signup")}`,
    },
  });
  if (error) return { error: error.message };
  if (!data.session) {
    // Email confirmation is on: no session until the link is clicked.
    return {
      notice:
        "Account created. Open the confirmation email to verify your address, then come back to continue.",
    };
  }
  redirect(next ?? "/signup");
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Signup step 2 — create the workspace. Uses Worker S's
 * `create_workspace(p_name, p_slug)` RPC (00017+): it creates the org,
 * seeds the canon role template, and makes the caller owner/admin.
 */
export async function createWorkspaceAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();
  const domain = String(formData.get("domain") ?? "").trim();
  if (!name) return { error: "Give your workspace a name." };
  const slug = slugify(slugInput || name);
  if (!slug) return { error: "The workspace URL can't be empty." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in first." };
  const { data: orgId, error } = await supabase.rpc("create_workspace", {
    p_name: name,
    p_slug: slug,
  });
  if (error) {
    return {
      error: error.message.includes("create_workspace")
        ? "Workspace creation isn't available yet — the database step is still landing. Your account is created; try again shortly."
        : error.message,
    };
  }
  if (domain && orgId) {
    // Work domain is workspace configuration, stored on the org.
    await supabase
      .from("organizations")
      .update({ allowed_domains: [domain] })
      .eq("id", orgId);
  }
  redirect("/app/setup/invite");
}

export async function forgotPasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter your email." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl()}/auth/callback?next=/reset-password`,
  });
  if (error) return { error: error.message };
  return {
    notice:
      "If that email has an account, a password-reset link is on its way. Open it on this device to set a new password.",
  };
}

export async function updatePasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8)
    return { error: "Use a password of at least 8 characters." };
  if (password !== confirm) return { error: "The passwords don't match." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  redirect("/app");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/signin");
}
