-- =============================================================================
-- 00020_transfer_demotion_canon_role.sql — production-push delta (2026-10-22)
--
-- PROBLEM: 00014's transfer_org_ownership() demotes the outgoing owner to the
-- org's `admin` SYSTEM role. The canon role template seeded by
-- create_workspace() (00017) — and by the production seed — has NO such role:
-- its system roles are owner / member / guest, and the canon second-in-command
-- is the named role "Product admin". Under the canon template the 00014
-- function therefore always raises 'crewspace: admin system role is missing'
-- and ownership transfer can never succeed.
--
-- FIX: replace ONLY the demotion-role lookup. The outgoing owner is demoted
-- to the org's "Product admin" role (canon: invites people, changes roles,
-- organizes teams — the broadest non-owner grant set), looked up by its
-- template-guaranteed name (roles has unique (org_id, name) and the template
-- insert is on-conflict-do-nothing). Everything else — actor derivation from
-- auth.uid(), active-owner check, same-org active target check, row locks,
-- promote-then-demote ordering, return shape, grants — is byte-identical in
-- behaviour to 00014.
--
-- Idempotent: CREATE OR REPLACE; safe on any DB that has 00014.
-- =============================================================================

create or replace function public.transfer_org_ownership(p_org_id uuid, p_target_membership_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_actor         public.memberships%rowtype;
  v_target        public.memberships%rowtype;
  v_owner_role_id uuid;
  v_demote_role_id uuid;
  v_actor_name    text;
  v_target_name   text;
begin
  if p_org_id is null then
    raise exception 'crewspace: organization id is required';
  end if;
  if p_target_membership_id is null then
    raise exception 'crewspace: target membership id is required';
  end if;
  if v_actor_user_id is null then
    raise exception 'crewspace: sign-in required';
  end if;

  -- Actor: active membership of this org, locked for the transaction.
  select * into v_actor
  from public.memberships
  where org_id = p_org_id
    and user_id = v_actor_user_id
    and is_active
  for update;

  if not found then
    raise exception 'crewspace: only an active organization owner can transfer ownership';
  end if;

  select id into v_owner_role_id
  from public.roles
  where org_id = p_org_id
    and is_system
    and system_key = 'owner'
  limit 1;
  if v_owner_role_id is null then
    raise exception 'crewspace: owner system role is missing for this organization';
  end if;
  if v_actor.role_id <> v_owner_role_id then
    raise exception 'crewspace: only an organization owner can transfer ownership';
  end if;

  -- Demotion target: the canon template's "Product admin" role (00017/seed).
  select id into v_demote_role_id
  from public.roles
  where org_id = p_org_id
    and name = 'Product admin'
  limit 1;
  if v_demote_role_id is null then
    raise exception 'crewspace: Product admin role is missing for this organization';
  end if;

  -- Target: active membership of the same org, not the actor, locked.
  select * into v_target
  from public.memberships
  where id = p_target_membership_id
    and org_id = p_org_id
    and is_active
  for update;

  if not found then
    raise exception 'crewspace: target member was not found or is not an active member of this organization';
  end if;
  if v_target.user_id = v_actor_user_id then
    raise exception 'crewspace: you cannot transfer ownership to yourself';
  end if;

  -- Names for the audit row (stable even if the rows change later).
  select full_name into v_actor_name from public.profiles where id = v_actor.user_id;
  select full_name into v_target_name from public.profiles where id = v_target.user_id;

  -- Promote first, demote second: the org always has an active owner.
  update public.memberships set role_id = v_owner_role_id where id = v_target.id;
  update public.memberships set role_id = v_demote_role_id where id = v_actor.id;

  return jsonb_build_object(
    'actor_name', coalesce(v_actor_name, 'Unknown member'),
    'target_name', coalesce(v_target_name, 'Unknown member')
  );
end;
$$;

comment on function public.transfer_org_ownership(uuid, uuid) is
  'Atomic ownership transfer: promotes the target to the org owner system role and demotes the actor to the canon Product admin role in one transaction (00020: demotion target aligned to the canon template; 00014 expected a v1 admin system role the template never creates). Actor must be an active owner (derived from auth.uid()); the prevent_last_owner_loss trigger stays as the backstop.';

revoke all on function public.transfer_org_ownership(uuid, uuid) from public;
grant execute on function public.transfer_org_ownership(uuid, uuid) to authenticated;
