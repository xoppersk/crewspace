import { describe, expect, it } from "vitest";

import {
  OrgAccessDeniedError,
  assertOrgAccess,
  roleSatisfies,
  type OrgMembership,
} from "./require-org-access";

const member: OrgMembership = { role: "member", status: "active" };

describe("roleSatisfies", () => {
  it("grants equal and higher roles", () => {
    expect(roleSatisfies("member", "member")).toBe(true);
    expect(roleSatisfies("admin", "member")).toBe(true);
    expect(roleSatisfies("owner", "viewer")).toBe(true);
  });

  it("denies lower roles", () => {
    expect(roleSatisfies("viewer", "member")).toBe(false);
    expect(roleSatisfies("member", "admin")).toBe(false);
  });
});

describe("assertOrgAccess", () => {
  it("returns the membership when active and role is sufficient", () => {
    expect(assertOrgAccess(member, "member", "org-1")).toBe(member);
    expect(assertOrgAccess({ role: "admin", status: "active" }, "member", "org-1")).toEqual({
      role: "admin",
      status: "active",
    });
  });

  it("throws OrgAccessDeniedError when the role is too low", () => {
    expect(() => assertOrgAccess(member, "admin", "org-1")).toThrow(OrgAccessDeniedError);
    try {
      assertOrgAccess(member, "admin", "org-1");
    } catch (error) {
      expect(error).toBeInstanceOf(OrgAccessDeniedError);
      expect((error as OrgAccessDeniedError).orgId).toBe("org-1");
    }
  });

  it("renders not-found (never a 403) for missing or inactive memberships", () => {
    // notFound() throws the NEXT_NOT_FOUND signal — assert it throws rather
    // than leaking the org's existence via a distinct error.
    expect(() => assertOrgAccess(null, "member", "org-1")).toThrow();
    expect(() => assertOrgAccess({ role: "owner", status: "suspended" }, "member", "org-1")).toThrow();
  });
});
