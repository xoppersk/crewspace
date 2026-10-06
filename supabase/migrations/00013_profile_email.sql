-- =============================================================================
-- 00013_profile_email.sql — profiles.email for directory search
--
-- Adds profiles.email (citext, nullable) and stamps it from auth.users:
--   * handle_new_user() (rewritten here; the trigger on auth.users already
--     exists from 00001) sets email on the signup stub from NEW.email
--   * on_auth_user_email_changed keeps it in sync when the user confirms an
--     email change (auth.updateUser fires UPDATE, not INSERT)
--   * a one-time backfill covers stubs created before this migration
--
-- RLS: email is a plain column on profiles, so it is visible under exactly
-- the same SELECT policies as the rest of the profile row — no new policy
-- is needed, and no new data becomes visible to anyone who couldn't already
-- read the profile.
-- =============================================================================

alter table public.profiles add column if not exists email citext;

comment on column public.profiles.email is
  'Mirror of auth.users.email for directory search. Set by handle_new_user() on signup and kept in sync by the on_auth_user_email_changed trigger. Nullable: old stubs are backfilled below.';

-- ---------------------------------------------------------------------------
-- handle_new_user(): stamp the email on the signup stub.
-- (Same body as 00002, plus the email column. Trigger already exists.)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, email)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'display_name',
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Member'
    ),
    new.raw_user_meta_data ->> 'avatar_url',
    nullif(new.email, '')
  )
  -- Idempotent: auth webhooks can retry, so never fail on a duplicate.
  -- On a retry the email is already correct (or the backfill fixed it).
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- sync_profile_email(): keep profiles.email in sync on email changes.
-- ---------------------------------------------------------------------------
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles
    set email = nullif(new.email, '')
    where id = new.id;
  end if;
  return new;
end;
$$;

comment on function public.sync_profile_email() is
  'Keeps profiles.email in sync when a user confirms an email change (auth.users UPDATE).';

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.sync_profile_email();

-- ---------------------------------------------------------------------------
-- Backfill stubs created before this migration (fresh deploys have none).
-- ---------------------------------------------------------------------------
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and p.email is null
  and u.email is not null;
