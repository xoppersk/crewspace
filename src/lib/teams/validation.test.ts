import { describe, expect, it } from "vitest";

import { validateLeadRemoval } from "./validation";

const BASE = {
  teamName: "Design",
  memberName: "Amara Conteh",
  remainingMemberIds: ["m2", "m3"],
};

describe("validateLeadRemoval", () => {
  it("allows removing a non-lead without a successor", () => {
    expect(
      validateLeadRemoval({
        ...BASE,
        teamLeadMembershipId: "m2",
        removingMembershipId: "m3",
      }),
    ).toEqual({ ok: true, newLeadMembershipId: "m2" });
  });

  it("requires a successor when removing the lead", () => {
    const result = validateLeadRemoval({
      ...BASE,
      teamLeadMembershipId: "m1",
      removingMembershipId: "m1",
      successorMembershipId: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Pick a successor lead");
  });

  it("accepts a successor who stays on the team", () => {
    expect(
      validateLeadRemoval({
        ...BASE,
        teamLeadMembershipId: "m1",
        removingMembershipId: "m1",
        successorMembershipId: "m2",
      }),
    ).toEqual({ ok: true, newLeadMembershipId: "m2" });
  });

  it("rejects the removed member as their own successor", () => {
    const result = validateLeadRemoval({
      ...BASE,
      teamLeadMembershipId: "m1",
      removingMembershipId: "m1",
      successorMembershipId: "m1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("can't be the member being removed");
  });

  it("rejects a successor who is not on the team", () => {
    const result = validateLeadRemoval({
      ...BASE,
      teamLeadMembershipId: "m1",
      removingMembershipId: "m1",
      successorMembershipId: "outsider",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("must be a member of the team");
  });

  it("handles a team with no lead", () => {
    expect(
      validateLeadRemoval({
        ...BASE,
        teamLeadMembershipId: null,
        removingMembershipId: "m2",
      }),
    ).toEqual({ ok: true, newLeadMembershipId: null });
  });
});
