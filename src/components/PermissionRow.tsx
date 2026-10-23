"use client";

import { settingResultFor } from "@/lib/api";
import type { Permission, Setting } from "@/lib/types";
import { IconCheck, IconLock } from "./icons";

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
 * choice, and the Result the choice produces (dot glyph + word + note).
 * Changed rows carry the tint of their direction and the
 * "Changed · was X" chip, as Main.html draws them.
 */
export function PermissionRow({
  permission,
  baselineIds,
  setting,
  changedFrom,
  resultNote,
  disabledReason,
  onChange,
}: {
  permission: Permission;
  /** Org baseline permission ids (for the Inherit result). */
  baselineIds: number[];
  setting: Setting;
  /** When set, the row shows "Changed · was X" as a changed row. */
  changedFrom?: Setting | null;
  resultNote?: string;
  /** Offline / not permitted: control disabled with this reason as a tooltip. */
  disabledReason?: string;
  onChange?: (next: Setting) => void;
}) {
  const result = settingResultFor(setting, permission.id, baselineIds);
  const note =
    resultNote ??
    (setting === "inherit" ? "from baseline" : undefined);
  const denied = result === "Blocked" && setting === "deny";
  const rowCls = changedFrom
    ? setting === "deny"
      ? "pr chg-deny"
      : "pr chg-allow"
    : "pr";
  return (
    <div role="row" className={rowCls}>
      <span role="cell">
        <b>{permission.name}</b>
        <small>{permission.description}</small>
        {changedFrom ? (
          <span className={`chg${setting === "deny" ? " deny" : ""}`}>
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
      <span
        role="cell"
        className={`res${result === "Blocked" ? (denied ? " dn" : " bl") : ""}`}
      >
        <span className={`dot${result === "Allowed" ? " ok" : denied ? " dn" : ""}`}>
          {result === "Allowed" ? <IconCheck /> : <IconLock />}
        </span>
        <span>
          {result}
          {note ? <small>{note}</small> : null}
        </span>
      </span>
    </div>
  );
}
