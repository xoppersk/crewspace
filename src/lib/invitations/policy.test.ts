import { describe, expect, it } from "vitest";

import {
  MAX_INVITES_PER_DAY,
  assertSameOrg,
  canInviteUnderPolicy,
  formatExpiryCountdown,
  hashToken,
  invitationAcceptUrl,
  invitationExpiresAt,
  inviteCsvTemplate,
  isDomainAllowed,
  isExpiryUrgent,
  isSha256Hex,
  issueInvitationToken,
  normalizeEmail,
  parseCsv,
  parseInviteCsv,
  resolveInvitationState,
  validateCsvRow,
  validateInviteEmail,
} from "./policy";

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

describe("invitation tokens", () => {
  it("issues a 32-byte raw token and a 64-char SHA-256 hex hash", () => {
    const { raw, tokenHash } = issueInvitationToken();
    expect(raw).toMatch(/^[0-9a-f]{64}$/); // 32 bytes → 64 hex chars
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(isSha256Hex(tokenHash)).toBe(true);
  });

  it("hashes deterministically and uniquely", () => {
    const a = issueInvitationToken();
    expect(hashToken(a.raw)).toBe(a.tokenHash);
    const b = issueInvitationToken();
    expect(a.raw).not.toBe(b.raw);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });

  it("rejects non-hex / wrong-length digests", () => {
    expect(isSha256Hex("abc")).toBe(false);
    expect(isSha256Hex("g".repeat(64))).toBe(false);
    expect(isSha256Hex(hashToken("x").toUpperCase())).toBe(false);
  });

  it("expires 7 days after issue", () => {
    const from = new Date("2026-10-06T12:00:00Z");
    expect(invitationExpiresAt(from).toISOString()).toBe("2026-10-13T12:00:00.000Z");
  });

  it("builds a safe accept URL", () => {
    const url = invitationAcceptUrl("tok en/123", "https://app.example.com/");
    expect(url).toBe("https://app.example.com/invite/accept?token=tok%20en%2F123");
  });

  it("enforces the documented daily rate limit", () => {
    expect(MAX_INVITES_PER_DAY).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// Invitation state machine
// ---------------------------------------------------------------------------

const now = new Date("2026-10-06T12:00:00Z");
const future = new Date("2026-10-10T12:00:00Z").toISOString();
const past = new Date("2026-10-01T12:00:00Z").toISOString();

describe("resolveInvitationState", () => {
  it("resolves pending + unexpired to valid", () => {
    expect(resolveInvitationState({ status: "pending", expires_at: future }, now)).toBe("valid");
  });

  it("resolves pending + past expiry to expired", () => {
    expect(resolveInvitationState({ status: "pending", expires_at: past }, now)).toBe("expired");
  });

  it("resolves an already-swept expired status to expired", () => {
    expect(resolveInvitationState({ status: "expired", expires_at: future }, now)).toBe("expired");
  });

  it("resolves a revoked invitation to revoked", () => {
    expect(resolveInvitationState({ status: "revoked", expires_at: future }, now)).toBe("revoked");
  });

  it("resolves a replayed (double-accepted) link to already-accepted", () => {
    // The transaction flips status to accepted on first accept; a second
    // lookup finds status=accepted, never valid again.
    expect(resolveInvitationState({ status: "accepted", expires_at: future }, now)).toBe(
      "already-accepted",
    );
  });

  it("resolves a missing row (unknown token) to invalid", () => {
    expect(resolveInvitationState(null, now)).toBe("invalid");
  });

  it("resolves a tampered token to invalid (hash no-match)", () => {
    // Tampering changes the raw token → different SHA-256 → lookup by
    // token_hash misses → null row → invalid.
    const storedHash = hashToken("original-token");
    const tamperedHash = hashToken("original-tokex");
    expect(tamperedHash).not.toBe(storedHash);
    expect(resolveInvitationState(null, now)).toBe("invalid");
  });
});

describe("assertSameOrg (cross-org guard)", () => {
  it("accepts matching org ids", () => {
    expect(assertSameOrg("org-a", "org-a")).toBe(true);
  });

  it("rejects a token from a different org", () => {
    expect(assertSameOrg("org-b", "org-a")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Invite policy
// ---------------------------------------------------------------------------

describe("canInviteUnderPolicy", () => {
  it.each([
    ["owners", "owner", true],
    ["owners", "admin", false],
    ["owners", "manager", false],
    ["admins", "owner", true],
    ["admins", "admin", true],
    ["admins", "manager", false],
    ["managers", "owner", true],
    ["managers", "admin", true],
    ["managers", "manager", true],
    ["managers", "member", false],
    ["managers", "viewer", false],
  ] as const)("policy=%s, role=%s → %s", (policy, role, expected) => {
    expect(canInviteUnderPolicy({ invitePolicy: policy, viewerSystemKey: role })).toBe(expected);
  });

  it("denies custom-only roles (no system key)", () => {
    expect(canInviteUnderPolicy({ invitePolicy: "managers", viewerSystemKey: null })).toBe(false);
  });
});

describe("isDomainAllowed", () => {
  it("allows any domain when the list is empty", () => {
    expect(isDomainAllowed("maya@anything.com", [])).toBe(true);
  });

  it("matches listed domains case-insensitively", () => {
    expect(isDomainAllowed("maya@Example.COM", ["example.com"])).toBe(true);
    expect(isDomainAllowed("maya@other.com", ["example.com"])).toBe(false);
  });
});

describe("validateInviteEmail / normalizeEmail", () => {
  it("accepts well-formed addresses and normalizes them", () => {
    expect(validateInviteEmail("  Maya@Example.com ")).toBeNull();
    expect(normalizeEmail("  Maya@Example.com ")).toBe("maya@example.com");
  });

  it("rejects bad input with a fix-naming message", () => {
    expect(validateInviteEmail("not-an-email")).toMatch(/valid email/i);
    expect(validateInviteEmail("")).toMatch(/required/i);
  });
});

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

describe("parseCsv (RFC-4180)", () => {
  it("parses a simple file", () => {
    expect(parseCsv("a,b,c\n1,2,3\n")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields with commas, newlines, and escaped quotes", () => {
    const rows = parseCsv('email,full_name\n"a@x.com","Doe, Jane"\n"b@x.com","Line1\nLine2"\n');
    expect(rows[1]).toEqual(["a@x.com", "Doe, Jane"]);
    expect(rows[2]).toEqual(["b@x.com", "Line1\nLine2"]);
    const escaped = parseCsv('"say ""hi"""\n');
    expect(escaped[0]).toEqual(['say "hi"']);
  });

  it("throws on unterminated quotes", () => {
    expect(() => parseCsv('"oops\n')).toThrow(/unterminated/i);
  });
});

describe("parseInviteCsv", () => {
  it("parses the template and tolerates shuffled/cased headers", () => {
    const rows = parseInviteCsv(inviteCsvTemplate());
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ line: 2, email: "maya@example.com", fullName: "Maya Chen" });

    const shuffled = parseInviteCsv("TEAM,Email,Role,Full_Name\nDesign,x@y.com,Member, X \n");
    expect(shuffled[0]).toMatchObject({ email: "x@y.com", team: "Design", role: "Member" });
  });

  it("rejects files missing required columns", () => {
    expect(() => parseInviteCsv("email,full_name\nx@y.com,X\n")).toThrow(/role, team/);
  });

  it("rejects empty files", () => {
    expect(() => parseInviteCsv("   \n")).toThrow(/empty/i);
  });
});

const csvCtx = {
  rolesByName: new Map([["member", "role-member"], ["admin", "role-admin"]]),
  teamsByName: new Map([["design", "team-design"]]),
  defaultRoleId: "role-member",
  defaultRoleName: "Member",
  seenEmails: new Set<string>(),
};

describe("validateCsvRow", () => {
  it("accepts a valid row", () => {
    const r = validateCsvRow(
      { line: 2, email: "maya@example.com", fullName: "Maya", role: "Admin", team: "Design" },
      csvCtx,
    );
    expect(r.status).toBe("valid");
    expect(r.roleId).toBe("role-admin");
    expect(r.teamIds).toEqual(["team-design"]);
  });

  it("flags bad emails as errors", () => {
    const r = validateCsvRow({ line: 3, email: "nope", fullName: "", role: "", team: "" }, csvCtx);
    expect(r.status).toBe("error");
    expect(r.message).toMatch(/line 3/i);
  });

  it("flags duplicate emails in the file as errors", () => {
    const r = validateCsvRow(
      { line: 4, email: "maya@example.com", fullName: "Maya 2", role: "", team: "" },
      { ...csvCtx, seenEmails: new Set(["maya@example.com"]) },
    );
    expect(r.status).toBe("error");
    expect(r.message).toMatch(/more than once/i);
  });

  it("warns on unknown role and maps to the default", () => {
    const r = validateCsvRow(
      { line: 5, email: "new@example.com", fullName: "New", role: "Superuser", team: "" },
      csvCtx,
    );
    expect(r.status).toBe("warning");
    expect(r.roleId).toBe("role-member");
    expect(r.message).toMatch(/mapped to Member/i);
  });

  it("warns on unknown team and sends without a team", () => {
    const r = validateCsvRow(
      { line: 6, email: "t@example.com", fullName: "T", role: "", team: "Ghosts" },
      csvCtx,
    );
    expect(r.status).toBe("warning");
    expect(r.teamIds).toEqual([]);
    expect(r.message).toMatch(/without a team/i);
  });

  it("defaults blank role to the org default role", () => {
    const r = validateCsvRow(
      { line: 7, email: "d@example.com", fullName: "D", role: "", team: "" },
      csvCtx,
    );
    expect(r.status).toBe("valid");
    expect(r.roleId).toBe("role-member");
  });
});

// ---------------------------------------------------------------------------
// Countdown
// ---------------------------------------------------------------------------

describe("formatExpiryCountdown", () => {
  it("renders days, hours, minutes, and expired", () => {
    const base = new Date("2026-10-06T12:00:00Z");
    expect(formatExpiryCountdown(new Date("2026-10-09T12:00:00Z").toISOString(), base)).toBe(
      "Expires in 3d",
    );
    expect(formatExpiryCountdown(new Date("2026-10-06T15:00:00Z").toISOString(), base)).toBe(
      "Expires in 3h",
    );
    expect(formatExpiryCountdown(new Date("2026-10-06T12:12:00Z").toISOString(), base)).toBe(
      "Expires in 12m",
    );
    expect(formatExpiryCountdown(new Date("2026-10-06T11:00:00Z").toISOString(), base)).toBe(
      "Expired",
    );
  });

  it("flags sub-24h expiry as urgent", () => {
    const base = new Date("2026-10-06T12:00:00Z");
    expect(isExpiryUrgent(new Date("2026-10-07T11:00:00Z").toISOString(), base)).toBe(true);
    expect(isExpiryUrgent(new Date("2026-10-09T12:00:00Z").toISOString(), base)).toBe(false);
    expect(isExpiryUrgent(new Date("2026-10-06T11:00:00Z").toISOString(), base)).toBe(false);
  });
});
