import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import {
  getMember,
  getMembers,
  getOrg,
  getRoles,
  getTeams,
  openInvitations,
} from "@/lib/api";
import {
  IconDocument,
  IconEnvelope,
  IconGear,
  IconGrid,
  IconPerson,
  IconShieldCheck,
  IconTeams,
} from "./icons";

export type NavKey =
  | "overview"
  | "directory"
  | "teams"
  | "roles"
  | "invitations"
  | "audit"
  | "settings";

const ICONS: Record<NavKey, ComponentType<SVGProps<SVGSVGElement>>> = {
  overview: IconGrid,
  directory: IconPerson,
  teams: IconTeams,
  roles: IconShieldCheck,
  invitations: IconEnvelope,
  audit: IconDocument,
  settings: IconGear,
};

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

/** The rail person line shortens the owner role to "Owner" (screens). */
function railRoleName(roleId: string, roleName: string): string {
  return roleId === "owner" ? "Owner" : roleName;
}

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
  const whoInner = (
    <>
      <span className="av ink" aria-hidden="true">
        {initialsOf(person.name)}
      </span>
      <span className="who-text">
        <b>{person.name}</b>
        <span>
          {railRoleName(role.id, role.name)} ·{" "}
          {variant === "profile" ? "Member " : null}
          <span className="mono">{person.id}</span>
        </span>
      </span>
    </>
  );
  return (
    <nav aria-label="Organization" className="sidenav">
      <div className="org">
        <span className="monogram" aria-hidden="true">
          SL
        </span>
        <span className="org-text">
          <b>{org.name}</b>
          <span>Register · {getMembers().length} members</span>
        </span>
      </div>
      <div className="navlist">
        {items.map((it) => {
          const Icon = ICONS[it.key];
          return (
            <Link
              key={it.key}
              href={it.href}
              className="nv"
              aria-current={current === it.key ? "page" : undefined}
            >
              <Icon />
              {it.label}
              {it.count !== undefined ? <span className="ct">{it.count}</span> : null}
            </Link>
          );
        })}
      </div>
      {variant === "profile" ? (
        <Link href="/app/me" className="who" aria-current="page">
          {whoInner}
        </Link>
      ) : (
        <div className="who">{whoInner}</div>
      )}
    </nav>
  );
}
