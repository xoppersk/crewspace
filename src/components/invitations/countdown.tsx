"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { formatExpiryCountdown, isExpiryUrgent } from "@/lib/invitations/policy";

/**
 * Live expiry chip for invitations. Ticks every 30s; turns red under 24h.
 * Pure formatting lives in policy.ts (unit-tested); this is just the clock.
 */
export function ExpiryCountdown({
  expiresAt,
  className,
}: {
  expiresAt: string;
  className?: string;
}) {
  const [, forceTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const urgent = isExpiryUrgent(expiresAt);
  const label = formatExpiryCountdown(expiresAt);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        urgent ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
        className,
      )}
      title={new Date(expiresAt).toLocaleString()}
    >
      {label}
    </span>
  );
}
