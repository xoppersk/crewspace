import type { ReactNode } from "react";

/**
 * Settings row: 220px label column with muted help text, then the control.
 * Unsaved: sheet-tint row; the seal "Changed · was X" note sits in the
 * label column under the label, and a consequence sentence follows the
 * control.
 */
export function Field({
  label,
  help,
  htmlFor,
  changed,
  consequence,
  children,
}: {
  label: string;
  help?: string;
  /** Id of the control the label names, when the control has one. */
  htmlFor?: string;
  changed?: { was: string };
  consequence?: string;
  children: ReactNode;
}) {
  return (
    <div className={`field-row${changed ? " changed" : ""}`}>
      <div className="flabel">
        {htmlFor ? (
          <label htmlFor={htmlFor} style={{ fontWeight: 600, fontSize: 14 }}>
            {label}
          </label>
        ) : (
          <b>{label}</b>
        )}
        {help ? <span>{help}</span> : null}
        {changed ? (
          <span className="was">Changed · was {changed.was}</span>
        ) : null}
      </div>
      <div
        style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {children}
        </div>
        {consequence ? (
          <span style={{ fontSize: 12, color: "var(--ink-2)" }}>
            {consequence}
          </span>
        ) : null}
      </div>
    </div>
  );
}
