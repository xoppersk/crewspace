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
