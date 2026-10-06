import { describe, expect, it } from "vitest";

import {
  AUDIT_CSV_HEADERS,
  auditEventsToCsv,
  auditEventToCsvRow,
  csvEscape,
} from "./csv";
import type { ActorInfo, AuditEvent } from "./types";

function event(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: "e1",
    org_id: "o1",
    actor_id: "u1",
    action: "membership.role_changed",
    target_type: "membership",
    target_id: "m1",
    target_label: 'Luis "LG" Gomez',
    diff: { role: { from: "Member", to: "Manager" } },
    metadata: { ip: "203.0.113.7", request_id: "req-123" },
    created_at: "2026-10-06T18:00:00.000Z",
    ...overrides,
  };
}

describe("csvEscape", () => {
  it("leaves plain values alone", () => {
    expect(csvEscape("hello")).toBe("hello");
  });

  it("quotes values containing commas, quotes, or newlines", () => {
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
  });

  it("treats null/undefined as empty", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });
});

describe("auditEventToCsvRow", () => {
  it("maps columns in header order with the human-readable sentence", () => {
    const row = auditEventToCsvRow(event(), "Maya Chen");
    expect(row).toEqual([
      "2026-10-06T18:00:00.000Z",
      "Maya Chen",
      "membership.role_changed",
      "Maya Chen changed Luis \"LG\" Gomez's role from Member to Manager",
      'Luis "LG" Gomez',
      "membership",
      "203.0.113.7",
      "req-123",
    ]);
    expect(row).toHaveLength(AUDIT_CSV_HEADERS.length);
  });

  it("renders empty cells for missing actor, target, and metadata", () => {
    const row = auditEventToCsvRow(
      event({ target_label: null, target_type: null, metadata: {} }),
      null,
    );
    expect(row[1]).toBe("");
    expect(row[3]).toContain("Someone");
    expect(row[4]).toBe("");
    expect(row[6]).toBe("");
    expect(row[7]).toBe("");
  });
});

describe("auditEventsToCsv", () => {
  it("emits the header plus one escaped row per event", () => {
    const actors = new Map<string, ActorInfo>([
      ["u1", { id: "u1", full_name: "Maya Chen", avatar_url: null }],
    ]);
    const csv = auditEventsToCsv([event(), event({ id: "e2", action: "team.created" })], actors);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(AUDIT_CSV_HEADERS.join(","));
    expect(lines).toHaveLength(4); // header + 2 rows + trailing newline
    expect(lines[1]).toContain("Maya Chen changed");
    expect(lines[1]).toContain('"Luis ""LG"" Gomez"'); // target cell escaped
    expect(lines[2]).toContain("team.created");
  });

  it("leaves the actor cell blank when the actor profile is unknown", () => {
    const csv = auditEventsToCsv([event()], new Map());
    const row = csv.split("\r\n")[1] ?? "";
    expect(row.split(",")[1]).toBe("");
  });
});
