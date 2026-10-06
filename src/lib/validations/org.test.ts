import { describe, expect, it } from "vitest";

import { createOrgSchema, orgSlugSchema, RESERVED_SLUGS, slugify } from "./org";

describe("slugify", () => {
  it("derives a URL-safe slug from a name", () => {
    expect(slugify("Hale & Fern Studio")).toBe("hale-fern-studio");
  });

  it("strips apostrophes and collapses separators", () => {
    expect(slugify("O'Brien's  Design--Co")).toBe("obriens-design-co");
  });

  it("trims leading/trailing hyphens and lowercases", () => {
    expect(slugify("  --Acme Corp-- ")).toBe("acme-corp");
  });

  it("caps length at 48 chars", () => {
    expect(slugify("a".repeat(100))).toHaveLength(48);
  });

  it("is stable on already-slugified input", () => {
    expect(slugify("hale-fern-studio")).toBe("hale-fern-studio");
  });
});

describe("orgSlugSchema", () => {
  it("accepts valid slugs", () => {
    expect(orgSlugSchema.parse("hale-fern")).toBe("hale-fern");
    expect(orgSlugSchema.parse("acme2")).toBe("acme2");
    expect(orgSlugSchema.parse("a-b-c")).toBe("a-b-c");
  });

  it("rejects too-short, too-long, and malformed slugs", () => {
    expect(() => orgSlugSchema.parse("ab")).toThrow();
    expect(() => orgSlugSchema.parse("a".repeat(49))).toThrow();
    expect(() => orgSlugSchema.parse("-acme")).toThrow();
    expect(() => orgSlugSchema.parse("acme-")).toThrow();
    expect(() => orgSlugSchema.parse("Acme")).toThrow();
    expect(() => orgSlugSchema.parse("acme_corp")).toThrow();
    expect(() => orgSlugSchema.parse("acme corp")).toThrow();
  });

  it("rejects every reserved slug", () => {
    for (const reserved of RESERVED_SLUGS) {
      expect(() => orgSlugSchema.parse(reserved), reserved).toThrow();
    }
  });
});

describe("createOrgSchema", () => {
  it("accepts a valid org creation payload", () => {
    const parsed = createOrgSchema.parse({ name: "Hale & Fern Studio", slug: "hale-fern" });
    expect(parsed.name).toBe("Hale & Fern Studio");
    expect(parsed.slug).toBe("hale-fern");
    expect(parsed.logoUrl).toBeUndefined();
  });

  it("trims the name and rejects blanks", () => {
    expect(() => createOrgSchema.parse({ name: "  ", slug: "acme" })).toThrow();
    expect(createOrgSchema.parse({ name: "  Acme  ", slug: "acme" }).name).toBe("Acme");
  });

  it("normalizes an empty logoUrl to undefined", () => {
    const parsed = createOrgSchema.parse({ name: "Acme", slug: "acme", logoUrl: "" });
    expect(parsed.logoUrl).toBeUndefined();
  });

  it("rejects a non-URL logo", () => {
    expect(() =>
      createOrgSchema.parse({ name: "Acme", slug: "acme", logoUrl: "not-a-url" }),
    ).toThrow();
  });
});
