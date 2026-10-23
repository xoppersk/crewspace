-- =============================================================================
-- inventory.sql — READ-ONLY inventory of the LIVE Crewspace project
-- (Supabase ref okxchlsrqimegoqsluyf)
--
-- Run later, when DB access lands, e.g.:
--   psql "$DATABASE_URL" -f supabase/inventory.sql
-- or paste into the Supabase SQL editor section by section.
--
-- Every statement is a SELECT (or psql-safe catalog read). Nothing here
-- writes, creates, alters, or drops anything. Safe to run on production.
--
-- Note: section 1b reads supabase_migrations.schema_migrations, which only
-- exists if migrations were applied via the Supabase CLI / migration API.
-- If that one statement errors with "relation does not exist", the project
-- was provisioned another way — the error itself is the finding; continue
-- with the remaining sections.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Server identity
-- ---------------------------------------------------------------------------
select version() as postgres_version, current_database() as database_name,
       current_user as connected_as, now() as inventory_taken_at;

select name, setting from pg_settings
where name in ('server_version', 'max_connections', 'shared_buffers');

-- ---------------------------------------------------------------------------
-- 1a. Extensions installed
-- ---------------------------------------------------------------------------
select extname, extversion from pg_extension order by extname;

-- ---------------------------------------------------------------------------
-- 1b. Applied migrations (Supabase CLI bookkeeping — may not exist, see header)
-- ---------------------------------------------------------------------------
select table_schema, table_name
from information_schema.tables
where table_name = 'schema_migrations';

select version, name, inserted_at
from supabase_migrations.schema_migrations
order by version;

-- ---------------------------------------------------------------------------
-- 2. Public tables + estimated and exact row counts
-- ---------------------------------------------------------------------------
select c.relname as table_name,
       c.reltuples::bigint as estimated_rows,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;

-- Exact counts for the known Crewspace tables (errors on a missing table
-- mean that migration never landed — that is the finding).
select 'organizations' as table_name, count(*) as exact_rows from public.organizations
union all select 'profiles', count(*) from public.profiles
union all select 'memberships', count(*) from public.memberships
union all select 'roles', count(*) from public.roles
union all select 'permissions', count(*) from public.permissions
union all select 'role_permissions', count(*) from public.role_permissions
union all select 'role_permission_denies', count(*) from public.role_permission_denies
union all select 'teams', count(*) from public.teams
union all select 'team_memberships', count(*) from public.team_memberships
union all select 'invitations', count(*) from public.invitations
union all select 'audit_log', count(*) from public.audit_log;

-- Columns of the key tables (catches drift like a missing seat_price_cents)
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

-- Constraints (checks / uniques) per public table
select conrelid::regclass as table_name, conname as constraint_name,
       pg_get_constraintdef(oid) as definition
from pg_constraint
where connamespace = 'public'::regnamespace
order by conrelid::regclass::text, conname;

-- Indexes on public tables
select schemaname, tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;

-- Triggers on public tables
select event_object_table as table_name, trigger_name,
       action_timing, event_manipulation
from information_schema.triggers
where event_object_schema = 'public'
order by event_object_table, trigger_name;

-- ---------------------------------------------------------------------------
-- 3. RLS policies per table
-- ---------------------------------------------------------------------------
select schemaname, tablename, policyname, roles, cmd,
       qual as using_expr, with_check as with_check_expr
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- Storage policies (org-logos / avatars live on storage.objects)
select policyname, roles, cmd, qual as using_expr, with_check as with_check_expr
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;

-- ---------------------------------------------------------------------------
-- 4. Functions in public (name, args, security definer?, language)
-- ---------------------------------------------------------------------------
select p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments,
       p.pronargs as arg_count,
       p.prosecdef as security_definer,
       l.lanname as language,
       pg_get_functiondef(p.oid) is not null as has_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language l on l.oid = p.prolang
where n.nspname = 'public'
order by p.proname, arguments;

-- ---------------------------------------------------------------------------
-- 5. Auth inventory (counts only — no credentials, no tokens)
-- ---------------------------------------------------------------------------
select count(*) as auth_users_total,
       count(*) filter (where email_confirmed_at is not null) as email_confirmed,
       count(*) filter (where last_sign_in_at is not null) as ever_signed_in,
       min(created_at) as oldest_user, max(created_at) as newest_user
from auth.users;

select count(*) as auth_instances from auth.instances;

-- ---------------------------------------------------------------------------
-- 6. Storage buckets
-- ---------------------------------------------------------------------------
select id, name, public, file_size_limit, allowed_mime_types, created_at
from storage.buckets
order by id;

select bucket_id, count(*) as objects from storage.objects group by bucket_id;

-- ---------------------------------------------------------------------------
-- 7. Tenancy sanity (only meaningful once data exists)
-- ---------------------------------------------------------------------------
select o.id as org_id, o.name, o.slug, o.is_demo, o.created_at,
       (select count(*) from public.memberships m where m.org_id = o.id) as memberships,
       (select count(*) from public.roles r where r.org_id = o.id) as roles,
       (select count(*) from public.teams t where t.org_id = o.id) as teams
from public.organizations o
order by o.created_at;

select key, resource, action, label from public.permissions order by key;
