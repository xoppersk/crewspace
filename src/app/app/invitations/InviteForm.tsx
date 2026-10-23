"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/Button";

export interface InviteRoleOption {
  id: string;
  name: string;
  allows: number;
}
export interface InviteTeamOption {
  id: string;
  name: string;
}

/**
 * G-01 invite form. The role field always says how much the selected
 * role allows (roleAllows, computed on the server from real data).
 * On submit the invitation is created by a server action; the fresh
 * invite link is shown so the inviter can share it (email delivery
 * runs through the send-invitation Edge Function when configured).
 */
export function InviteForm({
  roles,
  teams,
  onInvite,
}: {
  roles: InviteRoleOption[];
  teams: InviteTeamOption[];
  onInvite?: (data: {
    email: string;
    roleId: string;
    teamId: string;
    message?: string;
  }) => Promise<{ ok: boolean; error?: string; invitePath?: string }>;
}) {
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "member");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const role = roles.find((r) => r.id === roleId) ?? roles[0];

  return (
    <form
      className="card"
      aria-labelledby="ni"
      style={{
        padding: "20px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        setBusy(true);
        setNote(null);
        const res = await onInvite?.({
          email: String(data.get("email") ?? ""),
          roleId,
          teamId: String(data.get("team") ?? teams[0]?.id ?? ""),
          message: String(data.get("note") ?? "") || undefined,
        });
        setBusy(false);
        if (res && !res.ok) {
          setNote(res.error ?? "That invitation didn't send.");
          return;
        }
        if (res?.invitePath) {
          setNote(`Invitation created. Link: ${window.location.origin}${res.invitePath}`);
        }
        form.reset();
        setRoleId(roles[0]?.id ?? "member");
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="gov-ico" aria-hidden="true">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
            <path d="m2.5 4.5 5.5 4 5.5-4" />
          </svg>
        </span>
        <h2 id="ni" style={{ margin: 0, font: "700 17px/1.2 var(--font-sans)" }}>
          Invite someone
        </h2>
      </div>

      <div className="gov-f">
        <label htmlFor="em">Work email</label>
        <input
          id="em"
          name="email"
          className="in"
          type="email"
          required
          placeholder="name@company.com"
        />
        <span className="hint">They join with the role you pick below.</span>
      </div>

      <div className="gov-f">
        <label htmlFor="rl">Role</label>
        <select
          id="rl"
          name="role"
          className="in"
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
        >
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <span className="hint">
          {role ? `${role.name} allows ${role.allows} of 18 permissions. ` : ""}
          <Link href="/app/roles">Compare roles</Link>
        </span>
      </div>

      <div className="gov-f">
        <label htmlFor="tm">Team</label>
        <select id="tm" name="team" className="in">
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div className="gov-f">
        <label htmlFor="ms">
          Note{" "}
          <span style={{ fontWeight: 400, color: "var(--muted)" }}>optional</span>
        </label>
        <textarea
          id="ms"
          name="note"
          className="in"
          style={{
            height: 72,
            padding: "9px 12px",
            lineHeight: 1.45,
            resize: "vertical",
          }}
        />
      </div>

      <Button type="submit" variant="pri" size="h40" disabled={busy}>
        Send invitation
      </Button>
      {note ? (
        <span style={{ fontSize: 12.5, lineHeight: 1.45, color: "var(--ink-2)", wordBreak: "break-all" }}>
          {note}
        </span>
      ) : null}
      <span style={{ fontSize: 12, lineHeight: 1.45, color: "var(--muted)" }}>
        Links expire after 7 days. The invitation and its acceptance are both
        written to the audit log.
      </span>
    </form>
  );
}
