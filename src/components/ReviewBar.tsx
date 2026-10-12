"use client";

import { Button } from "./Button";

/**
 * Sticky dark bar at the bottom of the register sheet whenever changes are
 * pending: count, people affected, and that nothing applies until review.
 */
export function ReviewBar({
  count,
  affects,
  onDiscard,
  onReview,
}: {
  count: number;
  /** e.g. "affects 5 members" */
  affects: string;
  onDiscard: () => void;
  onReview: () => void;
}) {
  if (count === 0) return null;
  return (
    <div role="region" aria-label="Pending changes" className="reviewbar">
      <span>
        <b style={{ fontWeight: 600 }}>
          {count} change{count === 1 ? "" : "s"} ready
        </b>{" "}
        <span className="sub">
          · {affects} · nothing changes until you apply
        </span>
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="on-dark" onClick={onDiscard}>
          Discard
        </Button>
        <Button variant="white" onClick={onReview}>
          Review changes
        </Button>
      </div>
    </div>
  );
}
