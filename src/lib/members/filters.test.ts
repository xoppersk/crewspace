import { describe, expect, it } from "vitest";

import {
  buildDirectoryClauses,
  describeDirectoryFilters,
  directoryPageRange,
  DIRECTORY_PAGE_SIZE,
  parseDirectoryFilters,
} from "./filters";

describe("parseDirectoryFilters", () => {
  it("defaults an empty query to name-sorted page 1", () => {
    expect(parseDirectoryFilters({})).toEqual({
      q: "",
      teamId: "all",
      roleId: "all",
      status: "all",
      onlineOnly: false,
      sort: "name",
      page: 1,
    });
  });

  it("parses a full filter set", () => {
    expect(
      parseDirectoryFilters({
        q: "  maya  ",
        team: "team-1",
        role: "role-2",
        status: "deactivated",
        online: "1",
        sort: "recent",
        page: "3",
      }),
    ).toEqual({
      q: "maya",
      teamId: "team-1",
      roleId: "role-2",
      status: "deactivated",
      onlineOnly: true,
      sort: "recent",
      page: 3,
    });
  });

  it("rejects invalid status/sort and clamps bad pages", () => {
    const parsed = parseDirectoryFilters({ status: "pending", sort: "oldest", page: "-2" });
    expect(parsed.status).toBe("all");
    expect(parsed.sort).toBe("name");
    expect(parsed.page).toBe(1);
  });

  it("takes the first value of repeated params", () => {
    expect(parseDirectoryFilters({ q: ["a", "b"] }).q).toBe("a");
  });
});

describe("buildDirectoryClauses", () => {
  const base = {
    q: "",
    teamId: "all",
    roleId: "all",
    status: "all" as const,
    onlineOnly: false,
    sort: "name" as const,
    page: 1,
  };

  it("builds a search clause with ilike wildcards and escapes special chars", () => {
    const clauses = buildDirectoryClauses({ ...base, q: "100%_sure" });
    expect(clauses).toContainEqual({ type: "search", pattern: "%100\\%\\_sure%" });
  });

  it("builds role, status, and team clauses", () => {
    const clauses = buildDirectoryClauses({
      ...base,
      roleId: "role-9",
      teamId: "team-4",
      status: "deactivated",
    });
    expect(clauses).toContainEqual({ type: "role", roleId: "role-9" });
    expect(clauses).toContainEqual({ type: "isActive", value: false });
    expect(clauses).toContainEqual({ type: "team", teamId: "team-4" });
  });

  it("maps sort keys to order clauses", () => {
    expect(buildDirectoryClauses({ ...base, sort: "name" })).toContainEqual({
      type: "order",
      column: "name",
      ascending: true,
    });
    expect(buildDirectoryClauses({ ...base, sort: "recent" })).toContainEqual({
      type: "order",
      column: "last_active_at",
      ascending: false,
    });
    expect(buildDirectoryClauses({ ...base, sort: "newest" })).toContainEqual({
      type: "order",
      column: "joined_at",
      ascending: false,
    });
  });

  it("emits no predicate clauses for the default filter set", () => {
    expect(buildDirectoryClauses(base)).toEqual([
      { type: "order", column: "name", ascending: true },
    ]);
  });
});

describe("directoryPageRange", () => {
  it("pages 25 rows at a time", () => {
    expect(directoryPageRange(1)).toEqual({ from: 0, to: DIRECTORY_PAGE_SIZE - 1 });
    expect(directoryPageRange(2)).toEqual({
      from: DIRECTORY_PAGE_SIZE,
      to: 2 * DIRECTORY_PAGE_SIZE - 1,
    });
  });
});

describe("describeDirectoryFilters", () => {
  it("describes the default as all members", () => {
    expect(
      describeDirectoryFilters({
        q: "",
        teamId: "all",
        roleId: "all",
        status: "all",
        onlineOnly: false,
        sort: "name",
        page: 1,
      }),
    ).toBe("all members");
  });

  it("joins active filter descriptions", () => {
    expect(
      describeDirectoryFilters(
        {
          q: "maya",
          teamId: "t1",
          roleId: "all",
          status: "active",
          onlineOnly: true,
          sort: "name",
          page: 1,
        },
        "Design",
      ),
    ).toBe("matching “maya” · in Design · active · online now");
  });
});
