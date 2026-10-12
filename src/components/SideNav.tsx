import Link from "next/link";
import {
  getMember,
  getMembers,
  getOrg,
  getRoles,
  getTeams,
  openInvitations,
} from "@/lib/api";

export type NavKey =
  | "overview"
  | "directory"
  | "teams"
  | "roles"
  | "invitations"
  | "audit"
  | "settings";

export function SideNav({
  current,
  personId = "001",
  variant,
}: {
  current: NavKey | "none";
  /** Signed-in person shown at the bottom (defaults to the owner). */
  personId?: string;
  /**
   * Profile persona (Profile.html): no Settings item, and the signed-in
   * block itself is the current page — a link to /app/me.
   */
  variant?: "profile";
}) {
  const org = getOrg();
  const person = getMember(personId) ?? getMember("001")!;
  const role = getRoles().find((r) => r.id === person.roleId)!;
  const items: { key: NavKey; label: string; href: string; count?: number }[] = [
    { key: "overview", label: "Overview", href: "/app" },
    { key: "directory", label: "Directory", href: "/app/people", count: getMembers().length },
    { key: "teams", label: "Teams", href: "/app/teams", count: getTeams().length },
    { key: "roles", label: "Roles", href: "/app/roles", count: getRoles().length },
    { key: "invitations", label: "Invitations", href: "/app/invitations", count: openInvitations().length },
    { key: "audit", label: "Audit log", href: "/app/audit" },
    ...(variant === "profile"
      ? []
      : [{ key: "settings", label: "Settings", href: "/app/settings" } as const]),
  ];
  return (
    <nav aria-label="Organization" className="sidenav">
      <div className="org">
        <b>{org.name}</b>
        <span>
          Organization register · {getMembers().length} members
        </span>
      </div>
      <div className="navlist">
        {items.map((it) => (
          <Link
            key={it.key}
            href={it.href}
            className="nv"
            aria-current={current === it.key ? "page" : undefined}
          >
            {it.label}
            {it.count !== undefined ? <span>{it.count}</span> : null}
          </Link>
        ))}
      </div>
      {variant === "profile" ? (
        <Link
          href="/app/me"
          className="who"
          aria-current="page"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <b style={{ fontWeight: 600 }}>{person.name}</b>
          <span>
            {role.name} · Member <span className="mono">{person.id}</span>
          </span>
        </Link>
      ) : (
        <div className="who">
          <b style={{ fontWeight: 600 }}>{person.name}</b>
          <span>
            {role.name} · Member <span className="mono">{person.id}</span>
          </span>
        </div>
      )}
    </nav>
  );
}
