"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Pending-invitation count etc. Static for this phase. */
  badge?: number;
  /** Locked items (e.g. Audit without audit:read) render with a lock icon. */
  locked?: boolean;
}

/**
 * Shell-level UI state shared between the (app) layout's AppShell and the
 * [orgSlug] subtree. The (app) layout renders the frame (sidebar / bottom
 * tabs) but doesn't know the active org slug — the [orgSlug] layout sets the
 * nav items (permission-filtered) once it has loaded the org.
 */
interface ShellState {
  navItems: NavItem[];
  setNavItems: (items: NavItem[]) => void;
  activeOrgSlug: string | null;
  setActiveOrgSlug: (slug: string | null) => void;
}

const ShellContext = createContext<ShellState | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const [navItems, setNavItems] = useState<NavItem[]>([]);
  const [activeOrgSlug, setActiveOrgSlug] = useState<string | null>(null);
  return (
    <ShellContext.Provider value={{ navItems, setNavItems, activeOrgSlug, setActiveOrgSlug }}>
      {children}
    </ShellContext.Provider>
  );
}

export function useShell(): ShellState {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used within <ShellProvider>");
  return ctx;
}
