"use client";

import { useState } from "react";
import type { ImportRow } from "@/lib/types";

const CR_GRID = "44px minmax(0,1.3fr) minmax(0,1fr) 170px minmax(0,1.4fr)";

function crStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: CR_GRID,
    gap: 14,
    alignItems: "center",
    padding: "11px 24px",
    borderTop: "1px solid var(--rule)",
    fontSize: 13,
    ...extra,
  };
}

const smallText: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "var(--muted)",
  marginTop: 2,
};

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
    <div role="table" aria-label="Rows that need a decision" style={{ minWidth: 760 }}>
      <div
        role="row"
        style={crStyle({
          paddingTop: 8,
          paddingBottom: 8,
          fontSize: 12,
          color: "var(--muted)",
          borderTop: "1px solid var(--rule-strong)",
        })}
      >
        <span role="columnheader">Row</span>
        <span role="columnheader">Person</span>
        <span role="columnheader">Problem</span>
        <span role="columnheader">Fix</span>
        <span role="columnheader">Result</span>
      </div>

      {rows.map((r) => {
        if (r.status === "skipped") {
          return (
            <div role="row" key={r.row} style={crStyle({ background: "var(--sheet-sunk)" })}>
              <span role="cell" className="mono" style={{ color: "var(--muted)" }}>
                {r.row}
              </span>
              <span role="cell">
                <b style={{ fontWeight: 600, color: "var(--ink-2)" }}>{r.name}</b>
                <small style={smallText}>{r.email}</small>
              </span>
              <span role="cell" style={{ color: "var(--ink-2)", fontWeight: 600 }}>
                Already a member
              </span>
              <span role="cell" style={{ color: "var(--muted)" }}>
                Skipped
              </span>
              <span role="cell" style={{ color: "var(--ink-2)" }}>
                Member <span className="mono">012</span>. His role and teams
                stay as they are.
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
          <div role="row" key={r.row} style={crStyle()}>
            <span role="cell" className="mono" style={{ color: "var(--muted)" }}>
              {r.row}
            </span>
            <span role="cell">
              <b style={{ fontWeight: 600 }}>{r.name}</b>
              <small style={smallText}>{r.email}</small>
            </span>
            <span role="cell" style={{ color: "var(--deny)", fontWeight: 600 }}>
              {isPersonal ? "Personal email" : r.issue}
            </span>
            <span role="cell">
              <label htmlFor={`f${r.row}`} className="sr-only">
                {isPersonal ? `Fix for row ${r.row}` : `Role for row ${r.row}`}
              </label>
              <select
                id={`f${r.row}`}
                className="in"
                style={{ height: 34, width: "100%", fontSize: 13 }}
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
              style={{ color: result.resolved ? "var(--ink-2)" : "var(--muted)" }}
            >
              {result.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}
