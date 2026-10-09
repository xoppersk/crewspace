"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { FileUp, MailPlus } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoleSeal } from "@/components/crew/role-seal";
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
      <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-foreground pb-4">
        <div>
          <p className="type-label uppercase tracking-[0.17em] text-muted-foreground">
            Crewspace / Letters of appointment
          </p>
          <h1 className="type-display mt-1">Invitations</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Track pending access, resend safely, revoke stale links, and resolve import
            errors.
          </p>
        </div>
        {data.canInvite ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCsvOpen(true)} className="min-h-11">
              <FileUp className="size-4" /> Bulk import
            </Button>
            <Button onClick={() => setInviteOpen(true)} className="min-h-11">
              <MailPlus className="size-4" /> Invite member
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
              <div className="appointment-list">
                {visible.map((inv) => (
                  <AppointmentLetter
                    key={inv.id}
                    invitation={inv}
                    orgId={data.context.id}
                    canManage={data.canManage}
                    onSelect={() => setSelected(inv)}
                    onChanged={refresh}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Appointment policy */}
      <div>
        <div className="flex items-baseline justify-between border-b border-foreground pb-2">
          <h2 className="text-sm font-bold uppercase tracking-[0.17em]">Appointment policy</h2>
          <span className="text-xs text-muted-foreground">Invitations expire after 7 days</span>
        </div>
        <Card className="mt-4 rounded-none">
          <CardContent className="pt-2">
            <ul className="flex flex-col divide-y divide-border">
              <li className="grid grid-cols-[2.5rem_1fr_auto] items-start gap-3 py-3">
                <span className="grid size-8 place-items-center border-b-2 border-primary font-mono text-[11px] font-bold" aria-hidden>
                  01
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">Role is fixed at issue</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Withdraw and reissue to change an appointed role.
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">Policy</span>
              </li>
              <li className="grid grid-cols-[2.5rem_1fr_auto] items-start gap-3 py-3">
                <span className="grid size-8 place-items-center border-b-2 border-primary font-mono text-[11px] font-bold" aria-hidden>
                  02
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">Every action is audited</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Resends and withdrawals record actor and time.
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">Governance</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

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

/**
 * AppointmentLetter — the artifact's letter of appointment (Flagship UI
 * Designs): numbered letter, identity + role seal, the fixed appointment
 * copy, a "{status} · expires {date}" line, and Resend / Withdraw actions.
 */
function AppointmentLetter({
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
  const actions = useRowActions(inv, orgId, onChanged);
  const number = `INV-${inv.id.replace(/-/g, "").slice(0, 4).toUpperCase()}`;
  const statusLabel =
    inv.status === "pending"
      ? "Pending"
      : inv.status === "accepted"
        ? "Accepted"
        : inv.status === "expired"
          ? "Expired"
          : "Revoked";
  const expiryDate = new Date(inv.expires_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const withdrawn = inv.status === "revoked" || inv.status === "expired";
  // Captured once per mount — the "expiring soon" highlight doesn't need a ticking clock.
  const [now] = useState(() => Date.now());
  const urgent =
    inv.status === "pending" &&
    new Date(inv.expires_at).getTime() - now < 48 * 60 * 60 * 1000;

  return (
    <article className={`appointment-letter${withdrawn ? " is-withdrawn" : ""}`}>
      <span className="appointment-number">{number}</span>
      <div className="min-w-0">
        <h4>
          <button
            type="button"
            onClick={onSelect}
            className="min-w-0 truncate text-left hover:underline"
          >
            {inv.email}
          </button>
          <RoleSeal>{inv.role_name}</RoleSeal>
        </h4>
        <p>Invitation to join the organization with the appointed role shown above.</p>
        <div className={`appointment-expiry${urgent ? " urgent" : ""}`}>
          {statusLabel} · expires {expiryDate}
        </div>
        {actions.error ? (
          <p role="alert" className="mt-1 text-xs text-destructive">
            {actions.error}
          </p>
        ) : null}
      </div>
      <div className="appointment-actions">
        {canManage && inv.status === "pending" ? (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={actions.pending !== null}
              onClick={() => void actions.doResend()}
              className="min-h-11"
            >
              {actions.pending === "resend" ? "Resending…" : "Resend"}
            </Button>
            {actions.confirmRevoke ? (
              <Button
                variant="outline"
                size="sm"
                disabled={actions.pending !== null}
                onClick={() => void actions.doRevoke()}
                className="min-h-11 text-destructive"
              >
                {actions.pending === "revoke" ? "Withdrawing…" : "Confirm withdraw"}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => actions.setConfirmRevoke(true)}
                className="min-h-11"
              >
                Withdraw
              </Button>
            )}
          </>
        ) : null}
      </div>
    </article>
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
