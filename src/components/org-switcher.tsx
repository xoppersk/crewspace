"use client";

import Link from "next/link";
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface OrgSwitcherOrg {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  role_name?: string;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/**
 * Organization switcher — sits at the top of the app sidebar (desktop) and
 * the mobile top bar. Lists the signed-in user's orgs; the active org gets a
 * check. "+ New organization" goes to /onboarding.
 *
 * The parent layout loads the org list server-side and passes it in (static
 * data is fine for this phase — counts and realtime badges come later).
 */
export function OrgSwitcher({
  orgs,
  activeSlug,
  className,
}: {
  orgs: OrgSwitcherOrg[];
  activeSlug?: string | null;
  className?: string;
}) {
  const active = orgs.find((o) => o.slug === activeSlug) ?? null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left",
          "hover:border-border hover:bg-accent/50 focus-visible:outline-none",
          className,
        )}
        aria-label="Switch organization"
      >
        {active ? (
          <Avatar className="size-7 shrink-0 rounded-md">
            {active.logo_url ? <AvatarImage src={active.logo_url} alt="" /> : null}
            <AvatarFallback className="rounded-md text-[11px] font-semibold">
              {initials(active.name)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
            <Building2 className="size-4 text-muted-foreground" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            {active?.name ?? "Select organization"}
          </span>
          {active?.role_name ? (
            <span className="block truncate text-xs text-muted-foreground">
              {active.role_name}
            </span>
          ) : null}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        {orgs.map((org) => (
          <DropdownMenuItem key={org.id} asChild>
            <Link href={`/${org.slug}/dashboard`} className="flex items-center gap-2">
              <Avatar className="size-6 shrink-0 rounded-md">
                {org.logo_url ? <AvatarImage src={org.logo_url} alt="" /> : null}
                <AvatarFallback className="rounded-md text-[10px] font-semibold">
                  {initials(org.name)}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{org.name}</span>
                {org.role_name ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {org.role_name}
                  </span>
                ) : null}
              </span>
              {org.slug === activeSlug ? <Check className="size-4 shrink-0" /> : null}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/onboarding" className="flex items-center gap-2">
            <Plus className="size-4" />
            New organization
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
