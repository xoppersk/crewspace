-- =============================================================================
-- 00014_transfer_ownership.sql — atomic org ownership transfer
--
--   * transfer_org_ownership(p_org_id, p_target_membership_id) — SECURITY
--     DEFINER, transactional: in one transaction, sets the target's role to
--     the org's `owner` system role and demotes the actor to the `admin`
--     system role. Promote-then-demote ordering means the org never drops
--     to zero active owners, so the memberships_prevent_last_owner_loss
--     trigger (00006) stays as a pure backstop and never fires spuriously.
--
-- Defense in depth (the server action also checks org:transfer_ownership via
-- requireOrgAccess before calling):
--   * the actor is derived from auth.uid() — never from a caller-supplied id
--   * the actor must be an ACTIVE owner of the org (only owners hold the
--     org:transfer_ownership permission, so this is the permission check)
--   * the target must be an ACTIVE membership of the SAME org, not the actor
--   * both membership rows are locked FOR UPDATE — a double-submit races
--     against the row lock and loses
--
-- Returns jsonb { actor_name, target_name } for the audit row the server
-- action writes (org.ownership_transferred).
--
-- Revoked from PUBLIC, granted to authenticated (same convention as 00007).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- transfer_org_ownership(p_org_id uuid, p_target_membership_id uuid)
--   returns jsonb { actor_name, target_name }
-- ---------------------------------------------------------------------------
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
  v_admin_role_id uuid;
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

  select id into v_admin_role_id
  from public.roles
  where org_id = p_org_id
    and is_system
    and system_key = 'admin'
  limit 1;
  if v_admin_role_id is null then
    raise exception 'crewspace: admin system role is missing for this organization';
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
  update public.memberships set role_id = v_admin_role_id where id = v_actor.id;

  return jsonb_build_object(
    'actor_name', coalesce(v_actor_name, 'Unknown member'),
    'target_name', coalesce(v_target_name, 'Unknown member')
  );
end;
$$;

comment on function public.transfer_org_ownership(uuid, uuid) is
  'Atomic ownership transfer: promotes the target to the org owner system role and demotes the actor to admin in one transaction. Actor must be an active owner (derived from auth.uid()); the prevent_last_owner_loss trigger stays as the backstop.';

revoke all on function public.transfer_org_ownership(uuid, uuid) from public;
grant execute on function public.transfer_org_ownership(uuid, uuid) to authenticated;
