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
 * role allows (roleAllows, computed on the server from the fixtures).
 * On submit the invitation is handed to the page (onInvite), which adds
 * it to the Open tab — the design has no success sentence here.
 */
export function InviteForm({
  roles,
  teams,
  onInvite,
}: {
  roles: InviteRoleOption[];
  teams: InviteTeamOption[];
  onInvite?: (data: { email: string; roleId: string; teamId: string }) => void;
}) {
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "member");
  const role = roles.find((r) => r.id === roleId) ?? roles[0];

  return (
    <form
      className="sheet"
      aria-labelledby="ni"
      style={{
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        onInvite?.({
          email: String(data.get("email") ?? ""),
          roleId,
          teamId: String(data.get("team") ?? teams[0]?.id ?? ""),
        });
        form.reset();
        setRoleId(roles[0]?.id ?? "member");
      }}
    >
      <h2 id="ni" className="panel" style={{ margin: 0 }}>
        Invite someone
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label htmlFor="em" style={{ fontSize: 13, fontWeight: 600 }}>
          Work email
        </label>
        <input
          id="em"
          name="email"
          className="in h38"
          type="email"
          required
          placeholder="name@sevynlabs.io"
          style={{ width: "100%" }}
        />
        <span className="caption">Other domains join as Guest.</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label htmlFor="rl" style={{ fontSize: 13, fontWeight: 600 }}>
          Role
        </label>
        <select
          id="rl"
          name="role"
          className="in h38"
          style={{ width: "100%" }}
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
        >
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <span className="caption">
          {role ? `${role.name} allows ${role.allows} of 18 permissions. ` : ""}
          <Link href="/app/roles">Compare roles</Link>
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label htmlFor="tm" style={{ fontSize: 13, fontWeight: 600 }}>
          Team
        </label>
        <select id="tm" name="team" className="in h38" style={{ width: "100%" }}>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label htmlFor="ms" style={{ fontSize: 13, fontWeight: 600 }}>
          Note{" "}
          <span style={{ fontWeight: 400, color: "var(--muted)" }}>optional</span>
        </label>
        <textarea
          id="ms"
          name="note"
          className="in"
          style={{ height: 64, padding: "8px 12px", lineHeight: 1.45, resize: "vertical" }}
        />
      </div>

      <Button type="submit" variant="pri">
        Send invitation
      </Button>
      <span style={{ fontSize: 12, lineHeight: 1.45, color: "var(--muted)" }}>
        Links expire after 7 days. The invitation and its acceptance are both
        written to the audit log.
      </span>
    </form>
  );
}
