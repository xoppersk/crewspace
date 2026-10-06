import { describe, expect, it } from "vitest";

import { domainSchema, invitePolicySchema, orgSettingsSchema } from "./settings";
import { orgSlugSchema } from "./org";

const valid = {
  name: "Hale & Fern Studio",
  slug: "hale-fern",
  logo_url: undefined,
  default_role_id: "123e4567-e89b-12d3-a456-426614174000",
  invite_policy: "admins" as const,
  allowed_domains: ["example.com"],
  require_email_verification: true,
  session_timeout_minutes: 480,
  require_reauth_destructive: false,
};

describe("orgSettingsSchema", () => {
  it("accepts a complete valid payload", () => {
    expect(orgSettingsSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts an empty domain list (any domain allowed)", () => {
    const result = orgSettingsSchema.safeParse({ ...valid, allowed_domains: [] });
    expect(result.success).toBe(true);
  });

  it("accepts a null session timeout (never expire)", () => {
    const result = orgSettingsSchema.safeParse({ ...valid, session_timeout_minutes: null });
    expect(result.success).toBe(true);
  });

  it("rejects a short org name", () => {
    const result = orgSettingsSchema.safeParse({ ...valid, name: "A" });
    expect(result.success).toBe(false);
  });
});

describe("orgSlugSchema", () => {
  it("accepts clean slugs", () => {
    for (const slug of ["hale-fern", "acme123", "a-b-c", "abc"]) {
      expect(orgSlugSchema.safeParse(slug).success, slug).toBe(true);
    }
  });

  it("rejects uppercase, spaces, and edge hyphens", () => {
    for (const slug of ["Hale-Fern", "hale fern", "-hale", "hale-", "ab"]) {
      expect(orgSlugSchema.safeParse(slug).success, slug).toBe(false);
    }
  });

  it("rejects reserved slugs that collide with app routes", () => {
    for (const slug of ["settings", "audit", "account", "api", "invite"]) {
      const result = orgSlugSchema.safeParse(slug);
      expect(result.success, slug).toBe(false);
    }
  });
});

describe("domainSchema", () => {
  it("accepts normal domains and normalizes case", () => {
    for (const domain of ["example.com", "EXAMPLE.COM", "sub.example.co.uk", "a-b.io"]) {
      const result = domainSchema.safeParse(domain);
      expect(result.success, domain).toBe(true);
      if (result.success) expect(result.data).toBe(domain.toLowerCase());
    }
  });

  it("rejects schemes, paths, leading dots, and single labels", () => {
    for (const domain of [
      "https://example.com",
      "example.com/path",
      ".example.com",
      "example",
      "-bad.com",
      "bad-.com",
      "exam ple.com",
      "",
    ]) {
      expect(domainSchema.safeParse(domain).success, JSON.stringify(domain)).toBe(false);
    }
  });
});

describe("invitePolicySchema", () => {
  it("accepts the three policy values", () => {
    for (const policy of ["owners", "admins", "managers"]) {
      expect(invitePolicySchema.safeParse(policy).success, policy).toBe(true);
    }
  });

  it("rejects anything else", () => {
    expect(invitePolicySchema.safeParse("everyone").success).toBe(false);
  });
});

describe("settings domain list", () => {
  it("rejects more than 20 domains", () => {
    const domains = Array.from({ length: 21 }, (_, i) => `example${i}.com`);
    const result = orgSettingsSchema.safeParse({ ...valid, allowed_domains: domains });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid domain inside the list", () => {
    const result = orgSettingsSchema.safeParse({
      ...valid,
      allowed_domains: ["example.com", "not a domain"],
    });
    expect(result.success).toBe(false);
  });
});
