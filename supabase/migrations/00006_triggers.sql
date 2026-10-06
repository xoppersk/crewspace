-- =============================================================================
-- 00006_triggers.sql — integrity + privilege-escalation guards (T1, T2, T4)
--
--   * prevent_last_owner_loss()  — BEFORE UPDATE/DELETE on memberships (T2)
--   * role_org_matches_membership() — membership.role_id must belong to the
--     membership's org (T6)
--   * membership_update_guard()  — column-level UPDATE enforcement: role_id
--     changes need members:change_role, is_active changes need
--     members:deactivate, and nobody changes their own row's privileged
--     columns (T1). RLS policies are permissive-OR'd, so this trigger is the
--     layer that distinguishes which permission each changed column needs.
--   * audit_log_no_modify()      — BEFORE UPDATE/DELETE on audit_log, always
--     raises: history cannot be altered even by service-role connections (T4)
--
-- All SECURITY DEFINER trigger functions fix search_path = public.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- prevent_last_owner_loss() — T2: the final owner can never be demoted or
-- removed. Fires at the database, so no app path (including service-role
-- writes) can bypass it.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_last_owner_loss()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_role_id uuid;
  v_remaining     integer;
  v_org_id        uuid;
begin
  v_org_id := coalesce(old.org_id, new.org_id);

  select id into v_owner_role_id
  from public.roles
  where org_id = v_org_id
    and is_system
    and system_key = 'owner'
  limit 1;

  -- No owner system role in this org (shouldn't happen) — nothing to protect.
  if v_owner_role_id is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    -- Only an active owner row can trigger the guard.
    if old.role_id <> v_owner_role_id or not old.is_active then
      return old;
    end if;
  else
    -- UPDATE: only rows that WERE active owners matter; if the new row is
    -- still an active owner, nothing is lost.
    if old.role_id <> v_owner_role_id or not old.is_active then
      return new;
    end if;
    if new.role_id = v_owner_role_id and new.is_active then
      return new;
    end if;
  end if;

  -- Count the OTHER active owner memberships that would remain.
  select count(*) into v_remaining
  from public.memberships
  where org_id = old.org_id
    and role_id = v_owner_role_id
    and is_active
    and id <> old.id;

  if v_remaining = 0 then
    raise exception
      'crewspace: cannot remove the last active owner of the organization';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

comment on function public.prevent_last_owner_loss() is
  'T2 guard: raises when an UPDATE/DELETE would leave the org with zero active owners.';

drop trigger if exists memberships_prevent_last_owner_loss on public.memberships;
create trigger memberships_prevent_last_owner_loss
  before update or delete on public.memberships
  for each row execute function public.prevent_last_owner_loss();

-- ---------------------------------------------------------------------------
-- role_org_matches_membership() — T6: a membership's role must belong to the
-- same org. Blocks cross-org role assignment at the database.
--
-- SECURITY DEFINER is load-bearing here: the roles SELECT RLS hides other
-- orgs' roles from the caller, so a non-definer check would see "no such
-- role" and pass. As definer it sees every role and the org comparison is
-- exact. (FK enforcement itself bypasses RLS, so the trigger is the layer
-- that actually closes this hole.)
-- ---------------------------------------------------------------------------
create or replace function public.role_org_matches_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.roles r
    where r.id = new.role_id
      and r.org_id <> new.org_id
  ) then
    raise exception
      'crewspace: role % does not belong to organization %',
      new.role_id, new.org_id;
  end if;
  return new;
end;
$$;

comment on function public.role_org_matches_membership() is
  'T6 guard: membership.role_id must reference a role in the membership''s own org.';

drop trigger if exists memberships_role_org_check on public.memberships;
create trigger memberships_role_org_check
  before insert or update of role_id, org_id on public.memberships
  for each row execute function public.role_org_matches_membership();

-- ---------------------------------------------------------------------------
-- membership_update_guard() — T1: column-level UPDATE enforcement.
-- ---------------------------------------------------------------------------
create or replace function public.membership_update_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service-role / edge-function paths (auth.uid() IS NULL) bypass this
  -- guard: they are trusted server code. prevent_last_owner_loss() above
  -- still fires for every path, including these.
  if (select auth.uid()) is null then
    return new;
  end if;

  if new.role_id is distinct from old.role_id then
    if old.user_id = (select auth.uid()) then
      raise exception 'crewspace: cannot change your own role';
    end if;
    if not public.has_permission(old.org_id, 'members:change_role') then
      raise exception 'crewspace: missing members:change_role permission';
    end if;
  end if;

  if new.is_active is distinct from old.is_active then
    if old.user_id = (select auth.uid()) then
      raise exception 'crewspace: cannot change your own active status';
    end if;
    if not public.has_permission(old.org_id, 'members:deactivate') then
      raise exception 'crewspace: missing members:deactivate permission';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.membership_update_guard() is
  'T1 guard: role_id changes need members:change_role, is_active changes need members:deactivate, and nobody edits their own privileged columns.';

drop trigger if exists memberships_update_guard on public.memberships;
create trigger memberships_update_guard
  before update on public.memberships
  for each row execute function public.membership_update_guard();

-- ---------------------------------------------------------------------------
-- audit_log_no_modify() — T4: the audit log is append-only, enforced at the
-- database. Raises on ANY update or delete, for ANY role, including the
-- service role. (There are also no UPDATE/DELETE RLS policies on audit_log.)
-- ---------------------------------------------------------------------------
create or replace function public.audit_log_no_modify()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'crewspace: audit_log is append-only and cannot be modified';
  return null;
end;
$$;

comment on function public.audit_log_no_modify() is
  'T4 guard: audit_log rows can never be updated or deleted, by any role.';

drop trigger if exists audit_log_no_modify on public.audit_log;
create trigger audit_log_no_modify
  before update or delete on public.audit_log
  for each row execute function public.audit_log_no_modify();
