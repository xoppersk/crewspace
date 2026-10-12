"use client";

import { settingResult } from "@/lib/api";
import type { Permission, Setting } from "@/lib/types";

const CHOICES: { value: Setting; label: string; cls: string }[] = [
  { value: "allow", label: "Allow", cls: "a" },
  { value: "deny", label: "Deny", cls: "d" },
  { value: "inherit", label: "Inherit", cls: "i" },
];

export function settingLabel(s: Setting): string {
  return s === "allow"
    ? "Allow"
    : s === "deny"
      ? "Deny"
      : s === "inherit"
        ? "Inherit"
        : "Owner only";
}

/**
 * The signature component: one permission, the Allow / Deny / Inherit
 * choice, and the Result the choice produces.
 */
export function PermissionRow({
  permission,
  setting,
  changedFrom,
  resultNote,
  disabledReason,
  onChange,
}: {
  permission: Permission;
  setting: Setting;
  /** When set, the row shows "Changed · was X" on the sheet-tint ground. */
  changedFrom?: Setting | null;
  resultNote?: string;
  /** Offline / not permitted: control disabled with this reason as a tooltip. */
  disabledReason?: string;
  onChange?: (next: Setting) => void;
}) {
  const result = settingResult(setting, permission.id);
  const note =
    resultNote ??
    (setting === "inherit" ? "from baseline" : undefined);
  return (
    <div role="row" className={`pr${changedFrom ? " chg" : ""}`}>
      <span role="cell">
        <b>{permission.name}</b>
        <small>{permission.description}</small>
        {changedFrom ? (
          <span className="was">
            Changed · was <s>{settingLabel(changedFrom)}</s>
          </span>
        ) : null}
      </span>
      {setting === "locked" ? (
        <span role="cell" className="owner-only">
          Owner only
        </span>
      ) : (
        <span
          role="cell"
          className="seg"
          aria-label={permission.name}
          title={disabledReason}
        >
          {CHOICES.map((c) => (
            <button
              key={c.value}
              type="button"
              className={setting === c.value ? c.cls : undefined}
              aria-pressed={setting === c.value}
              disabled={!!disabledReason}
              title={disabledReason}
              onClick={() => onChange?.(c.value)}
            >
              {c.label}
            </button>
          ))}
        </span>
      )}
      <span role="cell" className={`ef${result === "Blocked" ? " bl" : ""}`}>
        {result}
        {note ? <em>{note}</em> : null}
      </span>
    </div>
  );
}
