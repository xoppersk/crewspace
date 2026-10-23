"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setMemberActive, updateMemberRole } from "@/lib/data/actions";
import { Button } from "@/components/Button";

/**
 * Real member actions on the member record: change role and
 * deactivate/reactivate. Both go through server actions that re-check
 * the actor's permission (members:change_role / members:deactivate)
 * before writing and append an audit entry.
 */
export function MemberActions({
  memberId,
  firstName,
  status,
  currentRoleId,
  roles,
  canChangeRole,
  canDeactivate,
}: {
  memberId: string;
  firstName: string;
  status: "active" | "deactivated";
  currentRoleId: string;
  roles: { id: string; name: string }[];
  canChangeRole: boolean;
  canDeactivate: boolean;
}) {
  const router = useRouter();
  const [roleId, setRoleId] = useState(currentRoleId);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setNote(null);
    const res = await fn();
    setBusy(false);
    if (res.ok) {
      setNote("Saved.");
      router.refresh();
    } else {
      setNote(res.error ?? "That didn't work.");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <label htmlFor="ma-role" style={{ fontSize: 13, fontWeight: 600 }}>
          Role
        </label>
        <select
          id="ma-role"
          className="in"
          style={{ height: 38 }}
          value={roleId}
          disabled={!canChangeRole || busy}
          onChange={(e) => setRoleId(e.target.value)}
        >
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <Button
          disabled={!canChangeRole || busy || roleId === currentRoleId}
          onClick={() => run(() => updateMemberRole(memberId, roleId))}
        >
          Change role
        </Button>
        {status === "active" ? (
          <Button
            variant="dest"
            disabled={!canDeactivate || busy}
            onClick={() => run(() => setMemberActive(memberId, false))}
          >
            Deactivate {firstName}
          </Button>
        ) : (
          <Button
            disabled={!canDeactivate || busy}
            onClick={() => run(() => setMemberActive(memberId, true))}
          >
            Reactivate {firstName}
          </Button>
        )}
      </div>
      {!canChangeRole && !canDeactivate ? (
        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
          You can view this record; changing roles or deactivating needs a
          permission you don’t have.
        </span>
      ) : null}
      {note ? (
        <span style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{note}</span>
      ) : null}
    </div>
  );
}
