"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/auth/require-user";

type ActionResult = { ok: true } | { ok: false; error: string };

function friendlyRpcError(error: { message: string }, fallback: string): string {
  const message = error.message;
  if (message.includes("sole owner of")) {
    const orgName = message.match(/sole owner of "([^"]+)"/)?.[1] ?? "an organization";
    return `You can't leave ${orgName} — you're the only owner. Transfer ownership to another member first.`;
  }
  if (message.includes("not an active member")) {
    return "You're not an active member of that organization.";
  }
  if (message.includes("not addressed to you")) {
    return "That invitation isn't addressed to your account.";
  }
  if (message.includes("no longer pending")) {
    return "That invitation is no longer pending.";
  }
  if (message.includes("has expired")) {
    return "That invitation has expired — ask the sender for a new one.";
  }
  return fallback;
}

/** Leave an organization (self). The RPC refuses the last owner by name. */
export async function leaveOrg(orgId: string): Promise<ActionResult> {
  await requireUser("/account");
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_organization", { p_org_id: orgId });
  if (error) {
    return { ok: false, error: friendlyRpcError(error, "Couldn't leave — try again.") };
  }
  revalidatePath("/account");
  return { ok: true };
}

/** Accept a pending invitation received by the viewer (tokenless — email match is the check). */
export async function acceptInvitation(
  invitationId: string,
): Promise<{ ok: true; orgSlug: string } | { ok: false; error: string }> {
  const user = await requireUser("/account");
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invitation_by_id", {
    p_invitation_id: invitationId,
  });
  if (error) {
    return { ok: false, error: friendlyRpcError(error, "Couldn't accept — try again.") };
  }
  // Find the org we just joined (newest active membership).
  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: org } = membership
    ? await supabase.from("organizations").select("slug").eq("id", membership.org_id).maybeSingle()
    : { data: null };
  revalidatePath("/account");
  return { ok: true, orgSlug: org?.slug ?? "" };
}

/** Decline a pending invitation received by the viewer. */
export async function declineInvitation(invitationId: string): Promise<ActionResult> {
  await requireUser("/account");
  const supabase = await createClient();
  const { error } = await supabase.rpc("decline_invitation", {
    p_invitation_id: invitationId,
  });
  if (error) {
    return { ok: false, error: friendlyRpcError(error, "Couldn't decline — try again.") };
  }
  revalidatePath("/account");
  return { ok: true };
}

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be at most 72 characters.");

/** Change the viewer's password (signed-in re-auth via the current session). */
export async function changePassword(newPassword: string): Promise<ActionResult> {
  const parsed = passwordSchema.safeParse(newPassword);
  if (!parsed.success) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  await requireUser("/account");
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) {
    return { ok: false, error: "Couldn't change your password — try again." };
  }
  return { ok: true };
}

/**
 * Signs the viewer out everywhere, including this device (revokes all
 * refresh tokens). The client redirects to /sign-in afterwards.
 */
export async function signOutEverywhere(): Promise<ActionResult> {
  await requireUser("/account");
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) {
    return { ok: false, error: "Couldn't sign out everywhere — try again." };
  }
  return { ok: true };
}

/**
 * Deletes the viewer's account. The typed email must match; the
 * delete_own_account RPC blocks sole owners (naming the org) and accounts
 * with immutable audit history. Only after it succeeds is auth.users
 * removed via the service role.
 */
export async function deleteAccount(
  confirmEmail: string,
): Promise<{ ok: true } | { ok: false; error: string; code?: "sole-owner" | "audit-history" | "mismatch" }> {
  const user = await requireUser("/account");
  if (confirmEmail.trim().toLowerCase() !== (user.email ?? "").toLowerCase()) {
    return {
      ok: false,
      code: "mismatch",
      error: "That doesn't match your account email — check the spelling and try again.",
    };
  }

  const supabase = await createClient();
  const { error: rpcError } = await supabase.rpc("delete_own_account", {
    p_email_confirm: confirmEmail.trim(),
  });
  if (rpcError) {
    const message = rpcError.message;
    if (message.includes("sole owner of")) {
      const orgName = message.match(/sole owner of "([^"]+)"/)?.[1];
      return {
        ok: false,
        code: "sole-owner",
        error: orgName
          ? `You're the only owner of ${orgName}. Transfer ownership to another member first, then delete your account.`
          : "You're the only owner of an organization. Transfer ownership first.",
      };
    }
    if (message.includes("immutable audit history")) {
      return {
        ok: false,
        code: "audit-history",
        error:
          "Your actions are recorded in one or more organization audit logs, and audit history can't be deleted or anonymized. Contact support to finish deleting your account.",
      };
    }
    return { ok: false, error: "Couldn't delete your account — try again." };
  }

  // Memberships + profile are gone; now remove the auth user itself.
  try {
    const service = createServiceClient();
    const { error: adminError } = await service.auth.admin.deleteUser(user.id);
    if (adminError) throw adminError;
  } catch {
    // The transactional part succeeded (memberships/profile removed); the
    // auth row remains. Surface honestly instead of pretending it worked.
    return {
      ok: false,
      error:
        "Your organizations and profile were removed, but the final sign-in record couldn't be deleted automatically. Contact support to finish.",
    };
  }

  return { ok: true };
}
