"use client";

import { useState } from "react";
import Link from "next/link";
import { MailOpen, MailX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resendInvitation, revokeInvitation } from "@/lib/dashboard/actions";
import { formatAbsoluteTime, formatRelativeTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";

export interface PendingInvitation {
  id: string;
  email: string;
  roleName: string;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
  resendCount: number;
}

/**
 * PendingInvitations — top-5 pending invites with quick resend/revoke.
 * Gated on `invitations:manage` by the caller; the Server Actions re-assert.
 * Expiry chips turn red under 24h.
 */
export function PendingInvitations({
  orgId,
  orgSlug,
  invitations,
  canManage,
}: {
  orgId: string;
  orgSlug: string;
  invitations: PendingInvitation[];
  canManage: boolean;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Captured once at mount: expiry chips are relative to page load.
  const [now] = useState(() => Date.now());

  const run = async (
    id: string,
    fn: (orgId: string, orgSlug: string, invitationId: string) => Promise<{ ok: true } | { ok: false; error: string }>,
  ) => {
    setPendingId(id);
    setError(null);
    const result = await fn(orgId, orgSlug, id);
    setPendingId(null);
    if (!result.ok) setError(result.error);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Pending invitations</CardTitle>
        <Button asChild variant="link" size="sm" className="h-auto p-0">
          <Link href={`/${orgSlug}/invitations`}>View all</Link>
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {invitations.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No pending invitations —{" "}
            <Link href={`/${orgSlug}/invitations`} className="text-primary underline-offset-4 hover:underline">
              invite your first teammate
            </Link>
            .
          </p>
        ) : (
          invitations.map((inv) => {
            const hoursLeft = Math.max(
              0,
              (new Date(inv.expiresAt).getTime() - now) / 3_600_000,
            );
            const urgent = hoursLeft < 24;
            const busy = pendingId === inv.id;
            return (
              <div
                key={inv.id}
                className="flex flex-col gap-2 border-t py-3 first:border-t-0 first:pt-0 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {inv.roleName} · invited by {inv.invitedBy} ·{" "}
                    <span title={formatAbsoluteTime(inv.createdAt)}>
                      {formatRelativeTime(inv.createdAt)}
                    </span>
                    {inv.resendCount > 0 ? ` · resent ${inv.resendCount}×` : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "w-fit rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums",
                    urgent
                      ? "border-red-500/40 text-red-700"
                      : "border-amber-500/40 text-amber-700",
                  )}
                  title={formatAbsoluteTime(inv.expiresAt)}
                >
                  {hoursLeft < 1 ? "expires soon" : `expires in ${Math.round(hoursLeft)}h`}
                </span>
                {canManage ? (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-11 sm:min-h-9"
                      disabled={busy}
                      onClick={() => run(inv.id, resendInvitation)}
                      aria-label={`Resend invitation to ${inv.email}`}
                    >
                      <MailOpen className="size-4" aria-hidden />
                      <span className="sm:hidden">Resend</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-11 text-destructive hover:text-destructive sm:min-h-9"
                      disabled={busy}
                      onClick={() => run(inv.id, revokeInvitation)}
                      aria-label={`Revoke invitation to ${inv.email}`}
                    >
                      <MailX className="size-4" aria-hidden />
                      <span className="sm:hidden">Revoke</span>
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
