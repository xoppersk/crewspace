/**
 * Permission-diff computation for the role detail "Review changes" bar.
 * Pure — unit-testable without a database.
 */

export interface PermissionDiff {
  /** Keys present in `next` but not in `baseline` (sorted). */
  added: string[];
  /** Keys present in `baseline` but not in `next` (sorted). */
  removed: string[];
}

/**
 * Computes the added/removed permission keys between a role's saved set
 * (`baseline`) and its edited set (`next`). Dedupes both inputs and sorts
 * the outputs for stable rendering.
 */
export function diffPermissionKeys(baseline: string[], next: string[]): PermissionDiff {
  const before = new Set(baseline);
  const after = new Set(next);
  const added = [...after].filter((key) => !before.has(key)).sort();
  const removed = [...before].filter((key) => !after.has(key)).sort();
  return { added, removed };
}

/** True when nothing changed — the review bar stays hidden. */
export function isDiffEmpty(diff: PermissionDiff): boolean {
  return diff.added.length === 0 && diff.removed.length === 0;
}

/**
 * Tri-state permission decisions (Flagship UI Designs artifact — the
 * register's Allow / Deny / Inherit control).
 */
export type PermissionState = "allow" | "deny" | "inherit";

export interface PermissionDecisions {
  allow: string[];
  deny: string[];
}

/** Splits a key → state record into sorted allow/deny key lists. */
export function decisionsFromStates(
  states: Record<string, PermissionState>,
): PermissionDecisions {
  const allow = Object.entries(states)
    .filter(([, state]) => state === "allow")
    .map(([key]) => key)
    .sort();
  const deny = Object.entries(states)
    .filter(([, state]) => state === "deny")
    .map(([key]) => key)
    .sort();
  return { allow, deny };
}

/** Builds a key → state record from saved allow/deny key lists. */
export function statesFromDecisions(decisions: PermissionDecisions): Record<string, PermissionState> {
  const states: Record<string, PermissionState> = {};
  for (const key of decisions.allow) states[key] = "allow";
  for (const key of decisions.deny) states[key] = "deny";
  return states;
}

export interface PermissionStateDiff {
  allowAdded: string[];
  allowRemoved: string[];
  denyAdded: string[];
  denyRemoved: string[];
}

/** Diffs two tri-state decision sets (sorted outputs, stable rendering). */
export function diffPermissionStates(
  baseline: PermissionDecisions,
  next: PermissionDecisions,
): PermissionStateDiff {
  const beforeAllow = new Set(baseline.allow);
  const afterAllow = new Set(next.allow);
  const beforeDeny = new Set(baseline.deny);
  const afterDeny = new Set(next.deny);
  return {
    allowAdded: [...afterAllow].filter((k) => !beforeAllow.has(k)).sort(),
    allowRemoved: [...beforeAllow].filter((k) => !afterAllow.has(k)).sort(),
    denyAdded: [...afterDeny].filter((k) => !beforeDeny.has(k)).sort(),
    denyRemoved: [...beforeDeny].filter((k) => !afterDeny.has(k)).sort(),
  };
}

/** True when no allow/deny decision changed — the review bar stays hidden. */
export function isStateDiffEmpty(diff: PermissionStateDiff): boolean {
  return (
    diff.allowAdded.length === 0 &&
    diff.allowRemoved.length === 0 &&
    diff.denyAdded.length === 0 &&
    diff.denyRemoved.length === 0
  );
}

/**
 * Plain-language summary for the review bar, e.g. "+2 added, −1 removed".
 * Always pairs counts with words — status is never color-alone.
 */
export function diffSummary(diff: PermissionDiff): string {
  const parts: string[] = [];
  if (diff.added.length > 0) {
    parts.push(`+${diff.added.length} added`);
  }
  if (diff.removed.length > 0) {
    parts.push(`−${diff.removed.length} removed`);
  }
  return parts.length > 0 ? parts.join(", ") : "No changes";
}
