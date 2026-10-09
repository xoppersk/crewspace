"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { FileUp, Loader2, MailPlus, MoreHorizontal, Send, Undo2 } from "lucide-react";
import { toast } from "sonner";

import {
  copyInvitationLink,
  getInvitePageData,
  resendInvitation,
  revokeInvitation,
  type InvitationListItem,
  type InvitePageData,
  type SendResult,
} from "@/lib/invitations/actions";
import { EmptyState } from "@/components/app/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExpiryCountdown } from "@/components/invitations/countdown";
import { InvitationDrawer } from "@/components/invitations/invitation-drawer";
import { InviteDialog } from "@/components/invitations/invite-dialog";
import { CsvImport } from "@/components/invitations/csv-import";

type Tab = "pending" | "accepted" | "expired" | "revoked" | "all";

const TABS: { id: Tab; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "accepted", label: "Accepted" },
  { id: "expired", label: "Expired" },
  { id: "revoked", label: "Revoked" },
  { id: "all", label: "All" },
];

const EMPTY_COPY: Record<Tab, { title: string; description: string }> = {
  pending: {
    title: "No pending invitations",
    description: "Invite your first teammate to get started — they'll join with one click.",
  },
  accepted: {
    title: "No accepted invitations yet",
    description: "When invitees accept, they'll show up here with their join date.",
  },
  expired: {
    title: "No expired invitations",
    description: "Expired invitations stay visible here so you can resend them.",
  },
  revoked: {
    title: "No revoked invitations",
    description: "Revoked invitations are kept for your records — nothing to do.",
  },
  all: {
    title: "No invitations yet",
    description: "Send your first invitation to start growing the team.",
  },
};

/**
 * /[orgSlug]/invitations — invitation management (APP-FLOW §3).
 * Tabs, pending table (cards on mobile), invite dialog, CSV import, and the
 * detail drawer. All mutations re-check permissions server-side.
 */
export function InvitationsManager({ initial }: { initial: InvitePageData }) {
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState<Tab>("pending");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [selected, setSelected] = useState<InvitationListItem | null>(null);
  const [notice, setNotice] = useState<ReactNode>(null);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { pending: 0, accepted: 0, expired: 0, revoked: 0, all: data.invitations.length };
    for (const i of data.invitations) c[i.status] += 1;
    return c;
  }, [data.invitations]);

  const visible = useMemo(
    () =>
      tab === "all"
        ? data.invitations
        : data.invitations.filter((i) => i.status === tab),
    [data.invitations, tab],
  );

  async function refresh() {
    try {
      const next = await getInvitePageData(data.context.id);
      setData(next);
      setSelected((prev) => (prev ? (next.invitations.find((i) => i.id === prev.id) ?? null) : null));
    } catch {
      // Keep the stale list rather than blanking the page.
    }
  }

  function showSendResults(results: SendResult[]) {
    const sent = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok);
    if (failed.length === 0) {
      setNotice(`${sent} invitation${sent === 1 ? "" : "s"} sent.`);
    } else {
      setNotice(
        <span>
          {sent} sent, {failed.length} failed:{" "}
          {failed.map((f, i) => (
            <span key={f.email}>
              {i > 0 ? "; " : ""}
              {f.email} — {f.error}{" "}
              {f.memberId ? <AlreadyMemberLink memberId={f.memberId} /> : null}
              {f.existingInvitationId ? " — resend the pending invite instead." : null}
            </span>
          ))}
        </span>,
      );
    }
    void refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Invitations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Invite teammates, resend or revoke pending invites, and import in bulk.
          </p>
        </div>
        {data.canInvite ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCsvOpen(true)} className="min-h-11">
              <FileUp className="size-4" /> Bulk import
            </Button>
            <Button onClick={() => setInviteOpen(true)} className="min-h-11">
              <MailPlus className="size-4" /> Invite members
            </Button>
          </div>
        ) : null}
      </div>

      {notice ? (
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="min-h-11 gap-1.5">
              {t.label}
              <span className="rounded-full bg-muted px-1.5 text-xs">{counts[t.id]}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((t) => (
          <TabsContent key={t.id} value={t.id} className="mt-4">
            {visible.length === 0 ? (
              <EmptyState
                icon={MailPlus}
                title={EMPTY_COPY[t.id].title}
                description={EMPTY_COPY[t.id].description}
                action={
                  data.canInvite ? (
                    <Button onClick={() => setInviteOpen(true)} className="min-h-11">
                      Invite members
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden overflow-x-auto rounded-lg border md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                        <th className="px-4 py-3 font-medium">Email</th>
                        <th className="px-4 py-3 font-medium">Invited by</th>
                        <th className="px-4 py-3 font-medium">Role</th>
                        <th className="px-4 py-3 font-medium">Teams</th>
                        <th className="px-4 py-3 font-medium">Sent</th>
                        <th className="px-4 py-3 font-medium">Expires</th>
                        <th className="px-4 py-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((inv) => (
                        <InvitationTableRow
                          key={inv.id}
                          invitation={inv}
                          orgId={data.context.id}
                          canManage={data.canManage}
                          onSelect={() => setSelected(inv)}
                          onChanged={refresh}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <ul className="flex flex-col gap-3 md:hidden">
                  {visible.map((inv) => (
                    <InvitationCard
                      key={inv.id}
                      invitation={inv}
                      orgId={data.context.id}
                      canManage={data.canManage}
                      onSelect={() => setSelected(inv)}
                      onChanged={refresh}
                    />
                  ))}
                </ul>
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        context={data.context}
        onDone={showSendResults}
      />
      <CsvImport open={csvOpen} onOpenChange={setCsvOpen} context={data.context} onDone={refresh} />
      <InvitationDrawer
        invitation={selected}
        orgId={data.context.id}
        canManage={data.canManage}
        onClose={() => setSelected(null)}
        onChanged={refresh}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row actions (shared by table rows and mobile cards)
// ---------------------------------------------------------------------------

function useRowActions(invitation: InvitationListItem, orgId: string, onChanged: () => void) {
  const [pending, setPending] = useState<"resend" | "revoke" | "copy" | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doResend() {
    setPending("resend");
    setError(null);
    try {
      await resendInvitation(orgId, invitation.id);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resend.");
    } finally {
      setPending(null);
    }
  }

  async function doCopyLink() {
    setPending("copy");
    setError(null);
    try {
      const { acceptUrl } = await copyInvitationLink(orgId, invitation.id);
      await navigator.clipboard.writeText(acceptUrl);
      toast.success("Invite link copied", {
        description: "This is a fresh link — the previous one no longer works. No new email was sent.",
      });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not copy the link.");
    } finally {
      setPending(null);
    }
  }

  async function doRevoke() {
    setPending("revoke");
    setError(null);
    try {
      await revokeInvitation(orgId, invitation.id);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not revoke.");
    } finally {
      setPending(null);
      setConfirmRevoke(false);
    }
  }

  return { pending, confirmRevoke, setConfirmRevoke, error, doResend, doCopyLink, doRevoke };
}

function InvitationTableRow({
  invitation: inv,
  orgId,
  canManage,
  onSelect,
  onChanged,
}: {
  invitation: InvitationListItem;
  orgId: string;
  canManage: boolean;
  onSelect: () => void;
  onChanged: () => void;
}) {
  return (
    <tr className="cursor-pointer border-b align-middle last:border-0 hover:bg-muted/40" onClick={onSelect}>
      <td className="px-4 py-3 font-medium">{inv.email}</td>
      <td className="px-4 py-3 text-muted-foreground">{inv.inviter_name}</td>
      <td className="px-4 py-3">
        <Badge variant="secondary">{inv.role_name}</Badge>
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {inv.team_names.length ? inv.team_names.join(", ") : "—"}
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {new Date(inv.created_at).toLocaleDateString()}
      </td>
      <td className="px-4 py-3">
        {inv.status === "pending" ? (
          <ExpiryCountdown expiresAt={inv.expires_at} />
        ) : (
          <span className="text-muted-foreground">
            {inv.status === "accepted" && inv.accepted_at
              ? `Accepted ${new Date(inv.accepted_at).toLocaleDateString()}`
              : inv.status}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
        {canManage && inv.status === "pending" ? (
          <RowActionMenu invitation={inv} orgId={orgId} onChanged={onChanged} />
        ) : null}
      </td>
    </tr>
  );
}

function InvitationCard({
  invitation: inv,
  orgId,
  canManage,
  onSelect,
  onChanged,
}: {
  invitation: InvitationListItem;
  orgId: string;
  canManage: boolean;
  onSelect: () => void;
  onChanged: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full flex-col gap-2 rounded-lg border p-4 text-left active:bg-muted/40"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 break-all font-medium">{inv.email}</p>
          {canManage && inv.status === "pending" ? (
            <span onClick={(e) => e.stopPropagation()}>
              <RowActionMenu invitation={inv} orgId={orgId} onChanged={onChanged} />
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{inv.role_name}</Badge>
          <span>by {inv.inviter_name}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Sent {new Date(inv.created_at).toLocaleDateString()}</span>
          {inv.status === "pending" ? <ExpiryCountdown expiresAt={inv.expires_at} /> : <span>{inv.status}</span>}
        </div>
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Action menu — resend / revoke / copy link (invitations:manage only)
// ---------------------------------------------------------------------------

function RowActionMenu({
  invitation,
  orgId,
  onChanged,
}: {
  invitation: InvitationListItem;
  orgId: string;
  onChanged: () => void;
}) {
  const actions = useRowActions(invitation, orgId, onChanged);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-11" aria-label={`Actions for ${invitation.email}`}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          disabled={actions.pending !== null}
          onClick={() => void actions.doResend()}
          className="min-h-11"
        >
          {actions.pending === "resend" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Resend
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={actions.pending !== null}
          onClick={() => void actions.doCopyLink()}
          className="min-h-11"
        >
          {actions.pending === "copy" ? <Loader2 className="size-4 animate-spin" /> : null}
          Copy invite link
        </DropdownMenuItem>
        {actions.confirmRevoke ? (
          <DropdownMenuItem
            onClick={() => void actions.doRevoke()}
            className="min-h-11 text-destructive focus:text-destructive"
          >
            {actions.pending === "revoke" ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />}
            Confirm revoke
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() => actions.setConfirmRevoke(true)}
            className="min-h-11 text-destructive focus:text-destructive"
          >
            <Undo2 className="size-4" /> Revoke
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Link shown when an invited email is already a member. */
export function AlreadyMemberLink({ memberId }: { memberId: string }) {
  return (
    <Button asChild variant="link" className="h-auto p-0">
      <Link href={`./directory/${memberId}`}>View their profile</Link>
    </Button>
  );
}
