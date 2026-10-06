"use client";

import dynamic from "next/dynamic";

import { useOrg, usePermissions } from "./org-context";

export interface PresenceIdentity {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

/**
 * Lazy presence bootstrap for the [orgSlug] layout. The realtime provider
 * loads on demand (dynamic import, ssr: false) so the app shell bundle stays
 * lean, and it only mounts when the viewer holds `members:read` — presence
 * data is org-member data and must never leak to unauthorized viewers.
 *
 * The identity comes from the server layout (no extra client fetch), so the
 * provider mounts immediately and stays mounted across navigations.
 */
const LazyPresenceProvider = dynamic(
  () =>
    import("@/components/presence/presence-provider").then((m) => ({
      default: m.PresenceProvider,
    })),
  { ssr: false },
);

export function OrgPresence({
  identity,
  children,
}: {
  identity: PresenceIdentity;
  children: React.ReactNode;
}) {
  const org = useOrg();
  const permissions = usePermissions();

  if (!permissions.includes("members:read")) return <>{children}</>;

  return (
    <LazyPresenceProvider
      orgId={org.id}
      userId={identity.id}
      fullName={identity.fullName}
      avatarUrl={identity.avatarUrl}
    >
      {children}
    </LazyPresenceProvider>
  );
}
