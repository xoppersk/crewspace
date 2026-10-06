import { describe, expect, it } from "vitest";

import { computeDeactivationEffect, summarizeBulkAction } from "./summaries";

describe("computeDeactivationEffect", () => {
  const now = "2026-10-06T18:00:00.000Z";

  it("deactivating an active member flips is_active and stamps actor + time", () => {
    const effect = computeDeactivationEffect({
      currentlyActive: true,
      targetActive: false,
      actorId: "actor-1",
      memberName: "Maya Chen",
      nowIso: now,
    });
    expect(effect.patch).toEqual({
      is_active: false,
      deactivated_at: now,
      deactivated_by: "actor-1",
    });
    expect(effect.auditAction).toBe("membership.deactivated");
    expect(effect.description).toContain("immediately remove Maya Chen's access");
  });

  it("reactivating clears the deactivation stamp (role/teams preserved)", () => {
    const effect = computeDeactivationEffect({
      currentlyActive: false,
      targetActive: true,
      actorId: "actor-1",
      memberName: "Maya Chen",
      nowIso: now,
    });
    expect(effect.patch).toEqual({
      is_active: true,
      deactivated_at: null,
      deactivated_by: null,
    });
    expect(effect.auditAction).toBe("membership.reactivated");
  });

  it("rejects no-op transitions", () => {
    expect(() =>
      computeDeactivationEffect({
        currentlyActive: false,
        targetActive: false,
        actorId: "actor-1",
        memberName: "Maya Chen",
      }),
    ).toThrow("already deactivated");
    expect(() =>
      computeDeactivationEffect({
        currentlyActive: true,
        targetActive: true,
        actorId: "actor-1",
        memberName: "Maya Chen",
      }),
    ).toThrow("already active");
  });
});

describe("summarizeBulkAction", () => {
  it("summarizes a role change with the affected count and target label", () => {
    const s = summarizeBulkAction("change-role", 4, "Admin");
    expect(s.title).toBe("Change role for 4 members");
    expect(s.confirmLabel).toBe("Change role");
    expect(s.affectedCount).toBe(4);
    expect(s.destructive).toBe(false);
    expect(s.permission).toBe("members:change_role");
    expect(s.description).toContain("“Admin”");
  });

  it("uses singular copy for one member and flags deactivation as destructive", () => {
    const s = summarizeBulkAction("deactivate", 1);
    expect(s.title).toBe("Deactivate 1 member");
    expect(s.destructive).toBe(true);
    expect(s.permission).toBe("members:deactivate");
  });

  it("summarizes a team move", () => {
    const s = summarizeBulkAction("change-team", 3, "Design");
    expect(s.title).toBe("Move 3 members to Design");
    expect(s.permission).toBe("teams:manage");
  });

  it("summarizes a reactivation", () => {
    const s = summarizeBulkAction("reactivate", 2);
    expect(s.title).toBe("Reactivate 2 members");
    expect(s.destructive).toBe(false);
  });
});
