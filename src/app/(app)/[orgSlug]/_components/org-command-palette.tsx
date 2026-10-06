"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Mail,
  ScrollText,
  Settings,
  ShieldCheck,
  ShieldPlus,
  UserPlus,
  UserRound,
  Users,
  UsersRound,
} from "lucide-react";

import {
  CommandPalette,
  type PaletteCommand,
} from "@/components/app/command-palette";
import { useOrg, usePermissions } from "../org-context";
import { getPaletteIndex, type PaletteIndex } from "./palette-actions";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", path: "dashboard", icon: LayoutDashboard, anyOf: ["org:read"] },
  { id: "directory", label: "Directory", path: "directory", icon: Users, anyOf: ["members:read"] },
  { id: "teams", label: "Teams", path: "teams", icon: UsersRound, anyOf: ["org:read"] },
  { id: "roles", label: "Roles", path: "roles", icon: ShieldCheck, anyOf: ["org:read"] },
  {
    id: "invitations",
    label: "Invitations",
    path: "invitations",
    icon: Mail,
    anyOf: ["invitations:manage", "members:invite"],
  },
  { id: "audit", label: "Audit log", path: "audit", icon: ScrollText, anyOf: ["audit:read"] },
  { id: "settings", label: "Settings", path: "settings", icon: Settings, anyOf: ["settings:manage"] },
] as const;

/**
 * Org-scoped ⌘K palette, mounted once in the [orgSlug] layout (inside the
 * (app) tree, so no layout restructuring). Navigation + actions are
 * permission-filtered with the same rules as the sidebar (layer 1); every
 * target page re-checks server-side (layer 2).
 */
export function OrgCommandPalette() {
  const org = useOrg();
  const permissions = usePermissions();
  const router = useRouter();
  const [index, setIndex] = useState<PaletteIndex | null>(null);

  useEffect(() => {
    let live = true;
    void getPaletteIndex(org.slug).then((data) => {
      if (live) setIndex(data);
    });
    return () => {
      live = false;
    };
  }, [org.slug]);

  const has = (key: string) => permissions.includes(key);
  const go = (path: string) => () => router.push(`/${org.slug}/${path}`);

  const commands: PaletteCommand[] = [];

  for (const item of NAV_ITEMS) {
    if (item.anyOf.some((key) => has(key))) {
      commands.push({
        id: `go-${item.id}`,
        label: `Go to ${item.label}`,
        keywords: `${item.path} navigate page`,
        icon: item.icon,
        group: "Go to",
        run: go(item.path),
      });
    }
  }

  // Always available: own profile + cross-org account page.
  commands.push(
    {
      id: "go-profile",
      label: "Go to My profile",
      keywords: "profile me account",
      icon: UserRound,
      group: "Go to",
      run: go("profile"),
    },
    {
      id: "go-account",
      label: "Go to Account settings",
      keywords: "account organizations password",
      icon: UserRound,
      group: "Go to",
      run: () => router.push("/account"),
    },
  );

  if (has("members:invite")) {
    commands.push({
      id: "action-invite",
      label: "Invite member",
      keywords: "invite add member invitation",
      icon: UserPlus,
      group: "Actions",
      run: go("invitations"),
    });
  }
  if (has("teams:create")) {
    commands.push({
      id: "action-create-team",
      label: "Create team",
      keywords: "new team create",
      icon: UsersRound,
      group: "Actions",
      run: go("teams"),
    });
  }
  if (has("roles:create")) {
    commands.push({
      id: "action-create-role",
      label: "Create role",
      keywords: "new role create custom",
      icon: ShieldPlus,
      group: "Actions",
      run: () => router.push(`/${org.slug}/roles/new`),
    });
  }

  for (const member of index?.members ?? []) {
    commands.push({
      id: `member-${member.id}`,
      label: member.name,
      keywords: "member person directory teammate",
      icon: Users,
      group: "Members",
      run: () => router.push(`/${org.slug}/directory/${member.id}`),
    });
  }
  for (const team of index?.teams ?? []) {
    commands.push({
      id: `team-${team.id}`,
      label: team.name,
      keywords: "team group",
      icon: UsersRound,
      group: "Teams",
      run: () => router.push(`/${org.slug}/teams/${team.id}`),
    });
  }
  for (const role of index?.roles ?? []) {
    commands.push({
      id: `role-${role.id}`,
      label: role.name,
      keywords: "role permission",
      icon: ShieldCheck,
      group: "Roles",
      run: () => router.push(`/${org.slug}/roles/${role.id}`),
    });
  }

  return <CommandPalette commands={commands} />;
}
