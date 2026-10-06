import { describe, expect, it } from "vitest";

import {
  buildTrackPayload,
  isPresenceStale,
  mapPresenceState,
  mergePresence,
  presenceCount,
  PRESENCE_HEARTBEAT_MS,
} from "./mapping";

describe("mapPresenceState", () => {
  const now = 1_000_000;

  it("normalizes tracked payloads keyed by user id", () => {
    const state = {
      "key-1": [
        { user_id: "u1", full_name: "Maya Chen", avatar_url: null, status: "online" },
      ],
      "key-2": [
        { user_id: "u2", full_name: "Luis Gomez", avatar_url: "https://x/y.png", status: "away" },
      ],
    };
    const members = mapPresenceState(state, now);
    expect(presenceCount(members)).toBe(2);
    expect(members.get("u1")).toMatchObject({
      userId: "u1",
      fullName: "Maya Chen",
      avatarUrl: null,
      status: "online",
      trackedAt: now,
    });
    expect(members.get("u2")?.status).toBe("away");
  });

  it("collapses multiple connections from one user to a single entry", () => {
    const state = {
      a: [{ user_id: "u1", full_name: "Maya", avatar_url: null, status: "online" }],
      b: [{ user_id: "u1", full_name: "Maya", avatar_url: null, status: "online" }],
    };
    expect(presenceCount(mapPresenceState(state, now))).toBe(1);
  });

  it("drops malformed payloads and defaults unknown statuses to online", () => {
    const state = {
      good: [{ user_id: "u1", full_name: "Maya", avatar_url: null, status: "napping" }],
      bad: [{ full_name: "No id" }],
      worse: [null],
    };
    const members = mapPresenceState(state as never, now);
    expect(presenceCount(members)).toBe(1);
    expect(members.get("u1")?.status).toBe("online");
  });
});

describe("mergePresence", () => {
  it("drops users who left the channel", () => {
    const previous = mapPresenceState(
      { a: [{ user_id: "u1", full_name: "Maya", avatar_url: null, status: "online" }] },
      1,
    );
    const merged = mergePresence(
      previous,
      { b: [{ user_id: "u2", full_name: "Luis", avatar_url: null, status: "online" }] },
      2,
    );
    expect([...merged.keys()]).toEqual(["u2"]);
  });
});

describe("isPresenceStale", () => {
  it("flags entries older than 3 heartbeats", () => {
    const now = 10_000_000;
    expect(isPresenceStale(now - PRESENCE_HEARTBEAT_MS * 3 - 1, now)).toBe(true);
    expect(isPresenceStale(now - PRESENCE_HEARTBEAT_MS * 2, now)).toBe(false);
  });
});

describe("buildTrackPayload", () => {
  it("builds the join/heartbeat payload", () => {
    expect(
      buildTrackPayload({ userId: "u1", fullName: "Maya Chen", avatarUrl: null }),
    ).toEqual({
      user_id: "u1",
      full_name: "Maya Chen",
      avatar_url: null,
      status: "online",
    });
  });
});
