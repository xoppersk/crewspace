"use client";

import { useState } from "react";
import type { ImportRow } from "@/lib/types";

function WarnIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
      style={{ flex: "none" }}
    >
      <path d="M8 2.2 14.2 13H1.8z" />
      <path d="M8 6.5v3M8 11.2v.1" />
    </svg>
  );
}

export interface RowResolution {
  send: boolean;
  /** Role name to invite with when sending (may differ from the CSV). */
  roleName: string;
}

/**
 * G-02 decision rows for the real CSV check: every fix row offers the
 * choices that resolve it (invite as Guest / pick a real role / leave
 * out), and each choice is reported up via onResolve so the Send step
 * knows exactly which rows go out and as what. Skipped rows (already a
 * member or already invited) are informational.
 */
export function DecisionRows({
  rows,
  roleNames,
  guestRoleName,
  onResolve,
}: {
  rows: ImportRow[];
  roleNames: string[];
  guestRoleName?: string;
  onResolve: (row: number, resolution: RowResolution) => void;
}) {
  const [choices, setChoices] = useState<Record<number, string>>({});

  const apply = (row: ImportRow, choice: string) => {
    setChoices((c) => ({ ...c, [row.row]: choice }));
    if (choice === "Leave out") {
      onResolve(row.row, { send: false, roleName: row.role });
    } else if (choice === "Invite as Guest") {
      onResolve(row.row, {
        send: true,
        roleName: guestRoleName ?? row.role,
      });
    } else {
      // A role name chosen from the list.
      onResolve(row.row, { send: true, roleName: choice });
    }
  };

  return (
    <div role="table" className="tbl-stack" aria-label="Rows that need a decision" style={{ minWidth: 760 }}>
      <div role="row" className="gov-cr head">
        <span role="columnheader">Row</span>
        <span role="columnheader">Person</span>
        <span role="columnheader">Problem</span>
        <span role="columnheader">Fix</span>
        <span role="columnheader">Result</span>
      </div>

      {rows.map((r) => {
        if (r.status === "skipped") {
          return (
            <div role="row" key={r.row} className="gov-cr skipped">
              <span role="cell" className="rg">
                {r.row}
              </span>
              <span role="cell">
                <b style={{ fontWeight: 600, fontSize: 14, color: "var(--ink-2)" }}>
                  {r.name}
                </b>
                <small>{r.email}</small>
              </span>
              <span role="cell" style={{ color: "var(--ink-2)", fontWeight: 600 }}>
                {r.issue ?? "Already a member"}
              </span>
              <span role="cell">
                <span className="gov-chip quiet">Skipped</span>
              </span>
              <span role="cell" style={{ color: "var(--ink-2)", lineHeight: 1.45 }}>
                {r.fix ?? "Their role and teams stay as they are."}
              </span>
            </div>
          );
        }
        const isPersonal = /personal/i.test(r.issue ?? "");
        const options = isPersonal
          ? [
              ...(guestRoleName ? ["Invite as Guest"] : []),
              "Leave out",
            ]
          : ["Choose a role", ...roleNames];
        const choice = choices[r.row] ?? options[0]!;
        const resultText =
          choice === "Leave out"
            ? "Left out: not sent."
            : choice === "Invite as Guest"
              ? `Joins as ${guestRoleName ?? "Guest"}: sees only ${r.team || "their team"}, not the directory.`
              : choice === "Choose a role"
                ? "Not sent until a role is chosen."
                : `Joins as ${choice}.`;
        const resolved =
          choice === "Invite as Guest" ||
          (choice !== "Leave out" && choice !== "Choose a role");
        return (
          <div role="row" key={r.row} className="gov-cr">
            <span role="cell" className="rg">
              {r.row}
            </span>
            <span role="cell">
              <b style={{ fontWeight: 600, fontSize: 14 }}>{r.name}</b>
              <small>{r.email}</small>
            </span>
            <span
              role="cell"
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                color: "var(--deny)",
                fontWeight: 600,
              }}
            >
              <WarnIcon />
              {r.issue}
            </span>
            <span role="cell">
              <label htmlFor={`f${r.row}`} className="sr-only">
                Fix for row {r.row}
              </label>
              <select
                id={`f${r.row}`}
                className="in"
                value={choice}
                onChange={(e) => apply(r, e.target.value)}
              >
                {options.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </span>
            <span
              role="cell"
              style={{
                color: resolved ? "var(--ink-2)" : "var(--muted)",
                lineHeight: 1.45,
              }}
            >
              {resultText}
            </span>
          </div>
        );
      })}
    </div>
  );
}
