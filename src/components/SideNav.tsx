import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import {
  getMembers,
  getRoles,
  getTeams,
  openInvitations,
  type WorkspaceData,
} from "@/lib/api";
import { signOutAction } from "@/lib/auth/actions";
import type { Member } from "@/lib/types";
import { shortId } from "./MemberRow";
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

/** The rail person line shortens the owner role to "Owner". */
function railRoleName(roleId: string, roleName: string): string {
  return roleId === "owner" ? "Owner" : roleName;
}

/**
 * The app rail. All counts and the person block come from the real
 * workspace data + the real session user (passed by AppShell) — there
 * is no default persona.
 */
export function SideNav({
  current,
  variant,
  data,
  me,
}: {
  current: NavKey | "none";
  /** Profile variant: no Settings item, the signed-in block links to /app/me. */
  variant?: "profile";
  data: WorkspaceData;
  me?: Member;
}) {
  const org = data.org;
  const person = me;
  const role = person
    ? getRoles(data).find((r) => r.id === person.roleId)
    : undefined;
  const monogram = org.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const items: { key: NavKey; label: string; href: string; count?: number }[] = [
    { key: "overview", label: "Overview", href: "/app" },
    { key: "directory", label: "Directory", href: "/app/people", count: getMembers(data).length },
    { key: "teams", label: "Teams", href: "/app/teams", count: getTeams(data).length },
    { key: "roles", label: "Roles", href: "/app/roles", count: getRoles(data).length },
    { key: "invitations", label: "Invitations", href: "/app/invitations", count: openInvitations(data).length },
    { key: "audit", label: "Audit log", href: "/app/audit" },
    ...(variant === "profile"
      ? []
      : [{ key: "settings", label: "Settings", href: "/app/settings" } as const]),
  ];
  const whoInner = person ? (
    <>
      <span className="av ink" aria-hidden="true">
        {initialsOf(person.name)}
      </span>
      <span className="who-text">
        <b>{person.name}</b>
        <span>
          {role ? railRoleName(role.id, role.name) : ""} ·{" "}
          {variant === "profile" ? "Member " : null}
          <span className="mono">{shortId(person.id)}</span>
        </span>
      </span>
    </>
  ) : null;
  return (
    <nav aria-label="Organization" className="sidenav">
      <div className="org">
        <span className="monogram" aria-hidden="true">
          {monogram || "CS"}
        </span>
        <span className="org-text">
          <b>{org.name}</b>
          <span>Register · {getMembers(data).length} members</span>
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
      {person ? (
        <>
          {variant === "profile" ? (
            <Link href="/app/me" className="who" aria-current="page">
              {whoInner}
            </Link>
          ) : (
            <Link href="/app/me" className="who">
              {whoInner}
            </Link>
          )}
          <form action={signOutAction} style={{ padding: "0 14px 12px" }}>
            <button
              type="submit"
              className="sys-headlink"
              style={{ background: "none", border: 0, cursor: "pointer", padding: 0 }}
            >
              Sign out
            </button>
          </form>
        </>
      ) : null}
    </nav>
  );
}
