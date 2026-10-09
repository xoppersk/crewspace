import { describe, expect, it } from "vitest";

import { assignRegisterNumbers, formatRegisterNo } from "./register";

describe("formatRegisterNo", () => {
  it("zero-pads to three digits", () => {
    expect(formatRegisterNo(1)).toBe("001");
    expect(formatRegisterNo(42)).toBe("042");
    expect(formatRegisterNo(418)).toBe("418");
  });

  it("clamps below 1 up to 1", () => {
    expect(formatRegisterNo(0)).toBe("001");
    expect(formatRegisterNo(-5)).toBe("001");
  });
});

describe("assignRegisterNumbers", () => {
  it("numbers oldest-first memberships from 1", () => {
    const map = assignRegisterNumbers(["a", "b", "c"]);
    expect(map.get("a")).toBe(1);
    expect(map.get("b")).toBe(2);
    expect(map.get("c")).toBe(3);
  });

  it("keeps the first occurrence of a duplicate id", () => {
    const map = assignRegisterNumbers(["a", "b", "a"]);
    expect(map.get("a")).toBe(1);
    expect(map.size).toBe(2);
  });

  it("returns an empty map for no memberships", () => {
    expect(assignRegisterNumbers([]).size).toBe(0);
  });
});
