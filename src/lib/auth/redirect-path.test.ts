import { describe, expect, it } from "vitest";

import { safeNextPath } from "./redirect-path";

describe("safeNextPath", () => {
  it("accepts plain same-origin paths", () => {
    expect(safeNextPath("/app")).toBe("/app");
    expect(safeNextPath("/app/account?tab=profile")).toBe("/app/account?tab=profile");
  });

  it("falls back on null, undefined, and empty input", () => {
    expect(safeNextPath(null)).toBe("/app");
    expect(safeNextPath(undefined)).toBe("/app");
    expect(safeNextPath("")).toBe("/app");
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(safeNextPath("https://evil.com/phish")).toBe("/app");
    expect(safeNextPath("//evil.com/phish")).toBe("/app");
  });

  it("rejects URL-encoded protocol-relative URLs", () => {
    expect(safeNextPath("%2F%2Fevil.com%2Fphish")).toBe("/app");
  });

  it("rejects backslash tricks", () => {
    expect(safeNextPath("/\\evil.com")).toBe("/app");
  });

  it("rejects malformed encodings", () => {
    expect(safeNextPath("%E0%A4%A")).toBe("/app");
  });

  it("honours a custom fallback", () => {
    expect(safeNextPath("https://evil.com", "/dashboard")).toBe("/dashboard");
  });
});
