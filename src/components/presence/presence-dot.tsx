"use client";

import { cn } from "@/lib/utils";
import { usePresence } from "./presence-provider";

/**
 * PresenceDot — green dot for online users, hidden otherwise. The "online"
 * label is sr-only so status is never color-alone (a11y).
 */
export function PresenceDot({
  userId,
  className,
}: {
  userId: string;
  className?: string;
}) {
  const { isOnline } = usePresence();
  if (!isOnline(userId)) return null;
  return (
    <span
      className={cn(
        "inline-flex size-2.5 shrink-0 items-center justify-center rounded-full bg-success ring-2 ring-background",
        className,
      )}
      aria-hidden="true"
    >
      <span className="sr-only">online</span>
    </span>
  );
}
