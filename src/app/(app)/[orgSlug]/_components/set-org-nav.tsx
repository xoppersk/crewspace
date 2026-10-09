"use client";

import { useEffect } from "react";
import {
  LayoutDashboard,
  Mail,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  UsersRound,
} from "lucide-react";

import { useShell, type NavItem } from "../../_components/shell-context";

interface NavDef extends Omit<NavItem, "href"> {
  path: string;
  /** Show the item only when the viewer holds at least one of these keys. */
  anyOf?: string[];
}

const NAV_DEFS: NavDef[] = [
  { path: "dashboard", label: "Dashboard", icon: LayoutDashboard, anyOf: ["org:read"] },
  { path: "directory", label: "Directory", icon: Users, anyOf: ["members:read"] },
  { path: "teams", label: "Teams", icon: UsersRound, anyOf: ["org:read"] },
  { path: "roles", label: "Roles", icon: ShieldCheck, anyOf: ["org:read"] },
  {
    path: "invitations",
    label: "Invitations",
    icon: Mail,
    anyOf: ["invitations:manage", "members:invite"],
  },
  { path: "audit", label: "Audit log", icon: ScrollText, anyOf: ["audit:read"] },
  { path: "settings", label: "Settings", icon: Settings, anyOf: ["settings:manage"] },
];

/**
 * Runs inside the [orgSlug] layout: publishes the permission-filtered nav
 * into the (app) shell and marks the org switcher active. Items the viewer
 * lacks permission for are hidden (not disabled) — except Audit, which
 * appears with a lock icon and renders the locked state on direct
 * navigation (UI-DESIGN.md §2.4 / §2.15).
 */
export function SetOrgNav({
  slug,
  permissions,
  pendingInvites = 0,
}: {
  slug: string;
  permissions: string[];
  pendingInvites?: number;
}) {
  const { setNavItems, setActiveOrgSlug } = useShell();

  useEffect(() => {
    const items: NavItem[] = NAV_DEFS.filter(
      (def) => !def.anyOf || def.anyOf.some((key) => permissions.includes(key)),
    ).map((def) => ({
      href: `/${slug}/${def.path}`,
      label: def.label,
      icon: def.icon,
      badge: def.path === "invitations" ? pendingInvites : def.badge,
    }));
    if (!permissions.includes("audit:read")) {
      items.push({
        href: `/${slug}/audit`,
        label: "Audit log",
        icon: ScrollText,
        locked: true,
      });
    }
    setNavItems(items);
    setActiveOrgSlug(slug);
    return () => {
      setNavItems([]);
      setActiveOrgSlug(null);
    };
  }, [slug, permissions, pendingInvites, setNavItems, setActiveOrgSlug]);

  return null;
}
