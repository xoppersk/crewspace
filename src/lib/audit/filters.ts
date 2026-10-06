/**
 * URL ⇄ filter-state mapping for the audit log, plus date-preset ranges.
 * Filters live in the URL so the CSV export can reuse the exact same view.
 */

import type { AuditFilters } from "./types";

const PRESETS = ["today", "7d", "30d", "custom", "all"] as const;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseAuditFilters(
  searchParams: Record<string, string | string[] | undefined>,
): AuditFilters {
  const actionsRaw = first(searchParams.actions) ?? "";
  const presetRaw = first(searchParams.preset);
  const pageRaw = Number.parseInt(first(searchParams.page) ?? "1", 10);

  return {
    q: (first(searchParams.q) ?? "").slice(0, 120),
    actions: actionsRaw
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean)
      .slice(0, 40),
    actorId: first(searchParams.actor) || null,
    preset: (PRESETS as readonly string[]).includes(presetRaw ?? "")
      ? (presetRaw as AuditFilters["preset"])
      : "all",
    from: first(searchParams.from) || null,
    to: first(searchParams.to) || null,
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? Math.min(pageRaw, 1000) : 1,
  };
}

export function filtersToSearchParams(filters: AuditFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.actions.length > 0) params.set("actions", filters.actions.join(","));
  if (filters.actorId) params.set("actor", filters.actorId);
  if (filters.preset !== "all") params.set("preset", filters.preset);
  if (filters.preset === "custom") {
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
  }
  if (filters.page > 1) params.set("page", String(filters.page));
  return params;
}

export function hasActiveFilters(filters: AuditFilters): boolean {
  return (
    filters.q !== "" ||
    filters.actions.length > 0 ||
    filters.actorId !== null ||
    filters.preset !== "all"
  );
}

/** Resolves a date preset to an ISO range (UTC). Custom passes through. */
export function auditDateRange(filters: AuditFilters): { from: string | null; to: string | null } {
  const now = new Date();
  switch (filters.preset) {
    case "today": {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      return { from: start.toISOString(), to: null };
    }
    case "7d":
      return { from: new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString(), to: null };
    case "30d":
      return { from: new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString(), to: null };
    case "custom": {
      const from = filters.from ? new Date(`${filters.from}T00:00:00Z`) : null;
      const to = filters.to ? new Date(`${filters.to}T23:59:59.999Z`) : null;
      return {
        from: from && !Number.isNaN(from.getTime()) ? from.toISOString() : null,
        to: to && !Number.isNaN(to.getTime()) ? to.toISOString() : null,
      };
    }
    default:
      return { from: null, to: null };
  }
}

/** Short human description of the active filters (used in export metadata). */
export function describeFilters(filters: AuditFilters): string {
  const bits: string[] = [];
  if (filters.q) bits.push(`search "${filters.q}"`);
  if (filters.actions.length > 0) bits.push(`${filters.actions.length} action types`);
  if (filters.actorId) bits.push("one actor");
  if (filters.preset !== "all") bits.push(filters.preset);
  return bits.length > 0 ? bits.join(", ") : "no filters";
}
