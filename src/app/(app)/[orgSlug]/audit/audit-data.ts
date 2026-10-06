/**
 * Server-side audit data fetching — shared by the audit page and the CSV
 * export server action so both read the exact same filtered view.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";
import { auditDateRange } from "@/lib/audit/filters";
import {
  AUDIT_EXPORT_MAX_ROWS,
  AUDIT_PAGE_SIZE,
  type ActorInfo,
  type AuditEvent,
  type AuditFilters,
} from "@/lib/audit/types";

type Client = SupabaseClient<Database>;

/** Strips PostgREST filter metacharacters from free text. */
function sanitizeSearch(q: string): string {
  return q.replace(/[%(),"]/g, "").trim().slice(0, 120);
}

export async function fetchAuditEvents(
  supabase: Client,
  orgId: string,
  filters: AuditFilters,
  opts: { forExport?: boolean } = {},
): Promise<{ events: AuditEvent[]; total: number }> {
  const { from, to } = auditDateRange(filters);

  let query = supabase
    .from("audit_log")
    .select("*", { count: "exact" })
    .eq("org_id", orgId);

  if (filters.actions.length > 0) query = query.in("action", filters.actions);
  if (filters.actorId) query = query.eq("actor_id", filters.actorId);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const q = sanitizeSearch(filters.q);
  if (q) {
    // Actor names live in profiles (actor_id → auth.users, not profiles, so
    // no FK join is available): resolve matching profile ids first.
    const { data: matched } = await supabase
      .from("profiles")
      .select("id")
      .ilike("full_name", `%${q}%`)
      .limit(50);
    const ids = (matched ?? []).map((p) => p.id);
    const clauses = [
      `action.ilike.%${q}%`,
      `target_label.ilike.%${q}%`,
      `metadata->>ip.ilike.%${q}%`,
    ];
    if (ids.length > 0) clauses.push(`actor_id.in.(${ids.join(",")})`);
    query = query.or(clauses.join(","));
  }

  query = query.order("created_at", { ascending: false });

  if (opts.forExport) {
    query = query.limit(AUDIT_EXPORT_MAX_ROWS);
  } else {
    const start = (filters.page - 1) * AUDIT_PAGE_SIZE;
    query = query.range(start, start + AUDIT_PAGE_SIZE - 1);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { events: (data ?? []) as AuditEvent[], total: count ?? 0 };
}

/** Resolves actor profiles for a set of events (avatar + name for rows). */
export async function fetchAuditActors(
  supabase: Client,
  events: AuditEvent[],
): Promise<Map<string, ActorInfo>> {
  const ids = [...new Set(events.map((e) => e.actor_id))];
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", ids);
  if (error) throw error;
  return new Map(
    (data ?? []).map((p) => [
      p.id,
      { id: p.id, full_name: p.full_name, avatar_url: p.avatar_url },
    ]),
  );
}

/** Members of the org for the actor filter picker (best-effort: needs members:read). */
export async function fetchAuditActorOptions(
  supabase: Client,
  orgId: string,
): Promise<ActorInfo[]> {
  // memberships.user_id → auth.users has no FK to profiles, so this is two
  // queries rather than a join.
  const { data: memberships, error } = await supabase
    .from("memberships")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .limit(200);
  if (error || !memberships || memberships.length === 0) return [];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in(
      "id",
      memberships.map((m) => m.user_id),
    );
  const options = (profiles ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    avatar_url: p.avatar_url,
  }));
  options.sort((a, b) => a.full_name.localeCompare(b.full_name));
  return options;
}
