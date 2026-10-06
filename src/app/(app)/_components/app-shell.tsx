"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, UserRound } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { OrgSwitcher, type OrgSwitcherOrg } from "@/components/org-switcher";
import { cn } from "@/lib/utils";
import { useShell } from "./shell-context";

function initials(name: string | null | undefined, email: string | undefined): string {
  const source = name?.trim() || email?.trim() || "?";
  const parts = source.split(/\s+/);
  if (parts.length > 1 && parts[0] && parts[1]) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function UserMenu({
  email,
  displayName,
  avatarUrl,
}: {
  email: string | undefined;
  displayName: string | null;
  avatarUrl: string | null;
}) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="w-full justify-start gap-2 px-2" aria-label="User menu">
          <Avatar className="size-7">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
            <AvatarFallback className="text-[11px]">{initials(displayName, email)}</AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-sm font-medium">
              {displayName || "Your account"}
            </span>
            <span className="block truncate text-xs text-muted-foreground">{email}</span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{displayName || "Your account"}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account" className="flex items-center gap-2">
            <UserRound className="size-4" /> Account settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={signOut} className="flex items-center gap-2">
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Authenticated app frame: desktop sidebar + mobile top bar / bottom tabs.
 *
 * The (app) layout renders this; the [orgSlug] layout fills in the nav items
 * (permission-filtered) via useShell().setNavItems. Pages outside an org
 * (/account) get the frame with whatever nav the page itself sets.
 */
export function AppShell({
  orgs,
  activeSlug: initialActiveSlug,
  email,
  displayName,
  avatarUrl,
  children,
}: {
  orgs: OrgSwitcherOrg[];
  activeSlug?: string | null;
  email: string | undefined;
  displayName: string | null;
  avatarUrl: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { navItems, activeOrgSlug } = useShell();
  const slug = activeOrgSlug ?? initialActiveSlug ?? null;

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

  // Bottom tabs: first 4 items; the rest hide behind "More".
  const tabItems = navItems.slice(0, 4);
  const moreItems = navItems.slice(4);

  return (
    <div className="flex min-h-svh">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r bg-background md:flex">
        <div className="p-3">
          <OrgSwitcher orgs={orgs} activeSlug={slug} />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3" aria-label="Primary">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium",
                isActive(item.href)
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
              aria-current={isActive(item.href) ? "page" : undefined}
            >
              <item.icon className="size-4 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {typeof item.badge === "number" && item.badge > 0 ? (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>
        <div className="border-t p-3">
          <UserMenu email={email} displayName={displayName} avatarUrl={avatarUrl} />
        </div>
      </aside>

      {/* Mobile chrome */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur md:hidden">
          <OrgSwitcher orgs={orgs} activeSlug={slug} className="max-w-[220px]" />
          <div className="flex-1" />
          <Avatar className="size-8">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
            <AvatarFallback className="text-xs">{initials(displayName, email)}</AvatarFallback>
          </Avatar>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 pb-24 md:px-8 md:pb-10">{children}</main>

        <nav
          className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur md:hidden"
          aria-label="Primary"
        >
          <div className="grid auto-cols-fr grid-flow-col">
            {tabItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-2 py-2.5 text-[11px] font-medium",
                  isActive(item.href) ? "text-primary" : "text-muted-foreground",
                )}
                aria-current={isActive(item.href) ? "page" : undefined}
              >
                <item.icon className="size-5" />
                {item.label}
              </Link>
            ))}
            {moreItems.length > 0 ? (
              <Sheet>
                <SheetTrigger asChild>
                  <button
                    type="button"
                    className="flex flex-col items-center gap-1 px-2 py-2.5 text-[11px] font-medium text-muted-foreground"
                  >
                    <span className="flex size-5 items-center justify-center text-base leading-none">
                      •••
                    </span>
                    More
                  </button>
                </SheetTrigger>
                <SheetContent side="bottom" className="rounded-t-2xl">
                  <SheetHeader>
                    <SheetTitle>More</SheetTitle>
                  </SheetHeader>
                  <div className="grid gap-1 pb-4 pt-2">
                    {moreItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-accent"
                      >
                        <item.icon className="size-4" />
                        {item.label}
                      </Link>
                    ))}
                    <Link
                      href="/account"
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-accent"
                    >
                      <UserRound className="size-4" />
                      Account settings
                    </Link>
                  </div>
                </SheetContent>
              </Sheet>
            ) : null}
          </div>
        </nav>
      </div>
    </div>
  );
}
