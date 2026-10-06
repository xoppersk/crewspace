"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, PanelLeftClose, PanelLeftOpen, UserRound, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/**
 * Sidebar navigation. Add an item here AND a matching page under
 * src/app/(app)/app/... — the array is the single source of truth for the nav.
 */
export const NAV_ITEMS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Dashboard", href: "/app", icon: LayoutDashboard },
  { label: "Account", href: "/app/account", icon: UserRound },
];

function SidebarNav({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-2">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Button
            key={item.href}
            variant={active ? "secondary" : "ghost"}
            asChild
            className={cn("justify-start", collapsed && "justify-center px-0")}
            title={collapsed ? item.label : undefined}
          >
            <Link href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined}>
              <item.icon className="size-4 shrink-0" />
              {collapsed ? null : <span className="truncate">{item.label}</span>}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}

/** Desktop sidebar (md+). Collapses to an icon rail. */
export function AppSidebar({
  collapsed,
  onToggleCollapse,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-svh shrink-0 flex-col border-r bg-sidebar md:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className={cn("flex h-14 items-center border-b px-4", collapsed && "justify-center px-0")}>
        {collapsed ? (
          <span className="text-sm font-bold">S</span>
        ) : (
          <span className="truncate font-semibold tracking-tight">Sevyn App Starter</span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        <SidebarNav collapsed={collapsed} />
      </div>
      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="w-full"
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </Button>
      </div>
    </aside>
  );
}

/** Mobile sidebar: same nav inside a slide-over drawer. */
export function AppSidebarMobile({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b p-4 text-left">
          <SheetTitle>Sevyn App Starter</SheetTitle>
        </SheetHeader>
        <SidebarNav onNavigate={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}
