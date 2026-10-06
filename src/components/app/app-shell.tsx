"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useMemo, useState, type ReactNode } from "react";
import { LayoutDashboard, LogOut, Moon, Sun, UserRound } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

import { AppHeader } from "./app-header";
import { AppSidebar, AppSidebarMobile } from "./app-sidebar";
import { CommandPalette, openCommandPalette, type PaletteCommand } from "./command-palette";

/**
 * Client shell composing sidebar + header + command palette around page content.
 * The (app)/layout.tsx server component fetches the user/profile and renders
 * this; all interactive state (collapsed sidebar, palette) lives here.
 */
export function AppShell({
  email,
  displayName,
  userMenu,
  children,
}: {
  email: string | undefined;
  displayName: string | null;
  userMenu?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Default palette actions. Clones extend this array — e.g. "New project",
  // entity search — without touching the palette component itself.
  const commands = useMemo<PaletteCommand[]>(
    () => [
      {
        id: "go-dashboard",
        label: "Go to Dashboard",
        keywords: "home overview",
        icon: LayoutDashboard,
        run: () => router.push("/app"),
      },
      {
        id: "go-account",
        label: "Go to Account settings",
        keywords: "profile preferences",
        icon: UserRound,
        run: () => router.push("/app/account"),
      },
      {
        id: "toggle-theme",
        label: theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
        keywords: "theme appearance",
        icon: theme === "dark" ? Sun : Moon,
        run: () => setTheme(theme === "dark" ? "light" : "dark"),
      },
      {
        id: "sign-out",
        label: "Sign out",
        keywords: "logout",
        icon: LogOut,
        run: () => {
          void createClient()
            .auth.signOut()
            .then(() => {
              router.push("/login");
              router.refresh();
            });
        },
      },
    ],
    [router, theme, setTheme],
  );

  return (
    <div className="flex min-h-svh">
      <AppSidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed((value) => !value)} />
      <AppSidebarMobile open={mobileOpen} onOpenChange={setMobileOpen} />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          email={email}
          displayName={displayName}
          userMenu={userMenu}
          onMenuClick={() => setMobileOpen(true)}
          onPaletteOpen={openCommandPalette}
        />
        <main className="flex-1 p-4 md:p-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>

      <CommandPalette commands={commands} />
    </div>
  );
}
