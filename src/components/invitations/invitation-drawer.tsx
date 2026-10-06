"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, MailOpen, Send, Undo2 } from "lucide-react";

import {
  getInvitationTimeline,
  resendInvitation,
  revokeInvitation,
  type InvitationListItem,
} from "@/lib/invitations/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ExpiryCountdown } from "@/components/invitations/countdown";

const ACTION_LABELS: Record<string, string> = {
  "invitation.sent": "Invitation sent",
  "invitation.bulk_sent": "Bulk invitations sent",
  "invitation.resent": "Invitation resent",
  "invitation.accepted": "Invitation accepted",
  "invitation.revoked": "Invitation revoked",
  "membership.created": "Member joined",
};

/**
 * Invitation detail drawer (APP-FLOW §3 /invitations): full lifecycle
 * timeline (sent → resent ×n → accepted/revoked) plus resend/revoke/copy-link
 * actions for pending invitations.
 */
export function InvitationDrawer({
  invitation,
  orgId,
  canManage,
  onClose,
  onChanged,
}: {
  invitation: InvitationListItem | null;
  orgId: string;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [timeline, setTimeline] = useState<Awaited<
    ReturnType<typeof getInvitationTimeline>
  > | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionPending, setActionPending] = useState<"resend" | "revoke" | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!invitation) return;
    let cancelled = false;
    // All state updates run inside the async task (a callback), not
    // synchronously in the effect body, so opening a different invitation
    // never shows the previous one's timeline.
    void (async () => {
      setLoading(true);
      setTimeline(null);
      setNotice(null);
      setError(null);
      setConfirmRevoke(false);
      try {
        const t = await getInvitationTimeline(orgId, invitation.id);
        if (!cancelled) setTimeline(t);
      } catch {
        if (!cancelled) setError("Could not load the timeline. Try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invitation, orgId]);

  async function onResend() {
    if (!invitation) return;
    setActionPending("resend");
    setError(null);
    try {
      await resendInvitation(orgId, invitation.id);
      setNotice("Invitation resent with a fresh link.");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resend. Try again.");
    } finally {
      setActionPending(null);
    }
  }

  async function onCopyLink() {
    if (!invitation) return;
    setActionPending("resend");
    setError(null);
    try {
      const { acceptUrl } = await resendInvitation(orgId, invitation.id);
      await navigator.clipboard.writeText(acceptUrl);
      setNotice("New invite link copied — the old link no longer works.");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not copy the link. Try again.");
    } finally {
      setActionPending(null);
    }
  }

  async function onRevoke() {
    if (!invitation) return;
    setActionPending("revoke");
    setError(null);
    try {
      await revokeInvitation(orgId, invitation.id);
      onChanged();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not revoke. Try again.");
    } finally {
      setActionPending(null);
      setConfirmRevoke(false);
    }
  }

  const statusBadge: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    accepted: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    expired: "bg-muted text-muted-foreground",
    revoked: "bg-destructive/10 text-destructive",
  };

  return (
    <Sheet open={invitation !== null} onOpenChange={(o) => (o ? null : onClose())}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {invitation ? (
          <>
            <SheetHeader>
              <SheetTitle className="break-all pr-6">{invitation.email}</SheetTitle>
              <SheetDescription>
                Invited by {invitation.inviter_name} ·{" "}
                {new Date(invitation.created_at).toLocaleDateString()}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={statusBadge[invitation.status]}>{invitation.status}</Badge>
                {invitation.status === "pending" ? (
                  <ExpiryCountdown expiresAt={invitation.expires_at} />
                ) : null}
                {invitation.source === "bulk" ? <Badge variant="outline">bulk</Badge> : null}
                {invitation.resend_count > 0 ? (
                  <Badge variant="secondary">resent ×{invitation.resend_count}</Badge>
                ) : null}
              </div>

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Role offered</dt>
                  <dd className="font-medium">{invitation.role_name}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Teams</dt>
                  <dd className="font-medium">
                    {invitation.team_names.length ? invitation.team_names.join(", ") : "—"}
                  </dd>
                </div>
                {invitation.message ? (
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">Personal message</dt>
                    <dd className="rounded-md bg-muted p-2.5 text-sm">{invitation.message}</dd>
                  </div>
                ) : null}
              </dl>

              {canManage && invitation.status === "pending" ? (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={onResend}
                      disabled={actionPending !== null}
                      className="min-h-11 flex-1"
                    >
                      {actionPending === "resend" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Send className="size-4" />
                      )}
                      Resend
                    </Button>
                    <Button
                      variant="outline"
                      onClick={onCopyLink}
                      disabled={actionPending !== null}
                      className="min-h-11 flex-1"
                    >
                      Copy link
                    </Button>
                  </div>
                  {confirmRevoke ? (
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        onClick={onRevoke}
                        disabled={actionPending !== null}
                        className="min-h-11 flex-1"
                      >
                        {actionPending === "revoke" ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : null}
                        Confirm revoke
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setConfirmRevoke(false)}
                        className="min-h-11"
                      >
                        Keep
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      onClick={() => setConfirmRevoke(true)}
                      className="min-h-11 text-destructive hover:text-destructive"
                    >
                      <Undo2 className="size-4" /> Revoke invitation
                    </Button>
                  )}
                </div>
              ) : null}

              {notice ? (
                <Alert>
                  <AlertDescription>{notice}</AlertDescription>
                </Alert>
              ) : null}
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <Separator />

              {/* Lifecycle timeline */}
              <div>
                <h3 className="mb-3 text-sm font-semibold">Timeline</h3>
                {loading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Loading timeline…
                  </div>
                ) : (
                  <ol className="relative flex flex-col gap-4 border-l pl-5">
                    {timeline?.events.map((event) => (
                      <li key={event.id} className="relative">
                        <span className="absolute -left-[26px] top-0.5 flex size-4 items-center justify-center rounded-full bg-muted">
                          <EventDot action={event.action} />
                        </span>
                        <p className="text-sm font-medium">
                          {ACTION_LABELS[event.action] ?? event.action}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {event.actorName} · {new Date(event.createdAt).toLocaleString()}
                        </p>
                      </li>
                    ))}
                    {timeline && timeline.events.length === 0 ? (
                      <li className="relative">
                        <p className="text-sm text-muted-foreground">
                          Invitation created{" "}
                          {new Date(invitation.created_at).toLocaleDateString()}.
                        </p>
                      </li>
                    ) : null}
                  </ol>
                )}
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function EventDot({ action }: { action: string }) {
  if (action === "invitation.accepted" || action === "membership.created") {
    return <CheckCircle2 className="size-3 text-emerald-600" />;
  }
  if (action === "invitation.revoked") {
    return <Undo2 className="size-3 text-destructive" />;
  }
  return <MailOpen className="size-3 text-muted-foreground" />;
}
