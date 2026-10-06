import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requireOrgAccess } from "@/lib/permissions";
import { parseAuditFilters } from "@/lib/audit/filters";
import { AuditLogView } from "@/components/audit/audit-log-view";
import {
  fetchAuditActors,
  fetchAuditActorOptions,
  fetchAuditEvents,
} from "./audit-data";

export const metadata: Metadata = { title: "Audit log" };

/**
 * Audit log page. Server owns the filtered query (filters live in the URL);
 * the client owns the live tail, the detail drawer, and CSV export.
 *
 * Gates: `audit:read` (layer 2 — requireOrgAccess; the nav hides the item at
 * layer 1 for viewers without it). The live-tail subscription is only mounted
 * inside AuditLogView, which only renders past this gate.
 */
export default async function AuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgSlug } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, slug")
    .eq("slug", orgSlug)
    .maybeSingle();
  if (!org) notFound();

  const { permissions } = await requireOrgAccess(org.id, "audit:read");

  const filters = parseAuditFilters(await searchParams);
  const [{ events, total }, actorOptions] = await Promise.all([
    fetchAuditEvents(supabase, org.id, filters),
    fetchAuditActorOptions(supabase, org.id),
  ]);
  const actors = await fetchAuditActors(supabase, events);

  return (
    <AuditLogView
      orgSlug={org.slug}
      orgId={org.id}
      initialEvents={events}
      initialTotal={total}
      initialFilters={filters}
      actors={[...actors.values()]}
      actorOptions={actorOptions}
      canExport={permissions.includes("audit:export")}
    />
  );
}
