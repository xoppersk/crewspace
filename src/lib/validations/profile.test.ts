import { describe, expect, it } from "vitest";

import { updateProfileSchema } from "./profile";

describe("updateProfileSchema", () => {
  const valid = {
    full_name: "Amara Conteh",
    title: "Founder",
    bio: "Design leader.",
    timezone: "America/New_York",
  };

  it("accepts a complete valid payload", () => {
    expect(updateProfileSchema.parse(valid).full_name).toBe("Amara Conteh");
  });

  it("accepts minimal payload (title/bio/avatar optional)", () => {
    const parsed = updateProfileSchema.parse({
      full_name: "Amara Conteh",
      timezone: "UTC",
    });
    expect(parsed.title).toBeUndefined();
    expect(parsed.bio).toBeUndefined();
  });

  it("rejects a blank name and over-long fields", () => {
    expect(() => updateProfileSchema.parse({ ...valid, full_name: " " })).toThrow();
    expect(() =>
      updateProfileSchema.parse({ ...valid, bio: "x".repeat(501) }),
    ).toThrow();
    expect(() =>
      updateProfileSchema.parse({ ...valid, title: "x".repeat(121) }),
    ).toThrow();
  });

  it("requires a timezone", () => {
    expect(() => updateProfileSchema.parse({ ...valid, timezone: "" })).toThrow();
  });

  it("normalizes an empty avatar_url to undefined", () => {
    const parsed = updateProfileSchema.parse({ ...valid, avatar_url: "" });
    expect(parsed.avatar_url).toBeUndefined();
  });

  it("rejects a non-URL avatar", () => {
    expect(() =>
      updateProfileSchema.parse({ ...valid, avatar_url: "not-a-url" }),
    ).toThrow();
  });
});
