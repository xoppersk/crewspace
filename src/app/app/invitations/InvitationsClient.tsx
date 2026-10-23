"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createInvitation,
  resendInvitation,
  revokeInvitation,
} from "@/lib/data/actions";
import type { InvitationStatus } from "@/lib/types";
import { Button } from "@/components/Button";
import {
  InviteForm,
  type InviteRoleOption,
  type InviteTeamOption,
} from "./InviteForm";

export type TabKey = "open" | "accepted" | "expired" | "revoked";

/** An invitation with its role/team/inviter names resolved (server-side). */
export interface InvitationView {
  id: string;
  name: string;
  email: string;
  suggestedEmail?: string;
  roleId: string;
  roleName: string;
  teamId: string;
  teamName: string;
  inviterName: string;
  sent: string;
  status: InvitationStatus;
  openedAt: string | null;
  expires: string;
  acceptedOn?: string;
}

function StatusCell({ inv }: { inv: InvitationView }) {
  if (inv.status === "bounced") {
    return (
      <span role="cell">
        <span className="gov-st bad" style={{ fontSize: 13 }}>
          Didn’t arrive
        </span>
        <small>
          Mail server says the address doesn’t exist.
          {inv.suggestedEmail ? ` Maybe ${inv.suggestedEmail}?` : ""}
        </small>
      </span>
    );
  }
  if (inv.status === "open" && inv.openedAt) {
    return (
      <span role="cell">
        <span className="gov-st pe" style={{ fontSize: 13 }}>
          Opened, not accepted
        </span>
        <small>
          Opened {inv.openedAt} · expires {inv.expires}
        </small>
      </span>
    );
  }
  if (inv.status === "open") {
    return (
      <span role="cell">
        <span className="gov-st plain" style={{ fontSize: 13 }}>
          Delivered, not opened
        </span>
        <small>Expires {inv.expires}</small>
      </span>
    );
  }
  if (inv.status === "accepted") {
    return (
      <span role="cell">
        <span className="gov-st ok" style={{ fontSize: 13 }}>
          Accepted
        </span>
        <small>
          {inv.acceptedOn ? `Accepted ${inv.acceptedOn}` : "Accepted"} · sent{" "}
          {inv.sent}
        </small>
      </span>
    );
  }
  if (inv.status === "expired") {
    return (
      <span role="cell">
        <span className="gov-st off" style={{ fontSize: 13 }}>
          Expired
        </span>
        <small>
          Expired {inv.expires} · sent {inv.sent}
        </small>
      </span>
    );
  }
  return (
    <span role="cell">
      <span className="gov-st off" style={{ fontSize: 13 }}>
        Revoked
      </span>
      <small>Sent {inv.sent} · the link no longer works</small>
    </span>
  );
}

/**
 * G-01 invitations register. Every action is real: Resend re-issues
 * the invitation through the resend server action (new token hash,
 * old link dead), Revoke revokes the row, Fix address revokes the
 * bounced row and sends a fresh invitation to the suggested address,
 * and the invite form creates a real invitation row. After each
 * action the route refreshes from the database. Tab state lives in
 * the URL (?tab=) via history.replaceState so it survives a reload.
 */
export function InvitationsClient({
  initialInvitations,
  initialTab,
  roles,
  teams,
}: {
  initialInvitations: InvitationView[];
  initialTab: TabKey;
  roles: InviteRoleOption[];
  teams: InviteTeamOption[];
}) {
  const router = useRouter();
  const invitations = initialInvitations;
  const [tab, setTabState] = useState<TabKey>(initialTab);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  function setTab(next: TabKey) {
    setTabState(next);
    const url =
      next === "open" ? "/app/invitations" : `/app/invitations?tab=${next}`;
    window.history.replaceState(null, "", url);
  }

  const counts = {
    open: invitations.filter((i) => i.status === "open" || i.status === "bounced").length,
    accepted: invitations.filter((i) => i.status === "accepted").length,
    expired: invitations.filter((i) => i.status === "expired").length,
    revoked: invitations.filter((i) => i.status === "revoked").length,
  };

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "open", label: "Open", count: counts.open },
    { key: "accepted", label: "Accepted, 30 days", count: counts.accepted },
    { key: "expired", label: "Expired", count: counts.expired },
    { key: "revoked", label: "Revoked", count: counts.revoked },
  ];

  let rows: InvitationView[];
  if (tab === "open") {
    /* Bounced first, then the rest in server order. */
    const open = invitations.filter(
      (i) => i.status === "open" || i.status === "bounced",
    );
    rows = [
      ...open.filter((i) => i.status === "bounced"),
      ...open.filter((i) => i.status === "open"),
    ];
  } else {
    rows = invitations.filter((i) => i.status === tab);
  }

  async function run(
    inv: InvitationView,
    fn: () => Promise<{ ok: boolean; error?: string; invitePath?: string }>,
  ) {
    setBusyId(inv.id);
    setNote(null);
    const res = await fn();
    setBusyId(null);
    if (!res.ok) {
      setNote(res.error ?? "That didn't work.");
      return;
    }
    if (res.invitePath) {
      setNote(`Invitation link: ${window.location.origin}${res.invitePath}`);
    }
    router.refresh();
  }

  function resend(inv: InvitationView) {
    void run(inv, () => resendInvitation(inv.id));
  }
  function revoke(inv: InvitationView) {
    void run(inv, () => revokeInvitation(inv.id));
  }
  function fixAddress(inv: InvitationView) {
    void run(inv, async () => {
      const revoked = await revokeInvitation(inv.id);
      if (!revoked.ok) return revoked;
      return createInvitation({
        email: inv.suggestedEmail ?? inv.email,
        roleId: inv.roleId,
        teamId: inv.teamId || undefined,
      });
    });
  }
  function inviteAgain(inv: InvitationView) {
    void run(inv, () =>
      createInvitation({
        email: inv.email,
        roleId: inv.roleId,
        teamId: inv.teamId || undefined,
      }),
    );
    setTab("open");
  }
  async function addInvite(data: {
    email: string;
    roleId: string;
    teamId: string;
    message?: string;
  }): Promise<{ ok: boolean; error?: string; invitePath?: string }> {
    const res = await createInvitation({
      email: data.email,
      roleId: data.roleId,
      teamId: data.teamId || undefined,
      message: data.message,
    });
    if (res.ok) {
      setTab("open");
      router.refresh();
    }
    return res;
  }

  function ActionsCell({ inv }: { inv: InvitationView }) {
    const wrap: React.CSSProperties = {
      display: "flex",
      gap: 6,
      justifyContent: "flex-end",
      flexWrap: "wrap",
    };
    if (inv.status === "bounced") {
      return (
        <span role="cell" style={wrap}>
          <Button variant="pri" className="gov-sm" disabled={busyId === inv.id} onClick={() => fixAddress(inv)}>
            Fix address
          </Button>
        </span>
      );
    }
    if (inv.status === "open") {
      return (
        <span role="cell" style={wrap}>
          <Button className="gov-sm" disabled={busyId === inv.id} onClick={() => resend(inv)}>
            Resend
          </Button>
          <Button className="gov-sm" disabled={busyId === inv.id} onClick={() => revoke(inv)}>
            Revoke
          </Button>
        </span>
      );
    }
    if (inv.status === "expired" || inv.status === "revoked") {
      return (
        <span role="cell" style={wrap}>
          <Button className="gov-sm" disabled={busyId === inv.id} onClick={() => inviteAgain(inv)}>
            Invite again
          </Button>
        </span>
      );
    }
    return <span role="cell" />;
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 340px",
        gap: 20,
        alignItems: "start",
      }}
      className="gov-inv-cols"
    >
      <section className="card" style={{ minWidth: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 22px" }}>
          <div role="tablist" aria-label="Invitation status" className="gov-seg2">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
              >
                {t.label} {t.count}
              </button>
            ))}
          </div>
        </div>

        <div className="rows-scroll">
          <div
            role="table"
            className="tbl-stack"
            aria-label={`${tabs.find((t) => t.key === tab)?.label} invitations`}
            style={{ minWidth: 760 }}
          >
            <div role="row" className="gov-ir head">
              <span role="columnheader">Invited</span>
              <span role="columnheader">Role</span>
              <span role="columnheader">Team · sent by</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">
                <span className="sr-only">Actions</span>
              </span>
            </div>
            {rows.map((inv) => (
              <div
                role="row"
                className={`gov-ir${inv.status === "bounced" ? " bounced" : ""}`}
                key={inv.id}
              >
                <span role="cell" style={{ minWidth: 0 }}>
                  <b style={{ fontWeight: 600 }}>{inv.name}</b>
                  <small>{inv.email}</small>
                </span>
                <span role="cell">
                  <span className="ro dashed">{inv.roleName}</span>
                </span>
                <span role="cell">
                  {inv.teamName}
                  <small>
                    {inv.inviterName} · {inv.sent}
                  </small>
                </span>
                <StatusCell inv={inv} />
                <ActionsCell inv={inv} />
              </div>
            ))}
            {rows.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  padding: "16px 22px",
                  fontSize: 13,
                  color: "var(--muted)",
                }}
              >
                No invitations in this tab.
              </p>
            ) : null}
          </div>
        </div>
        {tab === "open" ? (
          <p className="gov-invite-note">
            Resending makes a new link and cancels the old one. Revoking can’t
            be undone; you’d send a new invitation.
          </p>
        ) : null}
      </section>

      <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {note ? (
          <p
            className="card"
            style={{ padding: "12px 14px", fontSize: 13, margin: 0, wordBreak: "break-all" }}
            role="status"
          >
            {note}
          </p>
        ) : null}
        <InviteForm roles={roles} teams={teams} onInvite={addInvite} />
      </aside>
    </div>
  );
}
