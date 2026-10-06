"use server";

import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { ForbiddenError, requireOrgAccess } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { auditEventsToCsv } from "@/lib/audit/csv";
import { describeFilters } from "@/lib/audit/filters";
import type { AuditFilters } from "@/lib/audit/types";
import { fetchAuditActors, fetchAuditEvents } from "./audit-data";

/**
 * Streams the current filtered audit view as CSV. Gated by `audit:export`
 * (layer 2) — and the export itself writes an `audit.exported` audit row
 * with the row count and the filters used, per the coverage contract.
 */
export async function exportAuditCsv(
  orgSlug: string,
  filters: Omit<AuditFilters, "page">,
): Promise<
  | { ok: true; csv: string; filename: string; rows: number }
  | { ok: false; error: string }
> {
  try {
    const supabase = await createClient();
    const { data: org } = await supabase
      .from("organizations")
      .select("id, slug")
      .eq("slug", orgSlug)
      .maybeSingle();
    if (!org) notFound();

    const { user } = await requireOrgAccess(org.id, "audit:export");

    const fullFilters: AuditFilters = { ...filters, page: 1 };
    const { events } = await fetchAuditEvents(supabase, org.id, fullFilters, {
      forExport: true,
    });
    const actors = await fetchAuditActors(supabase, events);
    const csv = auditEventsToCsv(events, actors);

    await writeAudit(org.id, user.id, "audit.exported", {
      targetType: "organization",
      targetId: org.id,
      diff: { rows: events.length, format: "CSV" },
      metadata: { filters: describeFilters(fullFilters) },
    });

    const stamp = new Date().toISOString().slice(0, 10);
    return {
      ok: true,
      csv,
      filename: `crewspace-audit-${org.slug}-${stamp}.csv`,
      rows: events.length,
    };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { ok: false, error: "You don't have permission to export the audit log." };
    }
    throw error;
  }
}
