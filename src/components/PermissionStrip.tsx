import { getPermissions, settingResult } from "@/lib/api";
import type { Role } from "@/lib/types";

/**
 * A role's access at a glance: 18 squares in register order.
 * Allowed = seal, blocked = fill. Always labelled "Allows N of 18".
 */
export function PermissionStrip({
  role,
  full = false,
  showCount = true,
}: {
  role: Role;
  /** Full-width grid variant (member drawer). */
  full?: boolean;
  showCount?: boolean;
}) {
  const perms = getPermissions();
  const allowed = perms.map(
    (p) => settingResult(role.settings[String(p.id)]!, p.id) === "Allowed",
  );
  const n = allowed.filter(Boolean).length;
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
