"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { importInvitations } from "@/lib/data/actions";
import { Button, ButtonLink } from "@/components/Button";

interface Row {
  key: number;
  email: string;
  roleId: string;
  teamId: string;
}

export interface InviteOption {
  id: string;
  name: string;
}

const AVATAR_TINTS = ["#dce3f4", "#e9e3d6", "#ddebe2"];

function initialsOfEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  return local
    .split(".")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * F-05 invitation rows as one live state: Remove deletes a row,
 * "Add another" appends an editable blank row, and the heading count
 * and Send label both derive from the current rows. Roles are limited
 * to Member or Guest, as the screen draws them. Send creates real
 * invitation rows via importInvitations, then continues to step 3
 * (Check roles).
 */
export function InviteRows({
  roles,
  teams,
}: {
  roles: InviteOption[];
  teams: InviteOption[];
}) {
  const router = useRouter();
  const nextKey = useRef(3);
  const [rows, setRows] = useState<Row[]>(() =>
    [0, 1, 2].map((i) => ({
      key: i,
      email: "",
      roleId: roles[0]?.id ?? "member",
      teamId: "",
    })),
  );
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const remove = (key: number) =>
    setRows((rs) => rs.filter((r) => r.key !== key));
  const add = () =>
    setRows((rs) => [
      ...rs,
      {
        key: nextKey.current++,
        email: "",
        roleId: roles[0]?.id ?? "member",
        teamId: "",
      },
    ]);

  const filled = rows.filter((r) => r.email.trim() !== "");

  async function send() {
    setBusy(true);
    setNote(null);
    const res = await importInvitations(
      filled.map((r) => ({
        email: r.email.trim(),
        roleId: r.roleId,
        teamId: r.teamId || undefined,
      })),
    );
    setBusy(false);
    if (!res.ok) {
      setNote(res.error);
      return;
    }
    if ((res.created ?? 0) === 0 && filled.length > 0) {
      setNote("Those addresses are already members or already invited.");
      return;
    }
    router.push("/app/roles");
  }

  return (
    <>
      <section
        className="sheet"
        aria-labelledby="iv"
        style={{ overflow: "hidden" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 8,
            padding: "18px 22px",
          }}
        >
          <h2
            id="iv"
            className="section"
            style={{ fontWeight: 700 }}
          >
            First invitations · {rows.length}
          </h2>
          <a
            href="/app/invitations/import"
            style={{ fontSize: 13, fontWeight: 600 }}
          >
            Import a CSV instead
          </a>
        </div>
        <div className="rows-scroll">
          <div
            role="table"
            aria-label="Invitations to send"
            style={{ minWidth: 640 }}
          >
            <div role="row" className="fir-head">
              <span role="columnheader">Work email</span>
              <span role="columnheader">Role</span>
              <span role="columnheader">Team</span>
              <span role="columnheader" />
            </div>
            {rows.map((row, i) => (
              <div role="row" key={row.key} className="fir">
                <span role="cell" className="emcell">
                  <span
                    className="rav"
                    aria-hidden="true"
                    style={{
                      background:
                        AVATAR_TINTS[row.key % AVATAR_TINTS.length],
                    }}
                  >
                    {initialsOfEmail(row.email)}
                  </span>
                  <label htmlFor={`e${i + 1}`} className="sr-only">
                    Email {i + 1}
                  </label>
                  <input
                    id={`e${i + 1}`}
                    className="in"
                    value={row.email}
                    onChange={(e) => update(row.key, { email: e.target.value })}
                  />
                </span>
                <span role="cell">
                  <label htmlFor={`r${i + 1}`} className="sr-only">
                    Role {i + 1}
                  </label>
                  <select
                    id={`r${i + 1}`}
                    className="in"
                    value={row.roleId}
                    onChange={(e) => update(row.key, { roleId: e.target.value })}
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </span>
                <span role="cell">
                  <label htmlFor={`t${i + 1}`} className="sr-only">
                    Team {i + 1}
                  </label>
                  <select
                    id={`t${i + 1}`}
                    className="in"
                    value={row.teamId}
                    onChange={(e) => update(row.key, { teamId: e.target.value })}
                  >
                    <option value="">No team yet</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </span>
                <span role="cell">
                  <button
                    type="button"
                    className="mx"
                    aria-label={`Remove row ${i + 1}`}
                    onClick={() => remove(row.key)}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      aria-hidden="true"
                    >
                      <path d="m4 4 8 8M12 4l-8 8" />
                    </svg>
                  </button>
                </span>
              </div>
            ))}
            <div
              style={{
                padding: "12px 22px 16px",
                borderTop: "1px solid var(--rule)",
              }}
            >
              <Button
                type="button"
                style={{ height: 34, fontSize: 13 }}
                onClick={add}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M8 3v10M3 8h10" />
                </svg>
                Add another
              </Button>
            </div>
          </div>
        </div>
      </section>

      {note ? (
        <p role="status" style={{ fontSize: 13.5, margin: 0 }}>
          {note}
        </p>
      ) : null}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
        }}
      >
        <ButtonLink size="h40" href="/signup" style={{ fontSize: 14 }}>
          Back
        </ButtonLink>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <ButtonLink
            size="h40"
            href="/app"
            style={{
              fontSize: 14,
              borderColor: "transparent",
              background: "transparent",
            }}
          >
            Skip for now
          </ButtonLink>
          <Button
            variant="pri"
            size="h40"
            disabled={busy || filled.length === 0}
            onClick={() => void send()}
            style={{ fontSize: 14 }}
          >
            Send {filled.length} invitation{filled.length === 1 ? "" : "s"}
          </Button>
        </div>
      </div>
    </>
  );
}
