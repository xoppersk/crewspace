/**
 * RLS static-analysis suite — the Crewspace security differentiator.
 *
 * Parses every migration in supabase/migrations/ and asserts the security
 * invariants statically (no live database needed). The live RLS isolation
 * suite (per-table × role × operation, against a scratch Supabase project)
 * is a later CI phase; these static checks are its compile-time complement
 * and catch an entire class of mistakes before any DB exists:
 *
 *   - a tenant table without RLS enabled
 *   - audit_log gaining an UPDATE/DELETE policy (T4)
 *   - a memberships UPDATE policy that permits self role edits (T1)
 *   - the permission catalog drifting from the 18 spec'd keys
 *   - a tenant table missing its org_id FK (T6)
 *   - helper functions created AFTER the policies that reference them
 *     (load-bearing migration ordering — this exact bug burned a past project)
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = dirname(fileURLToPath(import.meta.url));

const TENANT_TABLES = [
  "profiles",
  "organizations",
  "roles",
  "permissions",
  "role_permissions",
  "memberships",
  "teams",
  "team_memberships",
  "invitations",
  "audit_log",
] as const;

/** Tables that must carry org_id (permissions is the global catalog). */
const ORG_SCOPED_TABLES = TENANT_TABLES.filter((t) => t !== "permissions");

const EXPECTED_PERMISSION_KEYS = [
  "org:read",
  "org:update",
  "org:transfer_ownership",
  "members:read",
  "members:invite",
  "members:change_role",
  "members:deactivate",
  "teams:create",
  "teams:manage",
  "roles:create",
  "roles:assign",
  "roles:update",
  "roles:delete",
  "invitations:manage",
  "audit:read",
  "audit:export",
  "settings:manage",
  "billing:view",
];

function loadMigrations(): { file: string; sql: string }[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort()
    .map((file) => ({ file, sql: readFileSync(join(MIGRATIONS_DIR, file), "utf8") }));
}

function allSql(migrations: { sql: string }[]): string {
  return migrations.map((m) => m.sql).join("\n");
}

/** Split top-level statements on ";" (good enough for these migrations). */
function statements(sql: string): string[] {
  return sql
    .split(/;(\s*(?:\n|$))/)
    .map((s) => s.trim())
    .filter(Boolean);
}

describe("migration hygiene", () => {
  const migrations = loadMigrations();

  it("migrations are numbered sequentially from 00001 with no gaps", () => {
    const numbers = migrations.map((m) => Number(m.file.split("_")[0]));
    expect(numbers.at(0)).toBe(1);
    numbers.forEach((n, i) => expect(n).toBe(i + 1));
  });
  it("every migration file is non-empty", () => {
    for (const m of migrations) {
      expect(m.sql.trim().length, m.file).toBeGreaterThan(0);
    }
  });
});

describe("RLS is enabled on every tenant table", () => {
  const sql = allSql(loadMigrations());

  it.each(TENANT_TABLES)("%s has ENABLE ROW LEVEL SECURITY", (table) => {
    const re = new RegExp(
      `alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`,
      "i",
    );
    expect(sql, `${table}: missing ENABLE ROW LEVEL SECURITY`).toMatch(re);
  });
});

describe("audit_log immutability (T4)", () => {
  const sql = allSql(loadMigrations());
  const auditPolicies = statements(sql).filter((s) =>
    new RegExp(`create\\s+policy\\s+\\S+\\s+on\\s+public\\.audit_log\\b`, "i").test(s),
  );

  it("has INSERT and SELECT policies", () => {
    const kinds = auditPolicies.map(
      (s) => /for\s+(insert|select|update|delete|all)/i.exec(s)?.[1]?.toLowerCase() ?? "",
    );
    expect(kinds).toContain("insert");
    expect(kinds).toContain("select");
  });

  it("has NO update policy", () => {
    const updates = auditPolicies.filter((s) => /\bfor\s+update\b/i.test(s));
    expect(updates).toEqual([]);
  });

  it("has NO delete policy", () => {
    const deletes = auditPolicies.filter((s) => /\bfor\s+delete\b/i.test(s));
    expect(deletes).toEqual([]);
  });

  it("has NO for-all policy (which would smuggle update/delete)", () => {
    const all = auditPolicies.filter((s) => /\bfor\s+all\b/i.test(s));
    expect(all).toEqual([]);
  });

  it("has the audit_log_no_modify BEFORE UPDATE OR DELETE trigger", () => {
    expect(sql).toMatch(
      /create\s+trigger\s+audit_log_no_modify\s+before\s+update\s+or\s+delete\s+on\s+public\.audit_log/i,
    );
    // …and the trigger function unconditionally raises.
    const fn = /create\s+(?:or\s+replace\s+)?function\s+public\.audit_log_no_modify\(\)[\s\S]*?raise\s+exception/i;
    expect(sql, "audit_log_no_modify must raise").toMatch(fn);
  });
});

describe("memberships self-edit protection (T1)", () => {
  const sql = allSql(loadMigrations());
  const updatePolicies = statements(sql).filter(
    (s) =>
      /create\s+policy\s+\S+\s+on\s+public\.memberships\b/i.test(s) &&
      /\bfor\s+update\b/i.test(s),
  );

  it("has UPDATE policies on memberships", () => {
    expect(updatePolicies.length).toBeGreaterThan(0);
  });

  it("every UPDATE policy forbids touching your own row (user_id <> auth.uid())", () => {
    for (const p of updatePolicies) {
      expect(
        p,
        `memberships UPDATE policy missing self-edit guard:\n${p.slice(0, 160)}…`,
      ).toMatch(/user_id\s*<>\s*\(select\s+auth\.uid\(\)\)/i);
    }
  });

  it("has the column-level membership_update_guard trigger", () => {
    expect(sql).toMatch(
      /create\s+trigger\s+memberships_update_guard\s+before\s+update\s+on\s+public\.memberships/i,
    );
  });

  it("the guard requires members:change_role for role_id changes", () => {
    expect(sql).toMatch(/members:change_role/);
    const fn = /create\s+(?:or\s+replace\s+)?function\s+public\.membership_update_guard\(\)[\s\S]*?\$\$[\s\S]*?\$\$/i.exec(
      sql,
    )?.[0];
    expect(fn).toBeDefined();
    expect(fn).toMatch(/new\.role_id\s+is\s+distinct\s+from\s+old\.role_id/i);
    expect(fn).toMatch(/members:change_role/);
  });

  it("the guard requires members:deactivate for is_active changes", () => {
    const fn = /create\s+(?:or\s+replace\s+)?function\s+public\.membership_update_guard\(\)[\s\S]*?\$\$[\s\S]*?\$\$/i.exec(
      sql,
    )?.[0];
    expect(fn).toMatch(/new\.is_active\s+is\s+distinct\s+from\s+old\.is_active/i);
    expect(fn).toMatch(/members:deactivate/);
  });
});

describe("last-owner protection (T2)", () => {
  const sql = allSql(loadMigrations());

  it("has the prevent_last_owner_loss BEFORE UPDATE OR DELETE trigger on memberships", () => {
    expect(sql).toMatch(
      /create\s+trigger\s+memberships_prevent_last_owner_loss\s+before\s+update\s+or\s+delete\s+on\s+public\.memberships/i,
    );
  });

  it("the trigger raises when zero active owners would remain", () => {
    const fn = /create\s+(?:or\s+replace\s+)?function\s+public\.prevent_last_owner_loss\(\)[\s\S]*?\$\$[\s\S]*?\$\$/i.exec(
      sql,
    )?.[0];
    expect(fn).toBeDefined();
    expect(fn).toMatch(/raise\s+exception/i);
    expect(fn).toMatch(/last active owner/i);
  });
});

describe("cross-org role assignment guard (T6)", () => {
  const sql = allSql(loadMigrations());

  it("has the role_org_matches_membership trigger on memberships", () => {
    expect(sql).toMatch(
      /create\s+trigger\s+memberships_role_org_check\s+before\s+insert\s+or\s+update/i,
    );
    expect(sql).toMatch(/role_org_matches_membership/);
  });

  it("role_org_matches_membership is SECURITY DEFINER", () => {
    // Load-bearing: the roles SELECT RLS hides other orgs' roles from the
    // caller, so a non-definer check would see "no such role" and pass,
    // leaving the T6 hole open (FK enforcement itself bypasses RLS).
    const fn = /create\s+(?:or\s+replace\s+)?function\s+public\.role_org_matches_membership\(\)[\s\S]*?\$\$/i.exec(
      sql,
    )?.[0];
    expect(fn).toBeDefined();
    expect(fn).toMatch(/security\s+definer/i);
    expect(fn).toMatch(/set\s+search_path\s*=\s*public/i);
  });
});

describe("permission catalog", () => {
  const sql = allSql(loadMigrations());

  it("seeds all 18 permission keys", () => {
    for (const key of EXPECTED_PERMISSION_KEYS) {
      expect(sql, `missing permission key '${key}'`).toContain(`('${key}'`);
    }
  });

  it("seeds exactly 18 keys (no extras, no dupes)", () => {
    const found = EXPECTED_PERMISSION_KEYS.filter((k) => sql.includes(`('${k}'`));
    expect(found).toHaveLength(18);
  });

  it("permissions has a SELECT policy but no write policies", () => {
    const stmts = statements(sql).filter((s) =>
      /create\s+policy\s+\S+\s+on\s+public\.permissions\b/i.test(s),
    );
    expect(stmts.length).toBeGreaterThan(0);
    for (const s of stmts) {
      expect(s).toMatch(/\bfor\s+select\b/i);
      expect(s).not.toMatch(/\bfor\s+(insert|update|delete|all)\b/i);
    }
  });
});

describe("org_id tenancy (T6)", () => {
  const sql = allSql(loadMigrations());

  it.each(ORG_SCOPED_TABLES)("%s has an org_id FK to organizations", (table) => {
    // org_id column declared with a references-organizations constraint,
    // either inline in CREATE TABLE or via ALTER TABLE.
    const inline = new RegExp(
      `create\\s+table\\s+public\\.${table}\\s*\\([\\s\\S]*?org_id\\s+\\w+[^,]*references\\s+public\\.organizations`,
      "i",
    );
    const viaAlter = new RegExp(
      `alter\\s+table\\s+public\\.${table}[\\s\\S]*?references\\s+public\\.organizations`,
      "i",
    );
    const hasFk =
      inline.test(sql) ||
      (viaAlter.test(sql) && new RegExp(`org_id`, "i").test(sql));
    expect(hasFk, `${table}: missing org_id FK to organizations`).toBe(true);
  });

  it("memberships.role_id is ON DELETE RESTRICT (roles in use can't be dropped)", () => {
    expect(sql).toMatch(
      /create\s+table\s+public\.memberships\s*\([\s\S]*?role_id\s+uuid\s+not\s+null\s+references\s+public\.roles\s*\(id\)\s*on\s+delete\s+restrict/i,
    );
  });
});

describe("roles system-row immutability", () => {
  const sql = allSql(loadMigrations());
  const rolePolicies = statements(sql).filter((s) =>
    /create\s+policy\s+\S+\s+on\s+public\.roles\b/i.test(s),
  );
  const writePolicies = rolePolicies.filter((s) =>
    /\bfor\s+(insert|update|delete|all)\b/i.test(s),
  );

  it("every roles write policy requires is_system = false", () => {
    expect(writePolicies.length).toBeGreaterThan(0);
    for (const p of writePolicies) {
      expect(p, `roles write policy missing is_system guard:\n${p.slice(0, 160)}…`).toMatch(
        /is_system\s*=\s*false/i,
      );
    }
  });
});

describe("helper functions are locked down", () => {
  const sql = allSql(loadMigrations());

  it.each(["is_org_member", "has_permission", "user_permissions", "transfer_org_ownership"])(
    "%s is SECURITY DEFINER with a fixed search_path",
    (fn) => {
      // The clauses may appear in either order (SECURITY DEFINER ... SET
      // search_path, or vice versa) — check both are present near the def.
      const defRe = new RegExp(
        `create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.${fn}\\(`,
        "i",
      );
      const m = defRe.exec(sql);
      expect(m, `${fn} not defined`).toBeDefined();
      const window = sql.slice(m!.index, m!.index + 600);
      expect(window, `${fn}: missing SECURITY DEFINER`).toMatch(/security\s+definer/i);
      expect(window, `${fn}: missing fixed search_path`).toMatch(
        /set\s+search_path\s*=\s*public/i,
      );
    },
  );

  it("transfer_org_ownership is revoked from PUBLIC and granted to authenticated", () => {
    expect(sql).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.transfer_org_ownership\(uuid,\s*uuid\)\s+from\s+public/i,
    );
    expect(sql).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.transfer_org_ownership\(uuid,\s*uuid\)\s+to\s+authenticated/i,
    );
  });

  it("transfer_org_ownership derives the actor from auth.uid() (never a caller-supplied id)", () => {
    const defRe =
      /create\s+(?:or\s+replace\s+)?function\s+public\.transfer_org_ownership\(/i;
    const m = defRe.exec(sql);
    expect(m, "transfer_org_ownership not defined").toBeDefined();
    const window = sql.slice(m!.index, m!.index + 4000);
    expect(window).toMatch(/auth\.uid\(\)/);
    expect(window).not.toMatch(/p_actor/);
  });
});

describe("load-bearing migration ordering", () => {
  const migrations = loadMigrations();

  it("helper functions are created before any policy references them", () => {
    const helperFile = migrations.findIndex((m) =>
      /create\s+(?:or\s+replace\s+)?function\s+public\.is_org_member\(/i.test(m.sql),
    );
    expect(helperFile, "is_org_member not defined in any migration").toBeGreaterThanOrEqual(0);

    migrations.forEach((m, i) => {
      const refsHelper =
        /create\s+policy[\s\S]*?public\.(is_org_member|has_permission|user_permissions)\s*\(/i.test(
          m.sql,
        );
      if (refsHelper) {
        expect(
          i,
          `${m.file}: policy references a helper created in a LATER migration`,
        ).toBeGreaterThanOrEqual(helperFile);
      }
    });
  });

  it("no policy references a helper defined later in the same file", () => {
    for (const m of migrations) {
      // Strip comments — the headers discuss CREATE POLICY in prose.
      const code = m.sql
        .replace(/--[^\n]*/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "");
      const helperPos = code.search(
        /create\s+(?:or\s+replace\s+)?function\s+public\.(is_org_member|has_permission|user_permissions)\(/i,
      );
      if (helperPos === -1) continue;
      const policyPos = code.search(/create\s+policy/i);
      if (policyPos !== -1) {
        expect(
          policyPos,
          `${m.file}: policy defined before helper in the same file`,
        ).toBeGreaterThan(helperPos);
      }
    }
  });

  it("storage policies come after the helpers they call", () => {
    const helperFile = migrations.findIndex((m) =>
      /create\s+(?:or\s+replace\s+)?function\s+public\.is_org_member\(/i.test(m.sql),
    );
    const storageFile = migrations.findIndex((m) =>
      /create\s+policy\s+"org-logos select"/i.test(m.sql),
    );
    expect(storageFile).toBeGreaterThan(helperFile);
  });
});

describe("storage buckets", () => {
  const sql = allSql(loadMigrations());

  it("creates the org-logos and avatars buckets as private", () => {
    expect(sql).toMatch(/insert\s+into\s+storage\.buckets[\s\S]*?'org-logos'[\s\S]*?false/i);
    expect(sql).toMatch(/insert\s+into\s+storage\.buckets[\s\S]*?'avatars'[\s\S]*?false/i);
  });

  it("avatars writes are restricted to the owner's own path", () => {
    const stmts = statements(sql).filter((s) =>
      /create\s+policy\s+"avatars (insert|update|delete) own"/i.test(s),
    );
    expect(stmts.length).toBe(3);
    for (const s of stmts) {
      expect(s).toMatch(/\(storage\.foldername\(name\)\)\[1\]\s*=\s*\(select\s+auth\.uid\(\)\)::text/i);
    }
  });
});

describe("invitation accept function (T3)", () => {
  const sql = allSql(loadMigrations());

  it("accept_invitation verifies hash, pending status, and expiry in one transaction", () => {
    const fn = /create\s+(?:or\s+replace\s+)?function\s+public\.accept_invitation\([\s\S]*?\$\$[\s\S]*?\$\$/i.exec(
      sql,
    )?.[0];
    expect(fn).toBeDefined();
    expect(fn).toMatch(/digest\(p_token,\s*'sha256'\)/i);
    expect(fn).toMatch(/status\s*<>\s*'pending'/i);
    expect(fn).toMatch(/expires_at\s*<=\s*now\(\)/i);
    expect(fn).toMatch(/for\s+update/i); // row lock: single-use under races
  });

  it("accept_invitation is SECURITY DEFINER, revoked from public, granted to authenticated", () => {
    expect(sql).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.accept_invitation\(text,\s*uuid\)\s+from\s+public/i,
    );
    expect(sql).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.accept_invitation\(text,\s*uuid\)\s+to\s+authenticated/i,
    );
  });
});

describe("profiles.email for directory search", () => {
  const sql = allSql(loadMigrations());

  it("adds profiles.email as nullable citext (00013)", () => {
    expect(sql).toMatch(/alter\s+table\s+public\.profiles\s+add\s+column\s+if\s+not\s+exists\s+email\s+citext/i);
  });

  it("handle_new_user() stamps the email from NEW.email", () => {
    // The latest definition of handle_new_user wins (00013 rewrites 00002's).
    const defs = [
      ...sql.matchAll(
        /create\s+(?:or\s+replace\s+)?function\s+public\.handle_new_user\(\)[\s\S]*?\$\$([\s\S]*?)\$\$/gi,
      ),
    ];
    expect(defs.length).toBeGreaterThan(0);
    const latest = defs[defs.length - 1]![1]!;
    expect(latest).toMatch(/nullif\(new\.email/i);
  });

  it("syncs profiles.email when auth.users.email changes", () => {
    expect(sql).toMatch(
      /create\s+trigger\s+on_auth_user_email_changed\s+after\s+update\s+of\s+email\s+on\s+auth\.users/i,
    );
  });

  it("adds no new RLS policy for the email column (it rides the profile row's policies)", () => {
    // A dedicated email policy would be a smell — the column must stay under
    // the same SELECT policies as the rest of the profiles row.
    const emailPolicies = sql.match(/create\s+policy\s+"[^"]*email[^"]*"/gi) ?? [];
    expect(emailPolicies).toEqual([]);
  });
});
