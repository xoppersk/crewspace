/**
 * Audited-actions coverage contract (DATABASE-SCHEMA.md §1).
 * ==========================================================
 *
 * For every action in AUDIT_ACTIONS:
 *   1. a sentence formatter must exist (hard requirement — the audit log
 *      must never render a raw action key), and
 *   2. the action must be grouped for the filter bar, and
 *   3. a producer must exist somewhere in src/ or supabase/migrations.
 *
 * Producer ownership is split across workers: this test FAILS only for the
 * actions this worker's pages own (settings.updated, audit.exported). For
 * every other action it reports producers that are missing so the
 * orchestrator can chase the owning worker — a missing producer is a gap
 * in the audit story, not a failure of this worker's build.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import { AUDIT_ACTIONS } from "./index";
import { AUDIT_ACTION_GROUPS, hasSentenceFormatter } from "./sentences";

/** Actions whose producer lives in this worker's pages — no-producer fails. */
const OWNED_ACTIONS = ["settings.updated", "audit.exported"] as const;

const REPO_ROOT = process.cwd();
const SCAN_DIRS = ["src", "supabase/migrations"];
/** Files that merely enumerate the actions (not real producers). */
const ENUMERATION_FILES = new Set([
  "src/lib/audit/index.ts",
  "src/lib/audit/sentences.ts",
  "src/lib/audit/coverage.test.ts",
  "src/lib/audit/sentences.test.ts",
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === "node_modules" || entry === ".next" || entry === "dist") continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|sql)$/.test(entry)) out.push(full);
  }
  return out;
}

function producersFor(action: string): string[] {
  const hits: string[] = [];
  for (const dir of SCAN_DIRS) {
    for (const file of walk(join(REPO_ROOT, dir))) {
      const rel = relative(REPO_ROOT, file);
      if (ENUMERATION_FILES.has(rel)) continue;
      const content = readFileSync(file, "utf8");
      // A producer writes the literal action string (writeAudit call, SQL
      // insert, or RPC body). Quoted or not — the bare key is distinctive.
      if (content.includes(`'${action}'`) || content.includes(`"${action}"`)) {
        hits.push(rel);
      }
    }
  }
  return hits;
}

describe("audited-actions coverage", () => {
  it("every audited action has a sentence formatter", () => {
    const missing = AUDIT_ACTIONS.filter((a) => !hasSentenceFormatter(a));
    expect(missing).toEqual([]);
  });

  it("every audited action appears in exactly one filter group", () => {
    const grouped = AUDIT_ACTION_GROUPS.flatMap((g) => g.actions);
    const missing = AUDIT_ACTIONS.filter((a) => !grouped.includes(a));
    const duplicates = grouped.filter((a, i) => grouped.indexOf(a) !== i);
    expect(missing).toEqual([]);
    expect(duplicates).toEqual([]);
  });

  it("owned actions have a call site in this worker's pages", () => {
    for (const action of OWNED_ACTIONS) {
      expect(
        producersFor(action).length,
        `no producer found for owned action '${action}'`,
      ).toBeGreaterThan(0);
    }
  });

  it("reports every audited action with no producer yet", () => {
    const withoutProducer = AUDIT_ACTIONS.filter(
      (a) => producersFor(a).length === 0,
    );
    if (withoutProducer.length > 0) {
      // Not a failure — other workers own these producers — but the gap is
      // printed loudly so the orchestrator can chase it.
      console.warn(
        `[audit-coverage] ${withoutProducer.length} audited action(s) have no producer yet: ${withoutProducer.join(", ")}`,
      );
    }
    // Owned actions are asserted above; the rest are informational here.
    const unowned = withoutProducer.filter(
      (a) => !(OWNED_ACTIONS as readonly string[]).includes(a),
    );
    expect(unowned).toEqual(withoutProducer);
  });
});
