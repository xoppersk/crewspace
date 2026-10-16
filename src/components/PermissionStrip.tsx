import { getPermissions, settingResult } from "@/lib/api";
import type { Role } from "@/lib/types";

/**
 * A role's access at a glance: 18 squares in register order.
 * Allowed = seal, blocked = strip-off. Always labelled "Allows N of 18".
 * The `big` variant is the role header card strip (R-04): tall cells,
 * with pending changes drawn hatched (becomes allowed) or ringed
 * (becomes/stays blocked), exactly as Main.html draws them.
 */
export function PermissionStrip({
  role,
  full = false,
  big = false,
  showCount = true,
  ariaLabel,
}: {
  role: Role;
  /** Full-width grid variant (member drawer). */
  full?: boolean;
  /** Header-card variant with pending-change states. */
  big?: boolean;
  showCount?: boolean;
  /** Screen-literal accessible-name override for the `big` variant
      (Marketing.html's fragment strip carries its own wording). */
  ariaLabel?: string;
}) {
  const perms = getPermissions();
  const allowed = perms.map(
    (p) => settingResult(role.settings[String(p.id)]!, p.id) === "Allowed",
  );
  const n = allowed.filter(Boolean).length;

  if (big) {
    const pending = new Map(
      (role.pendingChanges ?? []).map((c) => [c.permissionId, c.to]),
    );
    const allowedIds = perms.filter((_, i) => allowed[i]).map((p) => p.id);
    const pendNotes = (role.pendingChanges ?? []).map((c) => {
      const idx = perms.findIndex((p) => p.id === c.permissionId);
      if (c.to === "allow")
        return `permission ${c.permissionId} becomes allowed after review`;
      return allowed[idx]
        ? `permission ${c.permissionId} becomes blocked after review`
        : `permission ${c.permissionId} stays blocked`;
    });
    const label = `Allowed permissions: ${allowedIds.join(", ")}${pendNotes.length ? `; ${pendNotes.join("; ")}` : ""}`;
    return (
      <span className="strip-big" role="img" aria-label={ariaLabel ?? label}>
        {perms.map((p, i) => {
          const to = pending.get(p.id);
          const cls = to === "allow"
            ? "pend-allow"
            : to === "deny"
              ? "pend-deny"
              : allowed[i]
                ? "on"
                : undefined;
          return <i key={p.id} className={cls} />;
        })}
      </span>
    );
  }

  if (full) {
    return (
      <span
        className="strip-full"
        role="img"
        aria-label={`Allows ${n} of 18`}
      >
        {allowed.map((on, i) => (
          <i key={i} className={on ? "on" : undefined} />
        ))}
      </span>
    );
  }
  return (
    <span className="strip">
      <span className="cells" role="img" aria-label={`Allows ${n} of 18`}>
        {allowed.map((on, i) => (
          <i key={i} className={on ? "on" : undefined} />
        ))}
      </span>
      {showCount ? <span className="n">{n}</span> : null}
    </span>
  );
}
