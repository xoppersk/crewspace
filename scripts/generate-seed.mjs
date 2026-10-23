#!/usr/bin/env node
/**
 * generate-seed.mjs — Worker S
 *
 * Reads the v2 canon fixtures in data/*.json and EMITS
 * supabase/seed-production.sql: Sheku's sample workspace ONLY
 * ("Sevyn Labs", slug sevyn-labs). New public sign-ups never see this
 * data; they get an empty workspace from create_workspace() (00017).
 *
 * Usage:  node scripts/generate-seed.mjs
 * No dependencies beyond Node itself.
 *
 * Key decisions (see production/WORKER-S-SCHEMA.md for the full record):
 *  - Member 001 (Sheku Koroma) auth email is xoppersk@gmail.com (his real
 *    login). Per 00013, profiles.email mirrors auth.users.email, so the
 *    profile email is xoppersk@gmail.com too; the roster email
 *    sheku@sevynlabs.io appears only in comments here.
 *  - Every seeded auth user gets a RANDOM password
 *    (crypt(gen_random_uuid()::text, gen_salt('bf'))) — roster accounts,
 *    not shared/demo credentials. Sheku sets his own password through
 *    the real password-reset flow.
 *  - UUIDs are deterministic (md5-derived) so the seed is re-runnable
 *    with ON CONFLICT DO NOTHING and debuggable by the coordinator.
 *  - Fixture timestamps are kept; bare "Mon D" dates resolve to 2026
 *    (the fixtures' "today" is Tuesday, October 6, 2026). Nothing is
 *    re-dated to the run date.
 *  - overview.json / import.json are NOT seeded: they are derived UI
 *    aggregates and a CSV-import preview, with no tables in the schema.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (name) => JSON.parse(readFileSync(join(root, "data", name), "utf8"));

const org = readJson("org.json");
const members = readJson("members.json").members;
const teams = readJson("teams.json").teams;
const invitations = readJson("invitations.json").invitations;
const auditEntries = readJson("audit.json").entries;

// ---------------------------------------------------------------------------
// Permission mapping — SINGLE SOURCE, mirrored in 00017_create_workspace.sql
// v2 fixture permission id -> v1 catalog key (DB-enforced subset).
// Fixture ids 12 / 14 / 16 are app-layer only and intentionally absent.
// ---------------------------------------------------------------------------
const PERM_MAP_DB = {
  1: "members:invite",
  2: "members:deactivate",
  3: "members:read",
  4: "members:change_role",
  5: "roles:update",
  6: "roles:create",
  7: "audit:read",
  8: "audit:export",
  9: "teams:create",
  10: "teams:manage",
  11: "invitations:manage",
  13: "settings:manage",
  15: "billing:view",
  17: "org:update",
  18: "org:transfer_ownership",
};
const ALL_V1_KEYS = [
  "org:read", "org:update", "org:transfer_ownership",
  "members:read", "members:invite", "members:change_role", "members:deactivate",
  "teams:create", "teams:manage",
  "roles:create", "roles:assign", "roles:update", "roles:delete",
  "invitations:manage", "audit:read", "audit:export",
  "settings:manage", "billing:view",
];
const BASELINE_ALLOWED = new Set(org.baseline.allowedPermissionIds); // [3]

/** Committed register translation for one fixture role -> {grants, denies}. */
function translateRole(role) {
  if (role.id === "owner") return { grants: [...ALL_V1_KEYS], denies: [] };
  const grants = new Set(["org:read"]); // platform baseline: read own org shell
  const denies = new Set();
  for (const [idStr, state] of Object.entries(role.settings)) {
    const key = PERM_MAP_DB[idStr];
    if (!key) continue; // app-layer only (12/14/16)
    if (state === "allow") grants.add(key);
    else if (state === "deny") denies.add(key);
    else if (state === "locked") denies.add(key); // #18 non-owner
    else if (state === "inherit" && BASELINE_ALLOWED.has(Number(idStr))) grants.add(key);
  }
  for (const k of denies) grants.delete(k); // deny always wins (00015 semantics)
  return { grants: [...grants], denies: [...denies] };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const sqlStr = (v) => (v === null || v === undefined ? "null" : `'${String(v).replaceAll("'", "''")}'`);
const sqlTs = (v) => `${sqlStr(v)}::timestamptz`;

function uuidFrom(seed) {
  const h = createHash("md5").update(`crewspace-prod-seed:${seed}`).digest("hex");
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
const userId = (memberId) => uuidFrom(`member:${memberId}`);
const roleUuid = (roleId) => uuidFrom(`role:${roleId}`);
const teamUuid = (teamId) => uuidFrom(`team:${teamId}`);
const ORG_ID = uuidFrom("org:sevyn-labs");
const SHEKU_ID = "001";
const shekuUserId = userId(SHEKU_ID);
const AUTH_EMAIL_OVERRIDE = { [SHEKU_ID]: "xoppersk@gmail.com" }; // member 001's real login
const authEmail = (m) => AUTH_EMAIL_OVERRIDE[m.id] ?? m.email;

const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
const pad = (n) => String(n).padStart(2, "0");
/** "Jan 2025" -> 2025-01-01T12:00Z · "Oct 5" -> 2026-10-05T12:00Z · "Oct 5, 2026" style also ok */
function parseFixtureDate(s) {
  if (!s) return null;
  const t = String(s).trim();
  let m = t.match(/^([A-Z][a-z]{2}) (\d{4})$/);
  if (m) return `${m[2]}-${pad(MONTHS[m[1]])}-01T12:00:00Z`;
  m = t.match(/^([A-Z][a-z]{2}) (\d{1,2})(?:, (\d{4}))?$/);
  if (m) return `${m[3] ?? 2026}-${pad(MONTHS[m[1]])}-${pad(Number(m[2]))}T12:00:00Z`;
  if (t === "Now" || t === "Today") return "2026-10-06T12:00:00Z";
  if (t === "Yesterday") return "2026-10-05T12:00:00Z";
  throw new Error(`Unparseable fixture date: ${JSON.stringify(s)}`);
}

// ---------------------------------------------------------------------------
// Canon self-checks (fail the generator, not the database)
// ---------------------------------------------------------------------------
const placements = members.reduce((n, m) => n + (m.teams?.length ?? 0), 0);
const checks = [
  ["members", members.length, 42],
  ["roles", org.roles.length, 9],
  ["permissions", org.permissions.length, 18],
  ["teams", teams.length, 7],
  ["placements", placements, 54],
];
for (const [label, got, want] of checks) {
  if (got !== want) throw new Error(`Canon mismatch: ${label} = ${got}, expected ${want}`);
}
const memberById = new Map(members.map((m) => [m.id, m]));
const memberByEmail = new Map(members.map((m) => [m.email, m]));
const roleById = new Map(org.roles.map((r) => [r.id, r]));
const teamById = new Map(teams.map((t) => [t.id, t]));

const INV_STATUS = { open: "pending", bounced: "pending", accepted: "accepted", expired: "expired", revoked: "revoked" };
const AUDIT_ACTION = {
  "sign-in": "auth.sign_in",
  access: "access.change",
  invitation: "invitation.event",
  team: "team.change",
  settings: "settings.updated",
  review: "access.review",
};

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------
const out = [];
const emit = (s = "") => out.push(s);

emit(`-- =============================================================================`);
emit(`-- seed-production.sql — GENERATED by scripts/generate-seed.mjs`);
emit(`-- DO NOT EDIT BY HAND. Regenerate: node scripts/generate-seed.mjs`);
emit(`--`);
emit(`-- Sheku's sample workspace ONLY: "${org.name}" (slug sevyn-labs), seeded`);
emit(`-- from the v2 canon fixtures in data/*.json. New public sign-ups get an`);
emit(`-- EMPTY workspace from create_workspace() (00017) — never this data.`);
emit(`--`);
emit(`-- Requires migrations 00001-00019 applied (incl. seat_price_cents,`);
emit(`-- reg_number, is_unlisted, role_permission_changes).`);
emit(`--`);
emit(`-- Passwords: every auth user below gets a RANDOM password`);
emit(`-- (crypt of a random uuid). These are roster accounts, not shared or`);
emit(`-- demo credentials. Member 001 Sheku Koroma signs in as`);
emit(`-- xoppersk@gmail.com (his real login; roster email sheku@sevynlabs.io`);
emit(`-- is NOT used as an auth/profile email — profiles.email mirrors`);
emit(`-- auth.users.email per 00013) and sets his password via the real`);
emit(`-- password-reset flow.`);
emit(`--`);
emit(`-- PRE-FLIGHT (coordinator): if an auth user with email`);
emit(`-- xoppersk@gmail.com already exists on the live project with a`);
emit(`-- different id, this seed's auth insert will hit the email unique`);
emit(`-- index — remap member 001's id to the existing user instead.`);
emit(`-- =============================================================================`);
emit(``);
emit(`begin;`);
emit(``);
// --- auth.users -------------------------------------------------------------
emit(`-- ---------------------------------------------------------------------------`);
emit(`-- 1. auth.users — 42 roster accounts, random passwords, emails confirmed`);
emit(`-- ---------------------------------------------------------------------------`);
emit(`insert into auth.users (`);
emit(`  instance_id, id, aud, role, email, encrypted_password,`);
emit(`  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,`);
emit(`  created_at, updated_at`);
emit(`) values`);
const userRows = members.map((m) => {
  const joined = parseFixtureDate(m.joined);
  return `  ((select id from auth.instances limit 1), ${sqlStr(userId(m.id))}::uuid, 'authenticated', 'authenticated', ${sqlStr(authEmail(m))}, crypt(gen_random_uuid()::text, gen_salt('bf')), ${sqlTs(joined)}, '{"provider":"email","providers":["email"]}'::jsonb, ${sqlStr(JSON.stringify({ full_name: m.name }))}::jsonb, ${sqlTs(joined)}, ${sqlTs(joined)})`;
});
emit(userRows.join(",\n"));
emit(`on conflict (id) do nothing;`);
emit(``);
emit(`-- The on_auth_user_created trigger created profile stubs; fill them in.`);
for (const m of members) {
  emit(`update public.profiles set full_name = ${sqlStr(m.name)}, title = ${sqlStr(m.title ?? null)}, email = ${sqlStr(authEmail(m))}, email_verified = true where id = ${sqlStr(userId(m.id))}::uuid;`);
}
emit(``);

// --- organization -----------------------------------------------------------
emit(`-- ---------------------------------------------------------------------------`);
emit(`-- 2. Organization "${org.name}" + plan config (price is CONFIG, not code)`);
emit(`-- ---------------------------------------------------------------------------`);
emit(`insert into public.organizations (id, name, slug, invite_policy, is_demo, created_by, seat_price_cents, allowed_domains)`);
emit(`values (${sqlStr(ORG_ID)}::uuid, ${sqlStr(org.name)}, 'sevyn-labs', 'admins', false, ${sqlStr(shekuUserId)}::uuid, ${Math.round(org.plan.pricePerSeat * 100)}, ${sqlStr(`{${org.domain}}`)}::text[])`);
emit(`on conflict (id) do nothing;`);
emit(``);

// --- roles ------------------------------------------------------------------
emit(`-- ---------------------------------------------------------------------------`);
emit(`-- 3. The 9 canon roles with committed register states`);
emit(`--    allow -> role_permissions · deny/locked -> role_permission_denies ·`);
emit(`--    inherit -> neither (except permission 3, granted via the org`);
emit(`--    baseline allowedPermissionIds=[3]). See PERM_MAP_DB in the`);
emit(`--    generator and the mapping comment in 00017.`);
emit(`-- ---------------------------------------------------------------------------`);
const SYSTEM_KEY = { owner: "owner", member: "member", guest: "guest" };
const ROLE_COLOR = { owner: "primary", member: "neutral", guest: "neutral", "product-admin": "blue", "support-lead": "amber", analyst: "violet", "finance-viewer": "green", auditor: "neutral", "billing-admin": "amber" }; // mirrors 00017
for (const r of org.roles) {
  const isSystem = r.type === "System";
  emit(`insert into public.roles (id, org_id, name, description, is_system, system_key, color, created_by, reg_number) values (${sqlStr(roleUuid(r.id))}::uuid, ${sqlStr(ORG_ID)}::uuid, ${sqlStr(r.name)}, ${sqlStr(r.summary)}, ${isSystem}, ${sqlStr(SYSTEM_KEY[r.id] ?? null)}, ${sqlStr(ROLE_COLOR[r.id] ?? "neutral")}, ${sqlStr(shekuUserId)}::uuid, ${sqlStr(r.regNumber)}) on conflict (id) do nothing;`);
}
emit(``);
for (const r of org.roles) {
  const { grants, denies } = translateRole(r);
  for (const key of grants) {
    emit(`insert into public.role_permissions (role_id, permission_key, granted_by) values (${sqlStr(roleUuid(r.id))}::uuid, ${sqlStr(key)}, ${sqlStr(shekuUserId)}::uuid) on conflict do nothing;`);
  }
  for (const key of denies) {
    emit(`insert into public.role_permission_denies (role_id, permission_key, denied_by) values (${sqlStr(roleUuid(r.id))}::uuid, ${sqlStr(key)}, ${sqlStr(shekuUserId)}::uuid) on conflict do nothing;`);
  }
}
emit(``);
emit(`update public.organizations set default_role_id = ${sqlStr(roleUuid("member"))}::uuid where id = ${sqlStr(ORG_ID)}::uuid;`);
emit(``);

// --- memberships --------------------------------------------------------------
emit(`-- ---------------------------------------------------------------------------`);
emit(`-- 4. Memberships — 42, canon roleIds/status. Member 033 is deactivated`);
emit(`--    (deactivatedBy "Sheku Koroma" in the fixture -> member 001).`);
emit(`-- ---------------------------------------------------------------------------`);
for (const m of members) {
  const deactivated = m.status === "deactivated";
  emit(`insert into public.memberships (org_id, user_id, role_id, is_active, deactivated_at, deactivated_by, last_active_at, joined_at) values (${sqlStr(ORG_ID)}::uuid, ${sqlStr(userId(m.id))}::uuid, ${sqlStr(roleUuid(m.roleId))}::uuid, ${!deactivated}, ${deactivated ? sqlTs(parseFixtureDate(m.deactivatedOn)) : "null"}, ${deactivated ? `${sqlStr(shekuUserId)}::uuid` : "null"}, ${sqlTs(parseFixtureDate(m.lastActive))}, ${sqlTs(parseFixtureDate(m.joined))}) on conflict (org_id, user_id) do nothing;`);
}
emit(``);

// --- teams + placements -------------------------------------------------------
emit(`-- ---------------------------------------------------------------------------`);
emit(`-- 5. Teams — 7 (Partnerships is unlisted) + exactly 54 placements from`);
emit(`--    members.json teams[]. Lead pointers follow teams.json leadId.`);
emit(`-- ---------------------------------------------------------------------------`);
for (const t of teams) {
  emit(`insert into public.teams (id, org_id, name, description, is_archived, is_unlisted, reg_number, created_by) values (${sqlStr(teamUuid(t.id))}::uuid, ${sqlStr(ORG_ID)}::uuid, ${sqlStr(t.name)}, ${sqlStr(t.blurb)}, false, ${Boolean(t.unlisted)}, ${sqlStr(t.regNumber)}, ${sqlStr(shekuUserId)}::uuid) on conflict (id) do nothing;`);
}
emit(``);
const membershipUuidExpr = (memberId) =>
  `(select id from public.memberships where org_id = ${sqlStr(ORG_ID)}::uuid and user_id = ${sqlStr(userId(memberId))}::uuid)`;
for (const m of members) {
  for (const tm of m.teams ?? []) {
    emit(`insert into public.team_memberships (team_id, membership_id, added_by) values (${sqlStr(teamUuid(tm.teamId))}::uuid, ${membershipUuidExpr(m.id)}, ${sqlStr(shekuUserId)}::uuid) on conflict do nothing;`);
  }
}
emit(``);
for (const t of teams) {
  if (t.leadId) {
    emit(`update public.teams set lead_membership_id = ${membershipUuidExpr(t.leadId)} where id = ${sqlStr(teamUuid(t.id))}::uuid;`);
  }
}
emit(``);

// --- draft register changes ---------------------------------------------------
emit(`-- ---------------------------------------------------------------------------`);
emit(`-- 6. Draft register changes — Product admin's 2 pendingChanges from`);
emit(`--    org.json, stored as PENDING rows (00019). Committed state above`);
emit(`--    deliberately does NOT include them.`);
emit(`-- ---------------------------------------------------------------------------`);
for (const r of org.roles) {
  for (const pc of r.pendingChanges ?? []) {
    const key = PERM_MAP_DB[pc.permissionId];
    if (!key) throw new Error(`pendingChange permission ${pc.permissionId} has no DB key`);
    emit(`insert into public.role_permission_changes (org_id, role_id, permission_key, from_state, to_state, status, proposed_by, proposed_at) values (${sqlStr(ORG_ID)}::uuid, ${sqlStr(roleUuid(r.id))}::uuid, ${sqlStr(key)}, ${sqlStr(pc.from)}, ${sqlStr(pc.to)}, 'pending', ${sqlStr(shekuUserId)}::uuid, '2026-10-02T14:18:00Z'::timestamptz) on conflict do nothing;`);
  }
}
emit(``);

// --- invitations ---------------------------------------------------------------
emit(`-- ---------------------------------------------------------------------------`);
emit(`-- 7. Invitations — 12 from fixtures. Status map: open->pending,`);
emit(`--    bounced->pending (no DB 'bounced' status exists; the bounce and`);
emit(`--    suggested address are recorded in message), accepted/expired/`);
emit(`--    revoked as-is. token_hash = sha256 of a deterministic seed`);
emit(`--    string; openedAt has no column and lives only in the fixture.`);
emit(`-- ---------------------------------------------------------------------------`);
for (const inv of invitations) {
  const tokenHash = createHash("sha256").update(`crewspace-prod-seed-invite:${inv.id}`).digest("hex");
  const status = INV_STATUS[inv.status];
  if (!status) throw new Error(`Unknown invitation status ${inv.status}`);
  const acceptedMember = inv.status === "accepted" ? memberByEmail.get(inv.email) : null;
  const message = inv.status === "bounced"
    ? `Delivery bounced.${inv.suggestedEmail ? ` Suggested address: ${inv.suggestedEmail}` : ""}`
    : null;
  emit(`insert into public.invitations (org_id, email, role_id, team_ids, token_hash, status, invited_by, message, source, expires_at, accepted_at, accepted_user_id, created_at) values (${sqlStr(ORG_ID)}::uuid, ${sqlStr(inv.email)}::citext, ${sqlStr(roleUuid(inv.roleId))}::uuid, array[${sqlStr(teamUuid(inv.teamId))}::uuid], ${sqlStr(tokenHash)}, ${sqlStr(status)}, ${sqlStr(userId(inv.invitedById))}::uuid, ${sqlStr(message)}, 'manual', ${sqlTs(parseFixtureDate(inv.expires))}, ${inv.acceptedOn ? sqlTs(parseFixtureDate(inv.acceptedOn)) : "null"}, ${acceptedMember ? `${sqlStr(userId(acceptedMember.id))}::uuid` : "null"}, ${sqlTs(parseFixtureDate(inv.sent))}) on conflict (token_hash) do nothing;`);
}
emit(``);

// --- audit ---------------------------------------------------------------------
emit(`-- ---------------------------------------------------------------------------`);
emit(`-- 8. Audit entries — 12 from fixtures (the fixture file is a recent`);
emit(`--    page of a 126-entry log; totals live in the fixture only).`);
emit(`--    actorId 'system' maps to member 001 (audit_log.actor_id is a`);
emit(`--    NOT NULL FK); the full fixture entry is preserved in metadata.`);
emit(`-- ---------------------------------------------------------------------------`);
for (const e of auditEntries) {
  const actorId = e.actorId === "system" ? SHEKU_ID : e.actorId;
  if (!memberById.has(actorId)) throw new Error(`Audit actor ${e.actorId} is not a member`);
  const createdAt = `${e.dateISO}T${e.time}:00Z`;
  emit(`insert into public.audit_log (id, org_id, actor_id, action, target_type, target_label, metadata, created_at) values (${sqlStr(uuidFrom(`audit:${e.id}`))}::uuid, ${sqlStr(ORG_ID)}::uuid, ${sqlStr(userId(actorId))}::uuid, ${sqlStr(AUDIT_ACTION[e.kind] ?? "access.change")}, ${sqlStr(e.kind)}, ${sqlStr(String(e.summary).slice(0, 200))}, ${sqlStr(JSON.stringify(e))}::jsonb, ${sqlTs(createdAt)}) on conflict (id) do nothing;`);
}
emit(``);

// --- assertions ------------------------------------------------------------------
emit(`-- ---------------------------------------------------------------------------`);
emit(`-- 9. Assertions — the seed FAILS LOUDLY if the canon counts drift.`);
emit(`-- ---------------------------------------------------------------------------`);
emit(`do $$`);
emit(`declare`);
emit(`  v_org uuid := ${sqlStr(ORG_ID)}::uuid;`);
emit(`begin`);
emit(`  if (select count(*) from public.memberships where org_id = v_org) <> 42 then`);
emit(`    raise exception 'seed assertion failed: memberships for Sevyn Labs must be 42';`);
emit(`  end if;`);
emit(`  if (select count(*) from public.roles where org_id = v_org) <> 9 then`);
emit(`    raise exception 'seed assertion failed: roles for Sevyn Labs must be 9';`);
emit(`  end if;`);
emit(`  if (select count(*) from public.permissions) <> 18 then`);
emit(`    raise exception 'seed assertion failed: permission catalog must be 18';`);
emit(`  end if;`);
emit(`  if (select count(*) from public.teams where org_id = v_org) <> 7 then`);
emit(`    raise exception 'seed assertion failed: teams for Sevyn Labs must be 7';`);
emit(`  end if;`);
emit(`  if (select count(*) from public.team_memberships tm`);
emit(`        join public.teams t on t.id = tm.team_id where t.org_id = v_org) <> 54 then`);
emit(`    raise exception 'seed assertion failed: team placements for Sevyn Labs must be 54';`);
emit(`  end if;`);
emit(`end $$;`);
emit(``);
emit(`commit;`);
emit(``);

const target = join(root, "supabase", "seed-production.sql");
writeFileSync(target, out.join("\n"), "utf8");
console.log(`Wrote ${target} (${out.length} lines)`);
console.log(`Canon: members=${members.length} roles=${org.roles.length} permissions=${org.permissions.length} teams=${teams.length} placements=${placements} invitations=${invitations.length} audit=${auditEntries.length}`);
