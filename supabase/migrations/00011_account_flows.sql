-- =============================================================================
-- 00011_account_flows.sql — invitee-side leave + full account deletion
--
--   * leave_organization(p_org_id): the caller's own leave. RLS on
--     memberships DELETE requires members:deactivate, which a plain member
--     doesn't hold — so leaving is a SECURITY DEFINER function that verifies
--     the active membership, refuses the last owner (naming the org, so the
--     UI can explain), writes the membership.removed audit row BEFORE the
--     delete (the audit INSERT policy needs the actor to still be a member),
--     then deletes. The prevent_last_owner_loss trigger agrees at the DB.
--   * delete_own_account(p_email_confirm): full account deletion in one
--     transaction. Verifies the typed email, blocks sole owners (naming the
--     org), and blocks accounts with immutable audit history — audit_log
--     rows can never be deleted or anonymized (trigger + NOT NULL actor),
--     so those accounts need manual support handling. Memberships and the
--     profile are deleted here; auth.users is deleted by the server action
--     via auth.admin (service role) only after this succeeds.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- leave_organization(p_org_id uuid)
-- ---------------------------------------------------------------------------
create or replace function public.leave_organization(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership  public.memberships%rowtype;
  v_is_owner    boolean;
  v_owner_count integer;
  v_name        text;
  v_org_name    text;
begin
  if p_org_id is null then
    raise exception 'crewspace: organization id is required';
  end if;

  select * into v_membership
  from public.memberships
  where org_id = p_org_id and user_id = auth.uid() and is_active
  for update;

  if not found then
    raise exception 'crewspace: you are not an active member of this organization';
  end if;

  select o.name into v_org_name from public.organizations o where o.id = p_org_id;

  select (r.system_key = 'owner') into v_is_owner
  from public.roles r where r.id = v_membership.role_id;

  if coalesce(v_is_owner, false) then
    select count(*) into v_owner_count
    from public.memberships m
    join public.roles r on r.id = m.role_id
    where m.org_id = p_org_id and m.is_active and r.system_key = 'owner';
    if v_owner_count <= 1 then
      raise exception 'crewspace: sole owner of "%" — transfer ownership before leaving', v_org_name;
    end if;
  end if;

  select full_name into v_name from public.profiles where id = auth.uid();

  -- Audit BEFORE the delete: the audit_log INSERT policy requires the actor
  -- to still be an active member.
  insert into public.audit_log (org_id, actor_id, action, target_type, target_id, target_label, metadata)
  values (p_org_id, auth.uid(), 'membership.removed', 'membership', v_membership.id,
          coalesce(nullif(v_name, ''), 'A member'), '{"via": "self-leave"}'::jsonb);

  delete from public.memberships where id = v_membership.id;
end;
$$;

comment on function public.leave_organization(uuid) is
  'Self-leave: last-owner refusal names the org; audit row is written before the membership delete.';

revoke all on function public.leave_organization(uuid) from public;
grant execute on function public.leave_organization(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- delete_own_account(p_email_confirm text)
-- ---------------------------------------------------------------------------
create or replace function public.delete_own_account(p_email_confirm text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email       text;
  v_org         record;
  v_owner_count integer;
  v_audit_count integer;
begin
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then
    raise exception 'crewspace: must be signed in to delete an account';
  end if;
  if p_email_confirm is null or lower(btrim(p_email_confirm)) <> lower(v_email) then
    raise exception 'crewspace: email confirmation does not match';
  end if;

  -- Sole-owner block, naming the org so the UI can give transfer guidance.
  for v_org in
    select o.id, o.name
    from public.organizations o
    join public.memberships m on m.org_id = o.id
    join public.roles r on r.id = m.role_id
    where m.user_id = auth.uid() and m.is_active and r.system_key = 'owner'
  loop
    select count(*) into v_owner_count
    from public.memberships m
    join public.roles r on r.id = m.role_id
    where m.org_id = v_org.id and m.is_active and r.system_key = 'owner';
    if v_owner_count <= 1 then
      raise exception 'crewspace: sole owner of "%" — transfer ownership before deleting your account', v_org.name;
    end if;
  end loop;

  -- Audit history is immutable (no UPDATE/DELETE policy + trigger + NOT NULL
  -- actor): it cannot follow the user out, so these deletions stay manual.
  select count(*) into v_audit_count
  from public.audit_log
  where actor_id = auth.uid();
  if v_audit_count > 0 then
    raise exception 'crewspace: account has immutable audit history — contact support to finish deleting it';
  end if;

  delete from public.memberships where user_id = auth.uid();
  delete from public.profiles where id = auth.uid();
end;
$$;

comment on function public.delete_own_account(text) is
  'Full account deletion prep: email confirm, sole-owner block, audit-history block; removes memberships + profile. auth.users deletion happens server-side via auth.admin.';

revoke all on function public.delete_own_account(text) from public;
grant execute on function public.delete_own_account(text) to authenticated;
