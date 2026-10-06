"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
}

export interface MembershipSummary {
  id: string;
  role_id: string;
  role_name: string;
  role_system_key: string | null;
  is_active: boolean;
}

interface OrgContextValue {
  org: OrgSummary;
  membership: MembershipSummary;
  /** Union of permission keys for the viewer's active membership. */
  permissions: string[];
  user: User;
}

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({ value, children }: { value: OrgContextValue; children: ReactNode }) {
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

function useOrgContext(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("must be used within <OrgProvider> ([orgSlug] layout)");
  return ctx;
}

/** The active org (id, name, slug, logo). */
export function useOrg(): OrgSummary {
  return useOrgContext().org;
}

/** The viewer's membership summary (role name/key). */
export function useMembership(): MembershipSummary {
  return useOrgContext().membership;
}

/**
 * Client-side permission hook — reads the [orgSlug] layout's context.
 * Layer 1 (UI gating): hide/disable affordances the viewer lacks.
 * Server Actions MUST re-check via requireOrgAccess() (layer 2).
 */
export function usePermissions(): string[] {
  return useOrgContext().permissions;
}

/** Convenience: does the viewer hold a specific permission key? */
export function useHasPermission(key: string): boolean {
  return useOrgContext().permissions.includes(key);
}
