"use client";

import { useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { ActorInfo, AuditEvent } from "@/lib/audit/types";

/**
 * Live tail for the audit log: subscribes to Postgres Changes on audit_log
 * (org_id = this org, INSERT only — the table is append-only anyway).
 *
 * The hook only resolves and prepends; the view decides when to show new
 * rows (clean filters + page 1 + near the top) versus a "N new events" pill
 * (filtered views, scrolled down, or explicitly paused).
 *
 * Mount only where the viewer holds `audit:read` — the audit page gates
 * this at the server layer, so the subscription can't be mounted by
 * permission-less viewers.
 */
export function useAuditLiveTail({
  orgId,
  enabled,
}: {
  orgId: string;
  enabled: boolean;
}): {
  liveEvents: AuditEvent[];
  liveActors: Map<string, ActorInfo>;
  pendingCount: number;
  paused: boolean;
  setPaused: (paused: boolean) => void;
  consumePending: () => void;
} {
  const [liveEvents, setLiveEvents] = useState<AuditEvent[]>([]);
  const [liveActors, setLiveActors] = useState<Map<string, ActorInfo>>(new Map());
  const [pendingCount, setPendingCount] = useState(0);
  const [paused, setPaused] = useState(false);
  const seenIds = useRef(new Set<string>());

  useEffect(() => {
    if (!enabled) return;
    const supabase = createClient();
    let cancelled = false;

    const channel = supabase
      .channel(`audit-tail:${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "audit_log",
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => {
          void (async () => {
            const row = payload.new as AuditEvent;
            if (cancelled || seenIds.current.has(row.id)) return;
            seenIds.current.add(row.id);
            // Resolve the actor before showing the row so the sentence is complete.
            const { data: profile } = await supabase
              .from("profiles")
              .select("id, full_name, avatar_url")
              .eq("id", row.actor_id)
              .maybeSingle();
            if (cancelled) return;
            if (profile) {
              setLiveActors((prev) => {
                const next = new Map(prev);
                next.set(profile.id, {
                  id: profile.id,
                  full_name: profile.full_name,
                  avatar_url: profile.avatar_url,
                });
                return next;
              });
            }
            setLiveEvents((prev) => [row, ...prev].slice(0, 50));
            setPendingCount((count) => count + 1);
          })();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [orgId, enabled]);

  function consumePending() {
    setPendingCount(0);
  }

  return { liveEvents, liveActors, pendingCount, paused, setPaused, consumePending };
}
