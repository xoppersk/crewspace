"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { KeyRound, Lock, LogOut, UserRound, WifiOff } from "lucide-react";

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
import { useShell, type NavItem } from "./shell-context";

function initials(name: string | null | undefined, email: string | undefined): string {
  const source = name?.trim() || email?.trim() || "?";
  const parts = source.split(/\s+/);
  if (parts.length > 1 && parts[0] && parts[1]) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

/**
 * Offline banner (UI-DESIGN.md §2.4): "Reconnecting… changes will sync".
 */
function OfflineBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-warning-soft px-4 py-2 text-sm font-medium text-warning"
    >
      <WifiOff className="size-4" aria-hidden />
      Reconnecting… changes will sync.
    </div>
  );
}

function UserMenu({
  email,
  displayName,
  avatarUrl,
  orgSlug,
}: {
  email: string | undefined;
  displayName: string | null;
  avatarUrl: string | null;
  orgSlug: string | null;
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
        {orgSlug ? (
          <DropdownMenuItem asChild>
            <Link href={`/${orgSlug}/profile`} className="flex items-center gap-2">
              <KeyRound className="size-4" /> My access
            </Link>
          </DropdownMenuItem>
        ) : null}
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

function NavLink({
  item,
  active,
  className,
}: {
  item: NavItem;
  active: boolean;
  className?: string;
}) {
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 text-sm font-medium",
        active
          ? "bg-primary-soft text-accent-foreground shadow-[inset_3px_0_0_var(--primary)]"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
      aria-current={active ? "page" : undefined}
    >
      <item.icon className={cn("size-4 shrink-0", active && "text-primary")} aria-hidden />
      <span className="flex-1 truncate">{item.label}</span>
      {item.locked ? (
        <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-label="Locked" />
      ) : null}
      {typeof item.badge === "number" && item.badge > 0 ? (
        <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-white tnum">
          {item.badge}
        </span>
      ) : null}
    </Link>
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

  // Mobile bottom tabs: Dashboard, Directory, Teams; everything else hides
  // behind "More" (UI-DESIGN.md §2.4).
  const tabPaths = ["dashboard", "directory", "teams"];
  const tabItems = tabPaths
    .map((p) => navItems.find((item) => item.href.endsWith(`/${p}`)))
    .filter((item): item is NavItem => Boolean(item));
  const moreItems = navItems.filter((item) => !tabItems.includes(item));

  return (
    <div className="flex min-h-svh">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r bg-card md:flex">
        <div className="border-b p-3">
          <OrgSwitcher orgs={orgs} activeSlug={slug} />
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto py-3" aria-label="Primary">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </nav>
        <div className="border-t p-3">
          <UserMenu email={email} displayName={displayName} avatarUrl={avatarUrl} orgSlug={slug} />
        </div>
      </aside>

      {/* Mobile chrome */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b bg-card px-3 py-2 md:hidden">
          <OrgSwitcher orgs={orgs} activeSlug={slug} className="max-w-[220px]" />
          <div className="flex-1" />
          <Link href={slug ? `/${slug}/profile` : "/account"} aria-label="My profile">
            <Avatar className="size-8">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
              <AvatarFallback className="text-xs">{initials(displayName, email)}</AvatarFallback>
            </Avatar>
          </Link>
        </header>

        <OfflineBanner />

        <main className="min-w-0 flex-1 px-4 py-6 pb-24 md:px-8 md:pb-10">{children}</main>

        <nav
          className="fixed inset-x-0 bottom-0 z-30 border-t bg-card md:hidden"
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
                <item.icon className="size-5" aria-hidden />
                {item.label}
                {item.locked ? <Lock className="size-3" aria-label="Locked" /> : null}
              </Link>
            ))}
            {moreItems.length > 0 ? (
              <Sheet>
                <SheetTrigger asChild>
                  <button
                    type="button"
                    className="flex flex-col items-center gap-1 px-2 py-2.5 text-[11px] font-medium text-muted-foreground"
                  >
                    <span
                      aria-hidden
                      className="flex size-5 items-center justify-center text-base leading-none"
                    >
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
                        className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium hover:bg-muted"
                      >
                        <item.icon className="size-4" aria-hidden />
                        {item.label}
                        {item.locked ? (
                          <Lock className="size-3.5 text-muted-foreground" aria-label="Locked" />
                        ) : null}
                        {typeof item.badge === "number" && item.badge > 0 ? (
                          <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-white tnum">
                            {item.badge}
                          </span>
                        ) : null}
                      </Link>
                    ))}
                    <Link
                      href="/account"
                      className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium hover:bg-muted"
                    >
                      <UserRound className="size-4" aria-hidden />
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
