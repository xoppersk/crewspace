"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import {
  buildTrackPayload,
  isPresenceStale,
  mergePresence,
  PRESENCE_HEARTBEAT_MS,
  type OnlineMember,
} from "@/lib/presence/mapping";

interface PresenceContextValue {
  /** Online members keyed by user id (stale entries pruned). */
  online: Map<string, OnlineMember>;
  onlineCount: number;
  isOnline: (userId: string) => boolean;
}

const PresenceContext = createContext<PresenceContextValue>({
  online: new Map(),
  onlineCount: 0,
  isOnline: () => false,
});

export function usePresence(): PresenceContextValue {
  return useContext(PresenceContext);
}

/**
 * PresenceProvider — subscribes to the org presence channel
 * (`presence:org:{orgId}`) and tracks `{ user_id, full_name, avatar_url,
 * status }` with a 15s heartbeat. Mounted lazily (dynamic import, ssr: false)
 * in the [orgSlug] layout so the app shell bundle stays lean; the layout
 * only mounts it when the viewer holds `members:read`.
 */
export function PresenceProvider({
  orgId,
  userId,
  fullName,
  avatarUrl,
  children,
}: {
  orgId: string;
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  children: React.ReactNode;
}) {
  const [online, setOnline] = useState<Map<string, OnlineMember>>(new Map());

  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const sync = () => {
      if (!channel || cancelled) return;
      const state = channel.presenceState() as Record<string, unknown[]>;
      setOnline((prev) => mergePresence(prev, state));
    };

    channel = supabase.channel(`presence:org:${orgId}`, {
      config: { presence: { key: userId } },
    });

    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe(async (status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          await channel?.track(buildTrackPayload({ userId, fullName, avatarUrl }));
          sync();
          // 15s heartbeat: re-track so the server (and peers) see us as live.
          heartbeat = setInterval(() => {
            void channel?.track(buildTrackPayload({ userId, fullName, avatarUrl }));
          }, PRESENCE_HEARTBEAT_MS);
        }
      });

    return () => {
      cancelled = true;
      if (heartbeat) clearInterval(heartbeat);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [orgId, userId, fullName, avatarUrl]);

  const isOnline = useCallback(
    (id: string) => {
      const entry = online.get(id);
      return !!entry && !isPresenceStale(entry.trackedAt);
    },
    [online],
  );

  const value = useMemo<PresenceContextValue>(() => {
    // Prune stale entries (ghosts whose heartbeat stopped) on each sync.
    const pruned = new Map<string, OnlineMember>();
    for (const [id, entry] of online) {
      if (!isPresenceStale(entry.trackedAt)) pruned.set(id, entry);
    }
    return { online: pruned, onlineCount: pruned.size, isOnline };
  }, [online, isOnline]);

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}
