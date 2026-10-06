"use server";

import { revalidatePath } from "next/cache";

import { writeAudit } from "@/lib/audit";
import { ForbiddenError, requireOrgAccess } from "@/lib/permissions";

export type ActionResult = { ok: true } | { ok: false; error: string };

function fail(error: unknown): ActionResult {
  if (error instanceof ForbiddenError) {
    return { ok: false, error: "You don't have permission to do that." };
  }
  return { ok: false, error: error instanceof Error ? error.message : "Something went wrong." };
}

/**
 * Quick resend from the dashboard's pending-invitations card.
 * Ownership note (Worker 4): the Invitations page worker owns the full
 * invitation lifecycle — these two actions are scoped to the dashboard's
 * quick actions only. If that worker ships `resendInvitation`/`revokeInvitation`
 * in `src/lib/invitations/actions.ts`, consolidate onto those and delete these.
 */
export async function resendInvitation(
  orgId: string,
  orgSlug: string,
  invitationId: string,
): Promise<ActionResult> {
  try {
    const { user, supabase } = await requireOrgAccess(orgId, "invitations:manage");

    const { data: invitation, error: loadError } = await supabase
      .from("invitations")
      .select("id, email, status, resend_count")
      .eq("org_id", orgId)
      .eq("id", invitationId)
      .maybeSingle();
    if (loadError) throw loadError;
    if (!invitation) throw new Error("Invitation not found.");
    if (invitation.status !== "pending") {
      throw new Error("Only pending invitations can be resent.");
    }

    const { error } = await supabase
      .from("invitations")
      .update({
        resend_count: (invitation.resend_count ?? 0) + 1,
        expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      })
      .eq("id", invitationId);
    if (error) throw error;

    await writeAudit(orgId, user.id, "invitation.resent", {
    targetType: "invitation",
    targetId: invitationId,
    targetLabel: invitation.email,
  });

    revalidatePath(`/${orgSlug}/dashboard`);
    revalidatePath(`/${orgSlug}/invitations`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function revokeInvitation(
  orgId: string,
  orgSlug: string,
  invitationId: string,
): Promise<ActionResult> {
  try {
    const { user, supabase } = await requireOrgAccess(orgId, "invitations:manage");

    const { data: invitation, error: loadError } = await supabase
      .from("invitations")
      .select("id, email, status")
      .eq("org_id", orgId)
      .eq("id", invitationId)
      .maybeSingle();
    if (loadError) throw loadError;
    if (!invitation) throw new Error("Invitation not found.");
    if (invitation.status !== "pending") {
      throw new Error("Only pending invitations can be revoked.");
    }

    const { error } = await supabase
      .from("invitations")
      .update({ status: "revoked" })
      .eq("id", invitationId);
    if (error) throw error;

    await writeAudit(orgId, user.id, "invitation.revoked", {
    targetType: "invitation",
    targetId: invitationId,
    targetLabel: invitation.email,
  });

    revalidatePath(`/${orgSlug}/dashboard`);
    revalidatePath(`/${orgSlug}/invitations`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
