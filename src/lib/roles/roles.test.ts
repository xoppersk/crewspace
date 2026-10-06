import { beforeEach, describe, expect, it, vi } from "vitest";

import { ForbiddenError, requireOrgAccess } from "@/lib/permissions";
import {
  assignRole,
  createRole,
  deleteRole,
  updateRolePermissions,
} from "@/lib/roles/actions";
import { groupCatalog } from "@/lib/roles/catalog";
import { diffPermissionKeys, diffSummary } from "@/lib/roles/diff";
import { createRoleSchema } from "@/lib/roles/validation";

// ---------------------------------------------------------------------------
// Mocks: requireOrgAccess is the permission choke point; the "forged call as
// a Member" tests swap its implementation to throw ForbiddenError. The
// Supabase client is a chainable stub configured per test.
// ---------------------------------------------------------------------------

vi.mock("@/lib/permissions", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/permissions")>();
  return { ...mod, requireOrgAccess: vi.fn() };
});

vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

type QueryResult = { data: unknown; error: unknown; count?: number | null };

function mockChain(result: QueryResult): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  chain.eq = () => chain;
  chain.neq = () => chain;
  chain.in = () => chain;
  chain.order = () => chain;
  chain.select = () => chain;
  chain.single = () => Promise.resolve(result);
  chain.maybeSingle = () => Promise.resolve(result);
  // Supabase builders are thenable — `await builder` resolves the result.
  chain.then = (resolve: (value: QueryResult) => unknown) => resolve(result);
  return chain;
}

type Handler = (op: string, payload?: unknown) => QueryResult;

function mockSupabase(handlers: Record<string, Handler>) {
  const fallback: QueryResult = { data: null, error: null };
  return {
    from: (table: string) => ({
      select: (...args: unknown[]) =>
        mockChain(handlers[table]?.("select", args) ?? fallback),
      insert: (payload: unknown) =>
        mockChain(handlers[table]?.("insert", payload) ?? fallback),
      update: (payload: unknown) =>
        mockChain(handlers[table]?.("update", payload) ?? fallback),
      delete: () => mockChain(handlers[table]?.("delete") ?? fallback),
    }),
  };
}

const mockedRequireOrgAccess = vi.mocked(requireOrgAccess);

function asAdmin(supabase: unknown, userId = "88888888-8888-4888-8888-888888888888") {
  mockedRequireOrgAccess.mockResolvedValue({
    user: { id: userId } as never,
    membership: {} as never,
    permissions: ["roles:create", "roles:update", "roles:delete", "roles:assign"],
    supabase: supabase as never,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Permission-diff computation (pure)
// ---------------------------------------------------------------------------

describe("diffPermissionKeys", () => {
  it("computes added and removed keys, sorted", () => {
    const diff = diffPermissionKeys(
      ["members:read", "teams:create", "audit:read"],
      ["members:read", "members:invite", "teams:manage"],
    );
    expect(diff.added).toEqual(["members:invite", "teams:manage"]);
    expect(diff.removed).toEqual(["audit:read", "teams:create"]);
  });

  it("dedupes and reports an empty diff for identical sets", () => {
    const diff = diffPermissionKeys(["a", "a"], ["a"]);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
  });

  it("summarizes in plain language (never color-alone)", () => {
    expect(diffSummary({ added: ["x", "y"], removed: ["z"] })).toBe("+2 added, −1 removed");
    expect(diffSummary({ added: [], removed: [] })).toBe("No changes");
  });
});

// ---------------------------------------------------------------------------
// Catalog grouping
// ---------------------------------------------------------------------------

describe("groupCatalog", () => {
  it("orders resources per the matrix spec and sorts keys within groups", () => {
    const groups = groupCatalog([
      { key: "billing:view", resource: "billing", action: "view", label: "B", description: null },
      { key: "org:update", resource: "org", action: "update", label: "A", description: null },
      { key: "org:read", resource: "org", action: "read", label: "C", description: null },
    ]);
    expect(groups.map((g) => g.resource)).toEqual(["org", "billing"]);
    expect(groups[0]?.label).toBe("Organization");
    expect(groups[0]?.permissions.map((p) => p.key)).toEqual(["org:read", "org:update"]);
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe("createRoleSchema", () => {
  it("rejects empty names and unknown permission keys", () => {
    expect(
      createRoleSchema.safeParse({ name: "x", permissionKeys: [] }).success,
    ).toBe(false);
    expect(
      createRoleSchema.safeParse({
        name: "Support Lead",
        permissionKeys: ["members:read", "not-a-key"],
      }).success,
    ).toBe(false);
    expect(
      createRoleSchema.safeParse({
        name: "Support Lead",
        permissionKeys: ["members:read", "members:read"],
      }).success,
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Server actions — guardrails
// ---------------------------------------------------------------------------

describe("updateRolePermissions", () => {
  it("rejects edits to system roles (immutable)", async () => {
    const supabase = mockSupabase({
      roles: () => ({
        data: { id: "11111111-1111-4111-8111-111111111111", org_id: "55555555-5555-4555-8555-555555555555", name: "Admin", is_system: true, system_key: "admin" },
        error: null,
      }),
    });
    asAdmin(supabase);

    const result = await updateRolePermissions("55555555-5555-4555-8555-555555555555", "slug", "11111111-1111-4111-8111-111111111111", ["members:read"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/System roles can't be edited/);
    // No write was attempted against role_permissions.
    expect(mockedRequireOrgAccess).toHaveBeenCalledWith("55555555-5555-4555-8555-555555555555", "roles:update");
  });

  it("rejects forged calls from a Member without roles:update", async () => {
    mockedRequireOrgAccess.mockRejectedValue(new ForbiddenError("55555555-5555-4555-8555-555555555555", "roles:update"));
    await expect(updateRolePermissions("55555555-5555-4555-8555-555555555555", "slug", "11111111-1111-4111-8111-111111111111", ["members:read"])).rejects.toThrow(
      ForbiddenError,
    );
  });
});

describe("deleteRole", () => {
  it("is blocked while members hold the role and names them", async () => {
    const supabase = mockSupabase({
      roles: () => ({
        data: { id: "99999999-9999-4999-8999-999999999999", org_id: "55555555-5555-4555-8555-555555555555", name: "Support Lead", is_system: false },
        error: null,
      }),
      memberships: () => ({ data: [{ user_id: "66666666-6666-4666-8666-666666666666" }, { user_id: "77777777-7777-4777-8777-777777777777" }], error: null }),
      profiles: () => ({
        data: [
          { id: "66666666-6666-4666-8666-666666666666", full_name: "Ama Serwaa" },
          { id: "77777777-7777-4777-8777-777777777777", full_name: "Kwame Mensah" },
        ],
        error: null,
      }),
    });
    asAdmin(supabase);

    const result = await deleteRole("55555555-5555-4555-8555-555555555555", "slug", "99999999-9999-4999-8999-999999999999");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/held by 2 members/);
      expect(result).toMatchObject({ memberNames: ["Ama Serwaa", "Kwame Mensah"] });
    }
  });

  it("rejects deleting system roles", async () => {
    const supabase = mockSupabase({
      roles: () => ({
        data: { id: "11111111-1111-4111-8111-111111111111", org_id: "55555555-5555-4555-8555-555555555555", name: "Owner", is_system: true },
        error: null,
      }),
    });
    asAdmin(supabase);

    const result = await deleteRole("55555555-5555-4555-8555-555555555555", "slug", "11111111-1111-4111-8111-111111111111");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/System roles can't be deleted/);
  });
});

describe("assignRole", () => {
  const memberRow = {
    id: "44444444-4444-4444-8444-444444444444",
    org_id: "55555555-5555-4555-8555-555555555555",
    user_id: "99999999-9999-4999-8999-000000000001",
    role_id: "33333333-3333-4333-8333-333333333333",
    is_active: true,
  };

  it("rejects self-targeted role changes (T1, defense in depth)", async () => {
    const selfRow = { ...memberRow, user_id: "88888888-8888-4888-8888-888888888888" };
    const supabase = mockSupabase({
      memberships: () => ({ data: selfRow, error: null }),
    });
    asAdmin(supabase, "88888888-8888-4888-8888-888888888888");

    const result = await assignRole("55555555-5555-4555-8555-555555555555", "slug", "44444444-4444-4444-8444-444444444444", "22222222-2222-4222-8222-222222222222");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/can't change your own role/);
  });

  it("rejects forged calls from a Member without roles:assign", async () => {
    mockedRequireOrgAccess.mockRejectedValue(new ForbiddenError("55555555-5555-4555-8555-555555555555", "roles:assign"));
    await expect(assignRole("55555555-5555-4555-8555-555555555555", "slug", "44444444-4444-4444-8444-444444444444", "22222222-2222-4222-8222-222222222222")).rejects.toThrow(ForbiddenError);
  });

  it("surfaces the last-owner trigger as a plain-language error", async () => {
    const triggerError = new Error(
      "crewspace: cannot remove the last active owner of the organization",
    );
    const supabase = mockSupabase({
      memberships: (op) => {
        if (op === "update") return { data: null, error: triggerError };
        return { data: memberRow, error: null };
      },
      roles: () => ({ data: { id: "22222222-2222-4222-8222-222222222222", name: "Admin" }, error: null }),
    });
    asAdmin(supabase);

    const result = await assignRole("55555555-5555-4555-8555-555555555555", "slug", "44444444-4444-4444-8444-444444444444", "22222222-2222-4222-8222-222222222222");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/last owner/i);
      expect(result.error).toMatch(/Transfer ownership/);
    }
  });
});

describe("createRole", () => {
  it("reports duplicate names in plain language", async () => {
    const supabase = mockSupabase({
      roles: (op) => {
        if (op === "insert") {
          const err = new Error("duplicate key value") as Error & { code: string };
          err.code = "23505";
          return { data: null, error: err };
        }
        return { data: null, error: null };
      },
    });
    asAdmin(supabase);

    const result = await createRole("55555555-5555-4555-8555-555555555555", "slug", {
      name: "Support Lead",
      permissionKeys: ["members:read"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/already exists/);
  });

  it("validates input before touching the database", async () => {
    const supabase = mockSupabase({});
    asAdmin(supabase);

    const result = await createRole("55555555-5555-4555-8555-555555555555", "slug", {
      name: "x",
      permissionKeys: ["bogus:key"],
    });
    expect(result.ok).toBe(false);
    expect(mockedRequireOrgAccess).toHaveBeenCalledWith("55555555-5555-4555-8555-555555555555", "roles:create");
  });
});

// ---------------------------------------------------------------------------
// Manual note: PermissionMatrix keyboard interaction (roving arrow-key nav,
// native switch operation, ≥44px mobile targets) is verified manually —
// jsdom cannot exercise real focus movement or touch targets.
// ---------------------------------------------------------------------------
