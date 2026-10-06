import { describe, expect, it } from "vitest";

import { toPlainTransferError, validateTransferTarget } from "./transfer";

const base = {
  actorUserId: "actor-user",
  actorIsOwner: true,
  targetUserId: "target-user",
  targetIsActive: true,
  targetName: "Luis Gomez",
};

describe("validateTransferTarget", () => {
  it("allows an owner transferring to another active member", () => {
    expect(validateTransferTarget(base)).toBeNull();
  });

  it("rejects self-transfer in plain language", () => {
    const error = validateTransferTarget({ ...base, targetUserId: "actor-user" });
    expect(error).toMatch(/yourself/i);
  });

  it("rejects a non-owner actor", () => {
    const error = validateTransferTarget({ ...base, actorIsOwner: false });
    expect(error).toMatch(/only the organization owner/i);
  });

  it("rejects a deactivated target and names them", () => {
    const error = validateTransferTarget({ ...base, targetIsActive: false });
    expect(error).toMatch(/deactivated/i);
    expect(error).toContain("Luis Gomez");
  });
});

describe("toPlainTransferError", () => {
  it("strips the crewspace: namespace and capitalizes", () => {
    expect(toPlainTransferError("crewspace: you cannot transfer ownership to yourself")).toBe(
      "You cannot transfer ownership to yourself",
    );
  });

  it("trims surrounding whitespace from the plain message", () => {
    expect(toPlainTransferError("crewspace:   sign-in required\n")).toBe("Sign-in required");
  });

  it("falls back to a generic message for unknown errors", () => {
    expect(toPlainTransferError("connection reset by peer")).toMatch(/couldn't be completed/i);
    expect(toPlainTransferError("")).toMatch(/couldn't be completed/i);
  });
});
