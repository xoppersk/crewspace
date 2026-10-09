-- =============================================================================
-- 00002_core_tenancy.sql — Crewspace foundation: orgs, roles, permission catalog
--
--   * extensions: citext (case-insensitive slugs/emails), pgcrypto (sha256)
--   * profiles: aligned with the spec (full_name NOT NULL, title, bio,
--     email_verified); handle_new_user() rewritten for the new column
--   * organizations / roles / permissions (18-key catalog) / role_permissions
--
-- Ordering notes (load-bearing):
--   * organizations and roles reference each other (roles.org_id,
--     organizations.default_role_id). Both tables are created first; the
--     circular FK is added with ALTER TABLE afterwards.
--   * RLS policies for these tables live in 00005 — they need the helper
--     functions from 00003, which must exist before any policy references them.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "citext";
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles: align the starter table with the Crewspace spec (§1)
-- ---------------------------------------------------------------------------
alter table public.profiles rename column display_name to full_name;

-- Backfill any NULL stubs before enforcing NOT NULL (fresh replays have no
-- rows yet; this keeps the migration safe on databases that already do).
update public.profiles set full_name = '' where full_name is null;
alter table public.profiles alter column full_name set not null;

alter table public.profiles add column if not exists title text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists email_verified boolean not null default false;

-- NOTE: the starter's active_team_id column is kept. It is a nullable pointer,
-- not a secret, and harms nothing. The spec simply doesn't use it.

-- handle_new_user(): stub profile on signup, spec-aligned column names.
-- The stub needs a non-null full_name, so fall back to the email local part.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'display_name',
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Member'
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  -- Idempotent: auth webhooks can retry, so never fail on a duplicate.
  on conflict (id) do nothing;
  return new;
end;
$$;
-- (trigger on_auth_user_created on auth.users already exists from 00001)

-- ---------------------------------------------------------------------------
-- organizations — a tenant. Slug is globally unique (used in URLs).
-- ---------------------------------------------------------------------------
create table public.organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          citext not null unique,
  logo_url      text,
  -- default_role_id FK is added below, after roles exists (circular dep).
  invite_policy text not null default 'admins'
    check (invite_policy in ('owners', 'admins', 'managers')),
  allowed_domains            text[] not null default '{}',
  require_email_verification boolean not null default true,
  is_demo                    boolean not null default false,
  created_by    uuid not null references auth.users (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.organizations is
  'A tenant. Slug is globally unique and used in URLs.';

create index organizations_slug_idx on public.organizations (slug);

-- ---------------------------------------------------------------------------
-- roles — system roles (is_system, seeded per org) + custom roles
-- ---------------------------------------------------------------------------
create table public.roles (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  name        text not null,
  description text,
  is_system   boolean not null default false,
  system_key  text,
  color       text not null default 'neutral',
  created_by  uuid not null references auth.users (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, name)
);

-- system_key is unique per org when set (NULL for custom roles).
create unique index roles_system_key_uidx
  on public.roles (org_id, system_key)
  where system_key is not null;

create index roles_org_idx on public.roles (org_id);

-- Circular FK, added now that both tables exist.
alter table public.organizations
  add column default_role_id uuid references public.roles (id) on delete set null;

-- ---------------------------------------------------------------------------
-- permissions — static catalog. Seeded once globally; the app never writes
-- here at runtime.
-- ---------------------------------------------------------------------------
create table public.permissions (
  key         text primary key,
  resource    text not null,
  action      text not null,
  label       text not null,
  description text
);

comment on table public.permissions is
  'Static catalog of permission keys. Seeded once globally; the app never writes here at runtime.';

-- All 18 keys from DATABASE-SCHEMA.md §1.
insert into public.permissions (key, resource, action, label, description) values
  ('org:read',               'org',         'read',               'View organization',  'View the organization and its data'),
  ('org:update',             'org',         'update',             'Edit organization',  'Edit org name, slug, and logo'),
  ('org:transfer_ownership', 'org',         'transfer_ownership', 'Transfer ownership', 'Transfer org ownership to another member'),
  ('members:read',           'members',     'read',               'View members',       'View the member directory and profiles'),
  ('members:invite',         'members',     'invite',             'Invite members',     'Can invite new people and choose an initial role.'),
  ('members:change_role',    'members',     'change_role',        'Change member roles','Can replace a member''s assigned organization role.'),
  ('members:deactivate',     'members',     'deactivate',         'Deactivate members', 'Can suspend access while preserving ownership history.'),
  ('teams:create',           'teams',        'create',             'Create teams',       'Create new teams'),
  ('teams:manage',           'teams',        'manage',             'Manage teams',       'Rename/archive teams, manage members and lead'),
  ('roles:create',           'roles',        'create',             'Create roles',       'Create custom roles'),
  ('roles:assign',           'roles',        'assign',             'Assign roles',       'Assign roles to members'),
  ('roles:update',           'roles',        'update',             'Edit role permissions', 'Inherits the organization policy for custom roles.'),
  ('roles:delete',           'roles',        'delete',             'Delete roles',       'Delete a custom role (only when unused)'),
  ('invitations:manage',     'invitations',  'manage',             'Manage invitations', 'Resend and revoke invitations'),
  ('audit:read',             'audit',        'read',               'Read audit log',     'Can review consequential access changes and exports.'),
  ('audit:export',           'audit',        'export',             'Export audit records','Cannot download the organization audit archive.'),
  ('settings:manage',        'settings',     'manage',             'Manage settings',    'Change org settings and member policy'),
  ('billing:view',           'billing',      'view',               'View billing',       'View plan/limits info (informational in v1)')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- role_permissions — join: which permission keys a role grants
-- ---------------------------------------------------------------------------
create table public.role_permissions (
  role_id        uuid not null references public.roles (id) on delete cascade,
  permission_key text not null references public.permissions (key),
  granted_at     timestamptz not null default now(),
  granted_by     uuid references auth.users (id),
  primary key (role_id, permission_key)
);

create index role_permissions_key_idx on public.role_permissions (permission_key);

-- ---------------------------------------------------------------------------
-- updated_at maintenance for the new tables
-- (set_updated_at() comes from 00001)
-- ---------------------------------------------------------------------------
create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

create trigger roles_set_updated_at
  before update on public.roles
  for each row execute function public.set_updated_at();
