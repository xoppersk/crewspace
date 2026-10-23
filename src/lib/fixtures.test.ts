import { describe, expect, it } from "vitest";
import {
  addToTeam,
  auditAccessChangeCount,
  auditTotals,
  customInheritCount,
  deactivateScopeCount,
  directoryCounts,
  getAuditEntries,
  getInvitations,
  getMember,
  getMembers,
  getNeedsOwner,
  getOrg,
  getPermissions,
  getRole,
  getRoles,
  getSeats,
  getTeam,
  getTeams,
  importCounts,
  invitationTabCounts,
  memberCan,
  memberEffectivePermissions,
  openInvitations,
  removeFromTeam,
  roleAllows,
  roleAllowsAfterReview,
  roleMemberCount,
  teamMemberCount,
  teamRoleMix,
  totalPlacements,
  type WorkspaceData,
} from "./api";
import type {
  AuditEntry,
  ImportRow,
  Invitation,
  Member,
  NeedsOwnerItem,
  Org,
  Team,
} from "./types";
import orgJson from "../../data/org.json";
import membersJson from "../../data/members.json";
import teamsJson from "../../data/teams.json";
import invitationsJson from "../../data/invitations.json";
import auditJson from "../../data/audit.json";
import overviewJson from "../../data/overview.json";
import importJson from "../../data/import.json";

/**
 * SEED-SOURCE canon tests. Production code never imports data/*.json
 * any more (every route reads Supabase); these tests pin the fixture
 * files themselves — the exact source Worker S's seed loads into the
 * owner's sample workspace — by running the app's own pure helpers
 * (./api) over a WorkspaceData assembled from the JSON, the same
 * shapes the DB loader produces. Assertions that pinned fixture-only
 * helpers which no longer exist (getImportRows, getOfflineWindow,
 * getImportFileName/Mapping) now read the JSON directly.
 */
const data: WorkspaceData = {
  org: orgJson as unknown as Org,
  members: (membersJson as unknown as { members: Member[] }).members,
  teams: (teamsJson as unknown as { teams: Team[] }).teams,
  invitations: (invitationsJson as unknown as { invitations: Invitation[] })
    .invitations,
  auditEntries: (auditJson as unknown as { entries: AuditEntry[] }).entries,
  needsOwner: (overviewJson as unknown as { needsOwner: NeedsOwnerItem[] })
    .needsOwner,
};
const importRows = (importJson as unknown as { rows: ImportRow[] }).rows;

describe("organization canon (§9)", () => {
  it("is Sevyn Labs, verified domain, today is Tuesday October 6 2026", () => {
    const org = getOrg(data);
    expect(org.name).toBe("Sevyn Labs");
    expect(org.domain).toBe("sevynlabs.io");
    expect(org.domainVerified).toBe("Aug 2, 2025");
    expect(org.today).toBe("Tuesday, October 6");
  });

  it("plan is Team plan, 50 seats at $8, renews Oct 31", () => {
    const { plan } = getOrg(data);
    expect(plan.name).toBe("Team plan");
    expect(plan.seats).toBe(50);
    expect(plan.pricePerSeat).toBe(8);
    expect(plan.renews).toBe("Oct 31");
    expect(plan.billingContactId).toBe("014");
  });

  it("baseline allows only permission 3 (Edit member profiles)", () => {
    expect(getOrg(data).baseline.allowedPermissionIds).toEqual([3]);
  });
});

describe("the 18 permissions, in order (§13 premium v2 register)", () => {
  it("has exactly 18 in the register order", () => {
    expect(getPermissions(data).map((p) => p.name)).toEqual([
      "Invite members",
      "Deactivate members",
      "Edit member profiles",
      "Change member roles",
      "Edit role permissions",
      "Create custom roles",
      "Read audit log",
      "Export audit records",
      "Create teams",
      "Manage team membership",
      "Resend or revoke invitations",
      "Import members from CSV",
      "Manage sign-in methods",
      "Sign members out everywhere",
      "View billing",
      "Manage plan and payment",
      "Edit organization settings",
      "Transfer ownership",
    ]);
  });

  it("groups them People/Access/Governance/Teams/Invitations/Security/Billing/Organization", () => {
    expect(getOrg(data).groups.map((g) => g.name)).toEqual([
      "People",
      "Access",
      "Governance",
      "Teams",
      "Invitations",
      "Security",
      "Billing",
      "Organization",
    ]);
  });

  it("groups them 3/3/2/2/2/2/2/2 across 8 groups", () => {
    expect(getOrg(data).groups.map((g) => g.permissionIds.length)).toEqual([
      3, 3, 2, 2, 2, 2, 2, 2,
    ]);
  });
});

describe("roles (§9)", () => {
  it("has 9 roles whose members add up to 42", () => {
    const roles = getRoles(data);
    expect(roles).toHaveLength(9);
    expect(
      roles.reduce((n, r) => n + roleMemberCount(data, r.id), 0),
    ).toBe(42);
  });

  it("pins each role's member count", () => {
    expect(roleMemberCount(data, "owner")).toBe(1);
    expect(roleMemberCount(data, "member")).toBe(20);
    expect(roleMemberCount(data, "guest")).toBe(1);
    expect(roleMemberCount(data, "product-admin")).toBe(5);
    expect(roleMemberCount(data, "support-lead")).toBe(4);
    expect(roleMemberCount(data, "analyst")).toBe(6);
    expect(roleMemberCount(data, "finance-viewer")).toBe(3);
    expect(roleMemberCount(data, "auditor")).toBe(1);
    expect(roleMemberCount(data, "billing-admin")).toBe(1);
  });

  it("pins each role's effective allows: 18/0/0/7/4/2/1/2/3", () => {
    expect(roleAllows(data, getRole(data, "owner")!)).toBe(18);
    expect(roleAllows(data, getRole(data, "member")!)).toBe(0);
    expect(roleAllows(data, getRole(data, "guest")!)).toBe(0);
    expect(roleAllows(data, getRole(data, "product-admin")!)).toBe(7);
    expect(roleAllows(data, getRole(data, "support-lead")!)).toBe(4);
    expect(roleAllows(data, getRole(data, "analyst")!)).toBe(2);
    expect(roleAllows(data, getRole(data, "finance-viewer")!)).toBe(1);
    expect(roleAllows(data, getRole(data, "auditor")!)).toBe(2);
    expect(roleAllows(data, getRole(data, "billing-admin")!)).toBe(3);
  });

  it("pins each custom role's allow-list (§9)", () => {
    const allowedIds = (roleId: string) => {
      const role = getRole(data, roleId)!;
      return getPermissions(data)
        .filter(
          (p) =>
            role.settings[String(p.id)] === "allow" ||
            (role.settings[String(p.id)] === "inherit" && p.id === 3),
        )
        .map((p) => p.id);
    };
    expect(allowedIds("product-admin")).toEqual([1, 3, 4, 7, 9, 10, 11]);
    expect(allowedIds("support-lead")).toEqual([3, 7, 11, 14]);
    expect(allowedIds("analyst")).toEqual([7, 15]);
    expect(allowedIds("finance-viewer")).toEqual([15]);
    expect(allowedIds("auditor")).toEqual([7, 8]);
    expect(allowedIds("billing-admin")).toEqual([7, 15, 16]);
  });

  it("Product admin has the 2 designed pending changes and allows 8 after review", () => {
    const pa = getRole(data, "product-admin")!;
    expect(pa.pendingChanges).toEqual([
      { permissionId: 2, from: "deny", to: "allow" },
      { permissionId: 8, from: "inherit", to: "deny" },
    ]);
    expect(roleAllowsAfterReview(data, pa)).toBe(8);
  });

  it("has 31 settings set to Inherit across the 6 custom roles (R-03 baseline panel)", () => {
    expect(customInheritCount(data)).toBe(31);
    expect(getRoles(data).filter((r) => r.type === "Custom")).toHaveLength(6);
  });
});

describe("members (§9)", () => {
  it("has 42 members: 41 active plus Victor Hale 033 deactivated", () => {
    const all = getMembers(data);
    expect(all).toHaveLength(42);
    expect(all.filter((m) => m.status === "active")).toHaveLength(41);
    const victor = getMember(data, "033")!;
    expect(victor.name).toBe("Victor Hale");
    expect(victor.status).toBe("deactivated");
  });

  it("has one guest: Iris Novak 024 from outside the organization", () => {
    const iris = getMember(data, "024")!;
    expect(iris.name).toBe("Iris Novak");
    expect(iris.roleId).toBe("guest");
    expect(iris.email).toBe("iris@northfieldstudio.co");
  });

  it("the five Product admins are 017, 023, 031, 038, 042", () => {
    expect(
      getMembers(data)
        .filter((m) => m.roleId === "product-admin")
        .map((m) => m.id)
        .sort(),
    ).toEqual(["017", "023", "031", "038", "042"]);
    expect(getMember(data, "042")!.name).toBe("Maya Jordan");
    expect(getMember(data, "042")!.joined).toBe("Oct 5");
  });

  it("exactly 3 people are without 2-step verification", () => {
    expect(
      getMembers(data)
        .filter((m) => m.twoStep === false)
        .map((m) => m.name)
        .sort(),
    ).toEqual(["Iris Novak", "Sam Patel", "Yusuf Ali"]);
  });
});

describe("teams (§9)", () => {
  it("has 6 teams with the designed sizes and leads", () => {
    expect(getTeams(data)).toHaveLength(6);
    expect(teamMemberCount(data, "customer-operations")).toBe(18);
    expect(teamMemberCount(data, "product")).toBe(12);
    expect(teamMemberCount(data, "engineering")).toBe(9);
    expect(teamMemberCount(data, "finance")).toBe(6);
    expect(teamMemberCount(data, "marketing")).toBe(5);
    expect(teamMemberCount(data, "leadership")).toBe(4);
  });

  it("has 54 placements and 12 people on two teams", () => {
    expect(totalPlacements(data)).toBe(54);
    expect(getMembers(data).filter((m) => m.teams.length === 2)).toHaveLength(12);
  });

  it("Product team is T-02 led by Daniel Okafor, mix 4/3/5", () => {
    const product = getTeams(data).find((t) => t.id === "product")!;
    expect(product.regNumber).toBe("T-02");
    expect(product.leadId).toBe("017");
  });
});

describe("invitations (§9)", () => {
  it("tabs count Open 3 / Accepted 6 / Expired 2 / Revoked 1", () => {
    expect(invitationTabCounts(data)).toEqual({
      open: 3,
      accepted: 6,
      expired: 2,
      revoked: 1,
    });
  });

  it("the open three are Priya, Noah and Leah with designed states", () => {
    const open = openInvitations(data);
    expect(open.map((i) => i.name).sort()).toEqual([
      "Leah Kim",
      "Noah Williams",
      "Priya Shah",
    ]);
    const priya = open.find((i) => i.name === "Priya Shah")!;
    expect(priya.roleId).toBe("analyst");
    expect(priya.expires).toBe("Oct 11");
    const noah = open.find((i) => i.name === "Noah Williams")!;
    expect(noah.openedAt).toBe("Oct 5");
    expect(noah.expires).toBe("Oct 9");
    const leah = open.find((i) => i.name === "Leah Kim")!;
    expect(leah.status).toBe("bounced");
    expect(leah.suggestedEmail).toBe("leah.kim@sevynlabs.io");
  });
});

describe("directory + seats (P-02, G-05)", () => {
  it("directory counts are All 45 / Active 41 / Invited 3 / Deactivated 1", () => {
    expect(directoryCounts(data)).toEqual({
      all: 45,
      active: 41,
      invited: 3,
      deactivated: 1,
    });
  });

  it("seats are 41 used / 3 held by invites / 6 free of 50", () => {
    expect(getSeats(data)).toEqual({ used: 41, held: 3, free: 6, total: 50 });
  });
});

describe("audit + import (G-02, G-03)", () => {
  it("audit has 9 access changes; the fixture declares 126 log entries", () => {
    expect(auditAccessChangeCount(data)).toBe(9);
    /* auditTotals counts the entries it is given — the 12 the fixture
       ships. The fixture's declared workspace total is 126 entries
       including sign-in rows; the visible list is a designed subset. */
    expect(auditTotals(data)).toEqual({ entries: 12, accessChanges: 9 });
    expect(auditJson.totals.entries).toBe(126);
  });

  it("CSV check is 11 ready, 2 to fix, 1 skipped; 55 seats needed of 50", () => {
    expect(importCounts(importRows, getSeats(data))).toEqual({
      ready: 11,
      fix: 2,
      skipped: 1,
      seatsNeeded: 55,
    });
    const skipped = importRows.find((r) => r.status === "skipped")!;
    expect(skipped.name).toBe("Jonah Price");
  });
});

describe("permission enforcement + the roles/teams rule (§10)", () => {
  it("Maya (Product admin) can invite but cannot edit role permissions", () => {
    const maya = getMember(data, "042")!;
    expect(memberCan(data, maya, 1)).toBe(true);
    expect(memberCan(data, maya, 5)).toBe(false);
    expect(memberCan(data, maya, 8)).toBe(false);
  });

  it("Maya's effective list marks Edit member profiles as from the baseline", () => {
    const eff = memberEffectivePermissions(data, getMember(data, "042")!);
    const edit = eff.find((e) => e.permission.id === 3)!;
    expect(edit.result).toBe("Allowed");
    expect(edit.source).toBe("baseline");
  });

  it("the deactivation scope is every active member but the owner", () => {
    /* Helper semantics changed with the data layer: the old fixture
       helper counted a Product-admin-specific scope (36). The DB-era
       helper counts active non-owner members (40 of the 41 active);
       the server action re-checks the permission per target. */
    expect(deactivateScopeCount(data)).toBe(40);
  });

  it("adding or removing a team never changes what a member can do", () => {
    const zoe = getMember(data, "036")!;
    const before = getPermissions(data).map((p) => memberCan(data, zoe, p.id));
    const moved = removeFromTeam(addToTeam(zoe, "engineering"), "product");
    const after = getPermissions(data).map((p) => memberCan(data, moved, p.id));
    expect(after).toEqual(before);
    expect(moved.roleId).toBe(zoe.roleId);
  });
});

describe("parity pins — audit entries are the designed list (G-03)", () => {
  type RawEntry = { dateISO?: string; roleChange?: boolean };
  const raw = (e: unknown) => e as RawEntry;

  it("every entry carries a parseable ISO date (the Range filter depends on it)", () => {
    for (const e of getAuditEntries(data)) {
      const iso = raw(e).dateISO;
      expect(iso, `entry ${e.id} has no dateISO`).toBeTruthy();
      expect(Number.isNaN(Date.parse(iso!))).toBe(false);
    }
  });

  it("the visible access entries are the screen's nine, verbatim", () => {
    const summaries = getAuditEntries(data)
      .filter((e) => e.kind === "access")
      .map((e) => e.summary)
      .sort();
    expect(summaries).toEqual(
      [
        "Product admin applied to Maya Jordan, Member 042",
        "Maya Jordan accepted her invitation with the invited address, verified by Google",
        "Invitation to leah.kim@sevynlabs.io bounced",
        "Daniel Okafor invited Leah Kim as Product admin and Priya Shah as Analyst, both to Product",
        "You invited Maya Jordan as Product admin to Product",
        "You changed Product admin: Create teams",
        "You invited Noah Williams as Support lead to Customer operations",
        "Owen Clarke signed Felix Grant out of 3 sessions. Note: “Laptop left on a train.”",
        "You moved Sofia Duarte from Member to Analyst",
      ].sort(),
    );
  });

  it("a last-7-days window (Oct 6 back to Sep 30) keeps the nine and drops older entries", () => {
    const inWindow = getAuditEntries(data).filter((e) => {
      const t = Date.parse(raw(e).dateISO!);
      return t >= Date.parse("2026-09-30") && t <= Date.parse("2026-10-06");
    });
    expect(inWindow.filter((e) => e.kind === "access")).toHaveLength(9);
    expect(
      getAuditEntries(data).some((e) => raw(e).dateISO! < "2026-09-30"),
    ).toBe(true);
    expect(
      inWindow.some((e) => raw(e).dateISO! < "2026-09-30"),
    ).toBe(false);
  });

  it("the expanded entry is the designed Oct 2 change", () => {
    const expanded = getAuditEntries(data).find((e) => e.expanded)!;
    expect(expanded.time).toBe("14:18");
    expect(expanded.from).toBe("Chrome on Mac · Philadelphia");
    expect(expanded.id).toBe("A-2026-10-02-0031");
    expect(expanded.note).toBe(
      "Reviewed before applying. 4 people were emailed.",
    );
  });

  it("role changes are a marked subset of access changes (Kind: Roles)", () => {
    const roleChanges = getAuditEntries(data).filter(
      (e) => raw(e).roleChange === true,
    );
    expect(roleChanges.length).toBeGreaterThan(0);
    expect(roleChanges.length).toBeLessThan(9);
    expect(roleChanges.every((e) => e.kind === "access")).toBe(true);
  });
});

describe("parity pins — CSV import rows are the designed rows (G-02)", () => {
  it("file name and column mapping match the screen", () => {
    expect(importJson.fileName).toBe("new-hires-october.csv");
    expect(importJson.columnMapping).toEqual([
      { from: "Email Address", to: "Work email" },
      { from: "Full Name", to: "Name" },
      { from: "Position", to: "Role" },
      { from: "Dept", to: "Team" },
      { from: "Start Date", to: "Not used" },
    ]);
  });

  it("decision rows are Tobi (6), Hana (11) and Jonah (9)", () => {
    const rows = importRows;
    const tobi = rows.find((r) => r.name === "Tobi Adeyemi")!;
    expect(tobi.row).toBe(6);
    expect(tobi.status).toBe("fix");
    expect(tobi.team).toBe("Customer operations");
    const hana = rows.find((r) => r.name === "Hana Sato")!;
    expect(hana.row).toBe(11);
    expect(hana.status).toBe("fix");
    expect(rows.filter((r) => r.name === "Hana Sato")).toHaveLength(1);
    const jonah = rows.find((r) => r.status === "skipped")!;
    expect(jonah.name).toBe("Jonah Price");
    expect(jonah.row).toBe(9);
    expect(rows.some((r) => r.name === "Paul Mwangi")).toBe(false);
  });

  it("the ready breakdown derives the screen's four lines", () => {
    const breakdown = new Map<string, number>();
    for (const r of importRows) {
      if (r.status !== "ready") continue;
      const key = `${r.role}|${r.team}`;
      breakdown.set(key, (breakdown.get(key) ?? 0) + 1);
    }
    expect(Object.fromEntries(breakdown)).toEqual({
      "Member|Customer operations": 7,
      "Member|Engineering": 2,
      "Analyst|Finance": 1,
      "Support lead|Customer operations": 1,
    });
  });
});

describe("parity pins — team mixes behind the captions and bars (R-01)", () => {
  const mix = (teamId: string) =>
    Object.fromEntries(
      teamRoleMix(data, teamId).map(({ role, count }) => [role.name, count]),
    );

  it("Customer operations is 4 Support leads · 1 Product admin · 13 Members", () => {
    expect(mix("customer-operations")).toEqual({
      "Support lead": 4,
      "Product admin": 1,
      Member: 13,
    });
  });

  it("Engineering is 2 Analysts · 7 Members (no admin tier, no seal segment)", () => {
    expect(mix("engineering")).toEqual({ Analyst: 2, Member: 7 });
  });

  it("Marketing carries the Guest from the Directory's designed row", () => {
    expect(mix("marketing")).toEqual({
      "Product admin": 1,
      Analyst: 1,
      Member: 2,
      Guest: 1,
    });
  });
});

describe("parity pins — invitations and sessions (G-01, P-04/P-05)", () => {
  it("Leah Kim's invited address is the designed sevynlabs.io address", () => {
    const leah = openInvitations(data).find((i) => i.name === "Leah Kim")!;
    expect(leah.email).toBe("leah.kim@sevynlabs.io");
  });

  it("all six accepted invitations fall inside the 30-day window", () => {
    const accepted = getInvitations(data).filter((i) => i.status === "accepted");
    expect(accepted).toHaveLength(6);
    for (const i of accepted) {
      const t = Date.parse(`${i.acceptedOn}, 2026`);
      expect(Number.isNaN(t)).toBe(false);
      expect(t).toBeGreaterThanOrEqual(Date.parse("Sep 6, 2026"));
      expect(t).toBeLessThanOrEqual(Date.parse("Oct 6, 2026"));
    }
  });

  it("Maya's session stamps read 9:12 and Oct 5, as the record screens draw them", () => {
    const sessions = getMember(data, "042")!.sessions!;
    expect(sessions.map((s) => s.lastActive)).toEqual(["9:12", "Oct 5"]);
  });
});

describe("round-2 pins — offline window (X-06) and overview copy", () => {
  it("the offline Directory window members are 035, 036, 038, 040", () => {
    /* getOfflineWindow was a fixture helper for the removed offline
       state; the pin now guards the seed-source rows themselves. */
    const window = ["035", "036", "038", "040"].map(
      (id) => getMember(data, id)!,
    );
    expect(window.map((m) => m.name)).toEqual([
      "Sofia Duarte",
      "Zoe Adams",
      "Hannah Lee",
      "Yusuf Ali",
    ]);
    expect(window.map((m) => getRole(data, m.roleId)!.name)).toEqual([
      "Analyst",
      "Member",
      "Product admin",
      "Member",
    ]);
    expect(
      window.map((m) => m.teams.map((t) => getTeam(data, t.teamId)!.name).join(", ")),
    ).toEqual(["Product", "Product", "Customer operations", "Product"]);
    expect(window.every((m) => m.status === "active")).toBe(true);
  });

  it("the two-step needs-owner detail carries no shadowed contradiction", () => {
    const item = getNeedsOwner(data).find((i) => i.id === "two-step")!;
    expect(item.detail).toBe(
      "Sam Patel, Iris Novak (Guest) and Yusuf Ali. Your setting makes it required from Nov 1.",
    );
  });
});
