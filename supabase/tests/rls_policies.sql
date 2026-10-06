-- =============================================================================
-- rls_policies.sql — pgTAP test suite for Row Level Security
-- =============================================================================
-- What this is: a pgTAP test file ("pgTAP-style skeleton" per the starter spec)
-- that proves the RLS policies in supabase/migrations/*.sql actually hold.
--
-- How to run it (local Supabase, pgTAP installed):
--
--   1. Install the pgTAP extension once per local project:
--        supabase db reset            # or: psql -c "create extension pgtap;"
--   2. Run the suite:
--        supabase db test             # runs everything in supabase/tests/
--      or directly:
--        psql "$DATABASE_URL" -f supabase/tests/rls_policies.sql
--
-- CI note: add a job that boots `supabase start`, pushes migrations, installs
-- pgTAP, and runs this file. A green RLS suite is a merge gate for web apps.
--
-- Conventions used below:
--   * Every test runs inside one transaction and ROLLBACKs — tests never
--     pollute the database.
--   * `SET ROLE authenticated` + faking the JWT claims simulates a signed-in
--     user without touching the network:
--         select set_config('request.jwt.claims',
--                          json_build_object('sub', '<user-uuid>')::text, true);
--     Supabase's auth.uid() reads the `sub` claim, so policies behave exactly
--     as they do in production.
--   * RESET ROLE / reset the claims between personas.
-- =============================================================================

begin;

-- Update this number when you add tests: plan(N) must equal the test count.
select plan(9);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create schema if not exists tests;

-- Simulate a signed-in user for RLS: auth.uid() will return p_user_id.
create or replace function tests.sign_in_as(p_user_id uuid)
returns void language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text,
    true
  );
end;
$$;

create or replace function tests.sign_out()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{}', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures: two users + their auto-created profiles
-- ---------------------------------------------------------------------------
-- NOTE: inserting into auth.users directly requires a superuser role. On a
-- local `supabase db test` run you are postgres, so this works. On hosted
-- projects, run these tests against a local/staging clone — never prod.
insert into auth.users (id, email, encrypted_password, email_confirmed_at,
                       raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com', 'x', now(), '{}', '{}', now(), now()),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com',   'x', now(), '{}', '{}', now(), now());

-- ---------------------------------------------------------------------------
-- 1-2. handle_new_user() trigger created the profiles
-- ---------------------------------------------------------------------------
select ok(
  exists (select 1 from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'trigger creates a profile row for alice on auth.users insert'
);

select ok(
  exists (select 1 from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  'trigger creates a profile row for bob on auth.users insert'
);

-- ---------------------------------------------------------------------------
-- 3. RLS is enabled on profiles
-- ---------------------------------------------------------------------------
select ok(
  (select relrowsecurity from pg_class where relname = 'profiles' and relnamespace = 'public'::regnamespace),
  'row level security is enabled on public.profiles'
);

-- ---------------------------------------------------------------------------
-- 4. anon (signed out) sees nothing
-- ---------------------------------------------------------------------------
select tests.sign_out();
set role anon;

select is(
  (select count(*) from public.profiles)::int,
  0,
  'anon role selects zero profile rows'
);

reset role;

-- ---------------------------------------------------------------------------
-- 5-6. owner can read + update their own profile
-- ---------------------------------------------------------------------------
select tests.sign_in_as('11111111-1111-1111-1111-111111111111');
set role authenticated;

select is(
  (select count(*) from public.profiles)::int,
  1,
  'alice selects exactly her own profile row'
);

select lives_ok(
  $$ update public.profiles
     set full_name = 'Alice'
     where id = '11111111-1111-1111-1111-111111111111' $$,
  'alice can update her own profile'
);

-- ---------------------------------------------------------------------------
-- 7-8. owner cannot read or touch anyone else's profile
-- ---------------------------------------------------------------------------
select is(
  (select count(*) from public.profiles where id = '22222222-2222-2222-2222-222222222222')::int,
  0,
  'alice cannot select bob''s profile row'
);

select is(
  (select count(*) from public.profiles
   where id = '22222222-2222-2222-2222-222222222222'
     and full_name = 'Pwned')::int,
  0,
  'setup check: bob''s row is untouched before the attack'
);

-- An UPDATE that matches zero rows (blocked by RLS) must not error and must
-- change nothing — assert the row count of affected rows is 0.
with attack as (
  update public.profiles
  set full_name = 'Pwned'
  where id = '22222222-2222-2222-2222-222222222222'
  returning 1
)
select is(
  (select count(*) from attack)::int,
  0,
  'alice''s update of bob''s profile affects zero rows'
);

reset role;
select tests.sign_out();

-- ---------------------------------------------------------------------------
select * from finish();
rollback;
