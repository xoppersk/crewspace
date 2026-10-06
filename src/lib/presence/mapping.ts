/**
 * Presence payload mapping (pure). The Supabase Realtime presence channel
 * (`presence:org:{orgId}`) tracks `{ user_id, full_name, avatar_url, status }`
 * per connection; `presenceState()` returns `{ presenceKey: PresencePayload[] }`.
 * This module normalizes that into a Map keyed by user id — the shape the
 * `usePresence()` hook and the tests share.
 */

export type PresenceStatus = "online" | "away" | "busy";

export interface PresencePayload {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  status: PresenceStatus;
}

export interface OnlineMember {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  status: PresenceStatus;
  /** When this presence entry was last seen (epoch ms). */
  trackedAt: number;
}

const VALID_STATUSES: PresenceStatus[] = ["online", "away", "busy"];

function sanitizePayload(raw: unknown): PresencePayload | null {
  if (typeof raw !== "object" || raw === null) return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.user_id !== "string" || p.user_id.length === 0) return null;
  const status = VALID_STATUSES.includes(p.status as PresenceStatus)
    ? (p.status as PresenceStatus)
    : "online";
  return {
    user_id: p.user_id,
    full_name: typeof p.full_name === "string" ? p.full_name : "Someone",
    avatar_url: typeof p.avatar_url === "string" ? p.avatar_url : null,
    status,
  };
}

/**
 * Normalize a Realtime presence state into online members keyed by user id.
 * A user with multiple connections (tabs) collapses to one entry, keeping
 * the most recently tracked payload. Pure.
 */
export function mapPresenceState(
  state: Record<string, unknown[]>,
  nowMs: number = Date.now(),
): Map<string, OnlineMember> {
  const out = new Map<string, OnlineMember>();
  for (const payloads of Object.values(state)) {
    for (const raw of payloads) {
      const p = sanitizePayload(raw);
      if (!p) continue;
      // One entry per user; later payloads in the state win.
      out.set(p.user_id, {
        userId: p.user_id,
        fullName: p.full_name,
        avatarUrl: p.avatar_url,
        status: p.status,
        trackedAt: nowMs,
      });
    }
  }
  return out;
}

/**
 * Merge a fresh state into the previous map: entries missing from the new
 * state are dropped (left the channel), present ones are refreshed. Pure.
 */
export function mergePresence(
  previous: Map<string, OnlineMember>,
  state: Record<string, unknown[]>,
  nowMs: number = Date.now(),
): Map<string, OnlineMember> {
  const fresh = mapPresenceState(state, nowMs);
  // Only ever shrink to what the channel reports; stale leftovers vanish.
  void previous;
  return fresh;
}

/** Number of distinct users currently online. Pure. */
export function presenceCount(members: Map<string, OnlineMember>): number {
  return members.size;
}

/**
 * A presence entry is stale when no heartbeat arrived within 3× the 15s
 * heartbeat interval. Pure — lets the UI hide ghosts without waiting for a
 * channel event.
 */
export const PRESENCE_HEARTBEAT_MS = 15_000;

export function isPresenceStale(trackedAt: number, nowMs: number = Date.now()): boolean {
  return nowMs - trackedAt > PRESENCE_HEARTBEAT_MS * 3;
}

/** Payload the provider tracks on join + every heartbeat. */
export function buildTrackPayload(opts: {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
}): PresencePayload {
  return {
    user_id: opts.userId,
    full_name: opts.fullName,
    avatar_url: opts.avatarUrl,
    status: "online",
  };
}
