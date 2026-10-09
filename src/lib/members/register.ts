/**
 * Numbered civic register (Flagship UI Designs artifact — "Crewspace uses a
 * numbered civic register across every section").
 *
 * A member's register number is their 1-based position in the org's
 * membership ordered by join date, zero-padded to 3 digits ("042").
 * Pure — unit-testable without a database.
 */

/** 42 → "042". Clamps to a minimum of 1. */
export function formatRegisterNo(n: number): string {
  return String(Math.max(1, Math.floor(n))).padStart(3, "0");
}

/**
 * Assigns register numbers to membership ids given oldest-first
 * (join-date order). Returns membershipId → 1-based number.
 */
export function assignRegisterNumbers(idsInJoinOrder: string[]): Map<string, number> {
  const map = new Map<string, number>();
  idsInJoinOrder.forEach((id, index) => {
    if (!map.has(id)) map.set(id, index + 1);
  });
  return map;
}
