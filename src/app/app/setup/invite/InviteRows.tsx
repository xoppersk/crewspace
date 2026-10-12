"use client";

import { useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/Button";

interface Row {
  key: number;
  email: string;
  role: string;
  team: string;
}

const rowGrid = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.6fr) 190px 190px 36px",
  gap: 12,
  alignItems: "center",
  padding: "10px 24px",
  borderTop: "1px solid var(--rule)",
} as const;

/**
 * F-05 invitation rows as one live state: Remove deletes a row,
 * "Add another" appends an editable blank row, and the heading count
 * and Send label both derive from the current rows.
 */
export function InviteRows({ initialEmails }: { initialEmails: string[] }) {
  const nextKey = useRef(initialEmails.length);
  const [rows, setRows] = useState<Row[]>(() =>
    initialEmails.map((email, i) => ({
      key: i,
      email,
      role: "Member",
      team: "No team yet",
    })),
  );

  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const remove = (key: number) =>
    setRows((rs) => rs.filter((r) => r.key !== key));
  const add = () =>
    setRows((rs) => [
      ...rs,
      { key: nextKey.current++, email: "", role: "Member", team: "No team yet" },
    ]);

  return (
    <>
      <section className="sheet" aria-labelledby="iv">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 8,
            padding: "16px 24px 10px",
          }}
        >
          <h2 id="iv" className="section">
            First invitations · {rows.length}
          </h2>
          <a href="/app/invitations/import" style={{ fontSize: 13 }}>
            Import a CSV instead
          </a>
        </div>
        <div className="rows-scroll">
          <div
            role="table"
            aria-label="Invitations to send"
            style={{ minWidth: 640 }}
          >
            <div
              role="row"
              style={{
                ...rowGrid,
                paddingTop: 6,
                paddingBottom: 6,
                fontSize: 12,
                color: "var(--muted)",
                borderTopColor: "var(--rule-strong)",
              }}
            >
              <span role="columnheader">Work email</span>
              <span role="columnheader">Role</span>
              <span role="columnheader">Team</span>
              <span role="columnheader" />
            </div>
            {rows.map((row, i) => (
              <div role="row" key={row.key} style={rowGrid}>
                <span role="cell">
                  <label htmlFor={`e${i + 1}`} className="sr-only">
                    Email {i + 1}
                  </label>
                  <input
                    id={`e${i + 1}`}
                    className="in"
                    value={row.email}
                    onChange={(e) => update(row.key, { email: e.target.value })}
                    style={{ width: "100%", height: 38 }}
                  />
                </span>
                <span role="cell">
                  <label htmlFor={`r${i + 1}`} className="sr-only">
                    Role {i + 1}
                  </label>
                  <select
                    id={`r${i + 1}`}
                    className="in"
                    style={{ width: "100%", height: 38 }}
                    value={row.role}
                    onChange={(e) => update(row.key, { role: e.target.value })}
                  >
                    <option>Member</option>
                    <option>Guest</option>
                  </select>
                </span>
                <span role="cell">
                  <label htmlFor={`t${i + 1}`} className="sr-only">
                    Team {i + 1}
                  </label>
                  <select
                    id={`t${i + 1}`}
                    className="in"
                    style={{ width: "100%", height: 38 }}
                    value={row.team}
                    onChange={(e) => update(row.key, { team: e.target.value })}
                  >
                    <option>No team yet</option>
                  </select>
                </span>
                <span role="cell">
                  <button
                    type="button"
                    className="mx"
                    aria-label={`Remove row ${i + 1}`}
                    onClick={() => remove(row.key)}
                  >
                    ×
                  </button>
                </span>
              </div>
            ))}
            <div
              style={{
                padding: "10px 24px 16px",
                borderTop: "1px solid var(--rule)",
              }}
            >
              <Button
                type="button"
                style={{ height: 34, fontSize: 13 }}
                onClick={add}
              >
                Add another
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
        }}
      >
        <ButtonLink size="h40" href="/signup">
          Back
        </ButtonLink>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <ButtonLink size="h40" href="/app">
            Skip for now
          </ButtonLink>
          <ButtonLink variant="pri" size="h40" href="/app/roles">
            Send {rows.length} invitations
          </ButtonLink>
        </div>
      </div>
    </>
  );
}
