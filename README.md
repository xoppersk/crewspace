# Crewspace — Know Exactly Who Can Do What

**Crewspace** is a multi-tenant team workspace where organizations manage **who can do what** — members, teams, custom roles with a granular permission matrix, and an immutable audit trail of every privileged action. The core loop is **invite → assign → verify**: an owner creates a workspace, invites teammates by email, assigns roles whose permissions are explicit and discoverable, and every change lands in an append-only audit log.

This is a **portfolio flagship** built to demonstrate production-grade RBAC engineering: multi-tenant data isolation via PostgreSQL Row Level Security, defense-in-depth authorization (UI gating → server re-check → RLS), realtime presence, and a tokenized invitation lifecycle.

> **One outcome metric:** authorization p95 ≤ 50 ms — the 95th-percentile latency of the full permission-check path (`user_permissions()` resolution plus the `requireOrgAccess` assertion inside a Server Action). The `[orgSlug]` layout resolves permissions once per request; RLS carries per-row enforcement with zero extra round trips.

## Tech stack

- **Next.js 16** App Router (TypeScript strict), Server Components for data-heavy admin pages, Client Components for realtime + interactive tables
- **PostgreSQL with Row Level Security** (via Supabase) — RLS on every tenant table; JWT auth via Supabase Auth (email/password + magic link)
- **Supabase Realtime** — per-org presence channels + Postgres Changes live tail on the audit log
- **Supabase Storage** — private `org-logos` / `avatars` buckets, signed URLs
- **shadcn/ui + Tailwind CSS v4**, Zod validation shared between client forms and server actions, Vitest

## Architecture

```
Browser → Next.js Server Action → requireOrgAccess(orgId, permission) → RLS → Postgres
                                        │
                                        ▼
                              user_permissions(org_id, user_id)
                              SECURITY DEFINER SQL function returning
                              the union of permission keys — called once
                              per request in the [orgSlug] layout,
                              cached per request, never cached grants
```

**Three enforcement layers** (threat model assumes an authenticated low-privilege member):
1. **UI gating** — nav items, buttons, matrix cells hidden/disabled per `usePermissions()`, with plain-language explanations.
2. **Server re-check** — every Server Action goes through `requireOrgAccess`, which re-reads the user, reloads the membership, and re-asserts the permission. No raw Supabase client creation in handlers.
3. **Row Level Security** — every tenant table's policies bind `auth.uid()` → active `memberships` → `org_id`. A forged request can never outrun the user's real grants.

**Database-level guardrails** (fire even for service-role connections): `prevent_last_owner_loss()` trigger (last owner can't be demoted/removed), `membership_update_guard()` (column-level: `role_id` changes need `members:change_role`, `is_active` needs `members:deactivate`, never on one's own row), `audit_log_no_modify()` (audit history is immutable — no UPDATE/DELETE policy exists).

## Features

- **Organizations** — create (name, slug, logo), org switcher, settings (general / member policy / security / plan)
- **Member directory** — server-paginated table/cards, debounced search (name/title/email), filters (team, role, status, online now), member drawer + full detail page, bulk actions
- **Teams** — CRUD, archive, lead management with successor requirement, member picker
- **RBAC** — 5 immutable system roles + unlimited custom roles; `PermissionMatrix` UI (resource × action grid, keyboard-operable, dirty-state review bar with diff + affected-member count); role wizard; "My access" transparency panel
- **Invitations** — tokenized email flow (32-byte token, SHA-256 at rest, single-use, 7-day expiry), resend/revoke, lifecycle timeline, bulk CSV import with per-row validation
- **Audit log** — filterable, live tail, before/after diffs, IP + user agent, permission-gated CSV export (itself audited); all 26 audited actions covered by tests
- **Realtime presence** — per-org channel, 15s heartbeat, online dots + counts
- **Dashboard** — stat cards, getting-started checklist, pending invitations, live activity feed
- **Ownership transfer** — owner-only, type-to-confirm, atomic promote/demote RPC

## Setup

**Prerequisites:** Node 22+, pnpm 10+, a Supabase project (or the Supabase CLI).

```bash
pnpm install
cp .env.example .env.local   # fill in your Supabase URL + keys
# Apply migrations: supabase/migrations/00001_init.sql … 00014_transfer_ownership.sql
# (in order — later files reference objects created earlier)
# Then run supabase/seed.sql for the "Hale & Fern Studio" demo org
pnpm dev
```

Environment variables (see `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only — never in client bundles; CI fails the build if it appears there), `RESEND_API_KEY` (invitation emails; currently stubbed — accept URLs log in dev).

## Tests & CI

| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| `eslint` | 0 errors, 0 warnings |
| `vitest run` | 18 files, **250 tests, all passing** |
| `next build` | 26/26 pages |
| Bundle gate | app shell ~9 KB gzipped (≤180 KB budget) |

Test highlights: **50-test RLS static-analysis suite** (RLS enabled on all 10 tenant tables, audit_log has zero update/delete policies, self-role-edit guards, all 18 permission keys seeded, migration-ordering regression tests), invitation state machine (replay/tamper/cross-org/expiry), permission-diff computation, audit-sentence formatters for all 26 audited actions, ownership-transfer validation.

## Demo script (for portfolio viewers)

1. Sign in → create an org → you're the owner; the dashboard checklist appears.
2. Invitations → invite a teammate (use a second email) → accept the invite → they land in the directory.
3. Directory → member drawer → change their role → watch the before/after permission diff → confirm.
4. Audit log → see the full chain: `invitation.sent` → `invitation.accepted` → `membership.role_changed`, each with actor, diff, and IP.
5. Try the guardrails: attempt to raise your own role (control hidden; forged calls denied at RLS), try to demote the last owner (trigger raises, UI explains).

## Lessons learned

- **Migration ordering is load-bearing.** A forward-referenced FK or function silently breaks deploys; every migration file here is parsed and a custom checker asserts no object is referenced before creation (a bug class that burned us on a previous project).
- **RLS policies are permissive-OR'd** — column-level precision (`role_id` vs `is_active` needing different permissions) can't live in policies alone; it needs the trigger layer (`membership_update_guard`).
- **A `SECURITY DEFINER` check must actually be definer.** `role_org_matches_membership()` was caught during review: roles RLS hides cross-org roles, so a non-definer check would pass vacuously. Regression-tested.
- **Next 16 forbids non-function exports from `"use server"` modules** — pure constants live in sibling modules (the same trap, twice: invitations constants and transfer validation).
- **Never cache grants.** Effective permissions are always the live union from `user_permissions()` — role changes take effect on the member's next fetch, no stale sessions.

## AI-workflow note

Built with AI assistance (multi-agent: foundation, invitations, RBAC, directory/teams, audit/settings workers + a QA/hardening pass), with the six planning documents (PRD, technical requirements, app flow, design brief, database schema, implementation plan) as the source of truth. All AI output was reviewed against the specs: every privileged action traced to an audit producer, every RLS policy asserted by the static suite, and the full gate suite (typecheck, lint, 250 tests, build) run before commit. The design follows the project's own design brief (calm B2B admin, indigo accent, mobile-first at 390px).

## Honest gaps

- Migrations were validated statically (parser + forward-reference checker + 50-test RLS suite) but **not yet run against a live Postgres** — run `supabase db push` against a scratch project first.
- Invitation **emails are stubbed** (`sendInvitationEmail()` logs the accept URL in dev) until `RESEND_API_KEY` is wired.
- Realtime **presence latency unmeasured** (target: joins visible ≤2s P95).
- 8 heavy routes exceed the starter's default 500 KB bundle budget (invitations, audit, directory…) — needs a deliberate slimming pass or budget decision.
- Ownership-transfer and magic-link flows are tested at the unit/RPC level, not click-tested end-to-end.
