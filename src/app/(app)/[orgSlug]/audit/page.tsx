import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";

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
 * Gates: the nav shows a locked Audit item at layer 1 for viewers without
 * `audit:read`; direct navigation renders the locked state here (never a
 * raw 403). The live-tail subscription only mounts inside AuditLogView,
 * which only renders past this gate.
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
    .select("id, slug, name")
    .eq("slug", orgSlug)
    .maybeSingle();
  if (!org) notFound();

  const { permissions } = await requireOrgAccess(org.id, "org:read");

  if (!permissions.includes("audit:read")) {
    // Locked state: name the org's owners in the "who to ask" line.
    const { data: ownerMemberships } = await supabase
      .from("memberships")
      .select("user_id, roles!inner(system_key)")
      .eq("org_id", org.id)
      .eq("is_active", true)
      .eq("roles.system_key", "owner");
    const ownerIds = (ownerMemberships ?? []).map((m) => m.user_id);
    const { data: ownerProfiles } =
      ownerIds.length > 0
        ? await supabase.from("profiles").select("full_name").in("id", ownerIds)
        : { data: [] as { full_name: string }[] };
    const ownerNames = (ownerProfiles ?? [])
      .map((p) => p.full_name)
      .filter(Boolean)
      .slice(0, 3);
    const askLine =
      ownerNames.length > 0
        ? `Ask ${ownerNames.join(", ")} (owner) for access.`
        : "Ask an organization owner for access.";

    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Lock className="size-5 text-muted-foreground" aria-hidden />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">Audit log is locked</h1>
        <p className="text-sm text-muted-foreground">
          The audit log is visible to owners and admins — it records every consequential
          change in {org.name}.
        </p>
        <p className="text-sm font-medium">{askLine}</p>
      </div>
    );
  }

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
