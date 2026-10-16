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

/**
 * The result a fix choice produces, in the screen's own constructions:
 * the two designed defaults verbatim ("Joins as Guest: sees only …",
 * "Not sent until a role is chosen."), the parallel "Not sent until …"
 * for the work-email fix, and "Joins as <role>." for a chosen role.
 */
function resultFor(row: ImportRow, choice: string): { text: string; resolved: boolean } {
  const isPersonal = /personal/i.test(row.issue ?? "");
  if (isPersonal) {
    switch (choice) {
      case "Use a work email":
        return { text: "Not sent until a work email is given.", resolved: false };
      case "Leave out":
        return { text: "Left out: not sent.", resolved: false };
      case "Invite as Guest":
      default:
        return {
          text: `Joins as Guest: sees only ${row.team}, not the directory.`,
          resolved: true,
        };
    }
  }
  if (choice === "Choose a role") {
    return { text: "Not sent until a role is chosen.", resolved: false };
  }
  return { text: `Joins as ${choice}.`, resolved: true };
}

/**
 * G-02 decision rows. The fix selects are live: changing one updates its
 * Result cell (and its colour — muted while nothing will be sent).
 * Rows arrive in the screen's order: fix rows first, the skipped row last.
 */
export function DecisionRows({ rows }: { rows: ImportRow[] }) {
  const [choices, setChoices] = useState<Record<number, string>>({});

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
                Already a member
              </span>
              <span role="cell">
                <span className="gov-chip quiet">Skipped</span>
              </span>
              <span role="cell" style={{ color: "var(--ink-2)", lineHeight: 1.45 }}>
                Member <span className="mono">012</span>. His role and teams stay
                as they are.
              </span>
            </div>
          );
        }
        const isPersonal = /personal/i.test(r.issue ?? "");
        const options = isPersonal
          ? ["Invite as Guest", "Use a work email", "Leave out"]
          : ["Choose a role", "Member", "Support lead", "Product admin"];
        const choice = choices[r.row] ?? options[0]!;
        const result = resultFor(r, choice);
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
              {isPersonal ? "Personal email" : r.issue}
            </span>
            <span role="cell">
              <label htmlFor={`f${r.row}`} className="sr-only">
                {isPersonal ? `Fix for row ${r.row}` : `Role for row ${r.row}`}
              </label>
              <select
                id={`f${r.row}`}
                className="in"
                value={choice}
                onChange={(e) =>
                  setChoices((c) => ({ ...c, [r.row]: e.target.value }))
                }
              >
                {options.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </span>
            <span
              role="cell"
              style={{
                color: result.resolved ? "var(--ink-2)" : "var(--muted)",
                lineHeight: 1.45,
              }}
            >
              {result.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}
