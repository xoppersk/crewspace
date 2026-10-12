"use client";

import { useState } from "react";
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

/* Canon "today" is Tuesday, October 6, 2026 (§9); a re-issued or new
   invitation is sent today and expires 7 days later (§10). */
const RESENT = { sent: "Oct 6", expires: "Oct 13" };

const GRID = "minmax(0,1.4fr) 140px minmax(0,1fr) minmax(0,1.2fr) 150px";

function rowStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: GRID,
    gap: 16,
    alignItems: "center",
    padding: "13px 24px",
    borderTop: "1px solid var(--rule)",
    fontSize: 14,
    ...extra,
  };
}

const smallBtn: React.CSSProperties = { height: 30, padding: "0 10px", fontSize: 12 };

const smallText: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "var(--muted)",
  marginTop: 2,
  lineHeight: 1.4,
};

function StatusCell({ inv }: { inv: InvitationView }) {
  if (inv.status === "bounced") {
    return (
      <span role="cell">
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--deny)" }}>
          Didn’t arrive
        </span>
        <small style={smallText}>
          Mail server says the address doesn’t exist. Maybe “lea.kim”?
        </small>
      </span>
    );
  }
  if (inv.status === "open" && inv.openedAt) {
    return (
      <span role="cell">
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pending)" }}>
          Opened, not accepted
        </span>
        <small style={smallText}>
          Opened {inv.openedAt} · expires {inv.expires}
        </small>
      </span>
    );
  }
  if (inv.status === "open") {
    return (
      <span role="cell">
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>
          Delivered, not opened
        </span>
        <small style={smallText}>Expires {inv.expires}</small>
      </span>
    );
  }
  if (inv.status === "accepted") {
    return (
      <span role="cell">
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--active)" }}>
          Accepted
        </span>
        <small style={smallText}>
          {inv.acceptedOn ? `Accepted ${inv.acceptedOn}` : "Accepted"} · sent {inv.sent}
        </small>
      </span>
    );
  }
  if (inv.status === "expired") {
    return (
      <span role="cell">
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>
          Expired
        </span>
        <small style={smallText}>
          Expired {inv.expires} · sent {inv.sent}
        </small>
      </span>
    );
  }
  return (
    <span role="cell">
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>
        Revoked
      </span>
      <small style={smallText}>Sent {inv.sent} · the link no longer works</small>
    </span>
  );
}

/**
 * G-01 invitations register with §10 behaviour wired up client-side:
 * Resend re-issues the invitation (new link, old one cancelled — the row
 * shows the new sent/expiry), Revoke moves the row to the Revoked tab,
 * Fix address applies the suggested address and clears the bounce, and
 * the invite form adds its invitation straight into the Open tab.
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
  const [invitations, setInvitations] = useState(initialInvitations);
  const [tab, setTab] = useState<TabKey>(initialTab);

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
    /* Screen order: the bounced invitation first, then opened, then unopened. */
    const open = invitations.filter(
      (i) => i.status === "open" || i.status === "bounced",
    );
    rows = [
      ...open.filter((i) => i.status === "bounced"),
      ...open.filter((i) => i.status === "open" && i.openedAt),
      ...open.filter((i) => i.status === "open" && !i.openedAt),
    ];
  } else {
    rows = invitations.filter((i) => i.status === tab);
  }

  function update(id: string, patch: Partial<InvitationView>) {
    setInvitations((list) =>
      list.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    );
  }

  function resend(inv: InvitationView) {
    update(inv.id, { status: "open", openedAt: null, ...RESENT });
  }
  function revoke(inv: InvitationView) {
    update(inv.id, { status: "revoked" });
  }
  function fixAddress(inv: InvitationView) {
    update(inv.id, {
      email: inv.suggestedEmail ?? inv.email,
      status: "open",
      openedAt: null,
      ...RESENT,
    });
  }
  function inviteAgain(inv: InvitationView) {
    update(inv.id, { status: "open", openedAt: null, ...RESENT });
    setTab("open");
  }
  function addInvite(data: { email: string; roleId: string; teamId: string }) {
    const role = roles.find((r) => r.id === data.roleId);
    const team = teams.find((t) => t.id === data.teamId);
    const local = data.email.split("@")[0] ?? "";
    const name =
      local
        .split(/[._-]+/)
        .filter(Boolean)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ") || data.email;
    setInvitations((list) => [
      ...list,
      {
        id: `inv-new-${list.length}-${data.email}`,
        name,
        email: data.email,
        roleId: data.roleId,
        roleName: role?.name ?? "",
        teamId: data.teamId,
        teamName: team?.name ?? "",
        inviterName: "Sheku Koroma",
        status: "open",
        openedAt: null,
        ...RESENT,
      },
    ]);
    setTab("open");
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
          <Button variant="pri" style={smallBtn} onClick={() => fixAddress(inv)}>
            Fix address
          </Button>
        </span>
      );
    }
    if (inv.status === "open") {
      return (
        <span role="cell" style={wrap}>
          <Button style={smallBtn} onClick={() => resend(inv)}>
            Resend
          </Button>
          <Button style={smallBtn} onClick={() => revoke(inv)}>
            Revoke
          </Button>
        </span>
      );
    }
    if (inv.status === "expired" || inv.status === "revoked") {
      return (
        <span role="cell" style={wrap}>
          <Button style={smallBtn} onClick={() => inviteAgain(inv)}>
            Invite again
          </Button>
        </span>
      );
    }
    return <span role="cell" />;
  }

  return (
    <div className="cols">
      <section className="sheet main-sheet" style={{ overflow: "hidden" }}>
        <div
          role="tablist"
          aria-label="Invitation status"
          className="tabs"
          style={{ padding: "14px 24px", gap: 6 }}
        >
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className="tab"
              onClick={() => setTab(t.key)}
              style={
                tab === t.key
                  ? undefined
                  : { border: "1px solid var(--frame)", background: "var(--sheet)" }
              }
            >
              {t.label} {t.count}
            </button>
          ))}
        </div>

        <div className="rows-scroll">
          <div
            role="table"
            aria-label={`${tabs.find((t) => t.key === tab)?.label} invitations`}
            style={{ minWidth: 760 }}
          >
            <div
              role="row"
              style={rowStyle({
                paddingTop: 8,
                paddingBottom: 8,
                fontSize: 12,
                color: "var(--muted)",
                borderTop: "1px solid var(--rule-strong)",
              })}
            >
              <span role="columnheader">Invited</span>
              <span role="columnheader">Role</span>
              <span role="columnheader">Team · sent by</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">
                <span className="sr-only">Actions</span>
              </span>
            </div>
            {rows.map((inv) => (
              <div role="row" style={rowStyle()} key={inv.id}>
                <span role="cell">
                  <b style={{ fontWeight: 600 }}>{inv.name}</b>
                  <small style={smallText}>{inv.email}</small>
                </span>
                <span role="cell">
                  <span className="ro dashed">{inv.roleName}</span>
                </span>
                <span role="cell">
                  {inv.teamName}
                  <small style={smallText}>
                    {inv.inviterName} · {inv.sent}
                  </small>
                </span>
                <StatusCell inv={inv} />
                <ActionsCell inv={inv} />
              </div>
            ))}
            {rows.length === 0 ? (
              <p style={{ margin: 0, padding: "16px 24px", fontSize: 13, color: "var(--muted)" }}>
                No invitations in this tab.
              </p>
            ) : null}
          </div>
        </div>
        {tab === "open" ? (
          <p
            style={{
              margin: 0,
              padding: "12px 24px 14px",
              borderTop: "1px solid var(--rule-strong)",
              fontSize: 12,
              color: "var(--muted)",
            }}
          >
            Resending makes a new link and cancels the old one. Revoking
            can’t be undone; you’d send a new invitation.
          </p>
        ) : null}
      </section>

      <aside className="side-col">
        <InviteForm roles={roles} teams={teams} onInvite={addInvite} />
      </aside>
    </div>
  );
}
