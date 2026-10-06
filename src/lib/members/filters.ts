/**
 * Directory filter parsing + pure query-clause builders.
 *
 * The page (Server Component) calls `parseDirectoryFilters()` on the URL
 * search params, then `buildDirectoryClauses()` to get a serializable,
 * framework-free description of the query. `applyDirectoryClauses()` binds
 * those clauses to a Supabase query builder. Everything testable lives in
 * the pure functions above; this file intentionally contains no I/O.
 */

export type MemberStatusFilter = "all" | "active" | "deactivated";
export type MemberSortKey = "name" | "recent" | "newest";

/** Server-paginated page size for the directory table. */
export const DIRECTORY_PAGE_SIZE = 25;

export interface DirectoryFilters {
  q: string;
  /** Team uuid, or "all". */
  teamId: string;
  /** Role uuid, or "all". */
  roleId: string;
  status: MemberStatusFilter;
  /** Presence-based; applied client-side on the fetched page. */
  onlineOnly: boolean;
  sort: MemberSortKey;
  page: number;
}

const STATUS_VALUES: MemberStatusFilter[] = ["all", "active", "deactivated"];
const SORT_VALUES: MemberSortKey[] = ["name", "recent", "newest"];

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

/** Parse + validate raw URL search params into typed filters. Pure. */
export function parseDirectoryFilters(
  sp: Record<string, string | string[] | undefined>,
): DirectoryFilters {
  const rawPage = Number.parseInt(first(sp.page), 10);
  const rawStatus = first(sp.status) as MemberStatusFilter;
  const rawSort = first(sp.sort) as MemberSortKey;
  return {
    q: first(sp.q).trim().replace(/,/g, "").slice(0, 80),
    teamId: first(sp.team) || "all",
    roleId: first(sp.role) || "all",
    status: STATUS_VALUES.includes(rawStatus) ? rawStatus : "all",
    onlineOnly: first(sp.online) === "1",
    sort: SORT_VALUES.includes(rawSort) ? rawSort : "name",
    page: Number.isFinite(rawPage) && rawPage > 0 ? Math.min(rawPage, 10_000) : 1,
  };
}

/** Serializable description of one query predicate. Pure. */
export type DirectoryClause =
  | { type: "search"; pattern: string }
  | { type: "role"; roleId: string }
  | { type: "isActive"; value: boolean }
  | { type: "team"; teamId: string }
  | {
      type: "order";
      column: "name" | "last_active_at" | "joined_at";
      ascending: boolean;
    };

/**
 * Build the clause list from validated filters. Pure — the unit tests assert
 * this mapping without a database.
 *
 * The search clause targets `full_name`, `title`, and `email`
 * (profiles.email, citext, added in 00013 — visible under the profile row's
 * own RLS, so no extra policy is needed).
 */
export function buildDirectoryClauses(filters: DirectoryFilters): DirectoryClause[] {
  const clauses: DirectoryClause[] = [];

  if (filters.q) {
    const escaped = filters.q.replace(/[%_\\]/g, (c) => `\\${c}`);
    clauses.push({ type: "search", pattern: `%${escaped}%` });
  }
  if (filters.roleId !== "all") clauses.push({ type: "role", roleId: filters.roleId });
  if (filters.status !== "all")
    clauses.push({ type: "isActive", value: filters.status === "active" });
  if (filters.teamId !== "all") clauses.push({ type: "team", teamId: filters.teamId });

  switch (filters.sort) {
    case "name":
      clauses.push({ type: "order", column: "name", ascending: true });
      break;
    case "recent":
      clauses.push({ type: "order", column: "last_active_at", ascending: false });
      break;
    case "newest":
      clauses.push({ type: "order", column: "joined_at", ascending: false });
      break;
  }
  return clauses;
}

/** Inclusive [from, to] row range for `.range()`. Pure. */
export function directoryPageRange(page: number): { from: number; to: number } {
  const from = (page - 1) * DIRECTORY_PAGE_SIZE;
  return { from, to: from + DIRECTORY_PAGE_SIZE - 1 };
}

/** Human summary of the active filters for the results line. Pure. */
export function describeDirectoryFilters(
  filters: DirectoryFilters,
  teamName?: string,
  roleName?: string,
): string {
  const parts: string[] = [];
  if (filters.q) parts.push(`matching “${filters.q}”`);
  if (filters.teamId !== "all") parts.push(`in ${teamName ?? "team"}`);
  if (filters.roleId !== "all") parts.push(`with role ${roleName ?? "role"}`);
  if (filters.status !== "all") parts.push(filters.status);
  if (filters.onlineOnly) parts.push("online now");
  return parts.length > 0 ? parts.join(" · ") : "all members";
}
