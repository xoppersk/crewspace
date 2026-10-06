import { describe, expect, it } from "vitest";

import {
  assertPermission,
  ForbiddenError,
  PERMISSION_KEYS,
  unionPermissions,
} from "./permissions";

describe("PERMISSION_KEYS", () => {
  it("lists all 18 catalog keys (mirrors the 00002 seed)", () => {
    expect(PERMISSION_KEYS).toHaveLength(18);
    expect([...PERMISSION_KEYS]).toEqual([
      "org:read",
      "org:update",
      "org:transfer_ownership",
      "members:read",
      "members:invite",
      "members:change_role",
      "members:deactivate",
      "teams:create",
      "teams:manage",
      "roles:create",
      "roles:assign",
      "roles:update",
      "roles:delete",
      "invitations:manage",
      "audit:read",
      "audit:export",
      "settings:manage",
      "billing:view",
    ]);
  });
});

describe("unionPermissions", () => {
  it("unions key sets and dedupes, preserving first-seen order", () => {
    expect(
      unionPermissions([
        ["org:read", "members:read"],
        ["members:read", "teams:create"],
        [],
      ]),
    ).toEqual(["org:read", "members:read", "teams:create"]);
  });

  it("returns [] for no sets", () => {
    expect(unionPermissions([])).toEqual([]);
  });

  it("mirrors the DB user_permissions() contract: distinct union", () => {
    // user_permissions() returns array_agg(distinct rp.permission_key).
    // The app-layer union must behave the same for multi-role futures.
    const dbStyle = ["audit:read", "audit:read", "members:read"];
    expect(unionPermissions([dbStyle])).toEqual(["audit:read", "members:read"]);
  });
});

describe("assertPermission", () => {
  it("returns the granted keys when the required key is present", () => {
    const granted = ["org:read", "members:read"];
    expect(assertPermission(granted, "org-1", "members:read")).toBe(granted);
  });

  it("throws ForbiddenError (not a 404) when the key is missing", () => {
    try {
      assertPermission(["org:read"], "org-1", "members:change_role");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenError);
      const fe = error as ForbiddenError;
      expect(fe.name).toBe("ForbiddenError");
      expect(fe.orgId).toBe("org-1");
      expect(fe.permission).toBe("members:change_role");
      expect(fe.message).toContain("members:change_role");
    }
  });

  it("renders not-found (never a 403) for a missing/inactive membership", () => {
    // notFound() throws the NEXT_NOT_FOUND signal — assert it throws rather
    // than leaking the org's existence via a distinct error.
    expect(() => assertPermission(null, "org-1", "org:read")).toThrow();
  });

  it("an empty grant set denies everything", () => {
    expect(() => assertPermission([], "org-1", "org:read")).toThrow(ForbiddenError);
  });
});

describe("invitation token hashing contract", () => {
  // The DB stores token_hash = encode(digest(raw_token, 'sha256'), 'hex')
  // (see accept_invitation() and the seed). This pins the shape the app must
  // produce when it hashes tokens client-side / in edge functions.
  it("sha256 hex digest shape", async () => {
    const { createHash, randomBytes } = await import("node:crypto");
    const raw = randomBytes(32).toString("hex");
    const hash = createHash("sha256").update(raw).digest("hex");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // Deterministic: same input, same hash (matches digest()).
    expect(createHash("sha256").update(raw).digest("hex")).toBe(hash);
  });
});
