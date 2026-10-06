"use client";

import { useEffect, useState } from "react";

import { formatLocalTime } from "@/lib/datetime";

/**
 * LocalTime — renders the current time in a member's timezone, ticking
 * every minute. Client-rendered so it uses the viewer's locale formatting.
 */
export function LocalTime({ timezone }: { timezone: string }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  return <span className="tabular-nums">{formatLocalTime(timezone, now)}</span>;
}
