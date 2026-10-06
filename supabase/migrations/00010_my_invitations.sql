-- =============================================================================
-- 00010_my_invitations.sql — invitee-side invitation flows
--
-- RLS on invitations only lets org members read invitation rows, so an
-- invitee (not yet a member) cannot list their own pending invitations.
-- These SECURITY DEFINER functions close that gap safely: every one of them
-- verifies that the invitation's email matches the caller's auth email
-- before doing anything.
--
--   * my_pending_invitations() — pending, unexpired invitations addressed to
--     the caller, with org/role/inviter context for the account page.
--   * accept_invitation_by_id(p_invitation_id) — accepts without the raw
--     token (the account page never sees it); mirrors accept_invitation's
--     transactional guarantees and audit writes.
--   * decline_invitation(p_invitation_id) — invitee-side decline; reuses the
--     'revoked' status (the schema has no 'declined' state) and writes an
--     invitation.revoked audit row with metadata.via = 'declined'.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- my_pending_invitations()
-- ---------------------------------------------------------------------------
create or replace function public.my_pending_invitations()
returns table (
  id uuid,
  org_id uuid,
  org_name text,
  org_slug citext,
  org_logo_url text,
  role_name text,
  invited_by_name text,
  expires_at timestamptz,
  message text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id,
    i.org_id,
    o.name,
    o.slug,
    o.logo_url,
    r.name,
    p.full_name,
    i.expires_at,
    i.message
  from public.invitations i
  join public.organizations o on o.id = i.org_id
  join public.roles r on r.id = i.role_id
  left join public.profiles p on p.id = i.invited_by
  where i.status = 'pending'
    and i.expires_at > now()
    and lower(i.email::text) = lower((select email from auth.users where id = auth.uid()))
  order by i.created_at desc;
$$;

comment on function public.my_pending_invitations() is
  'Invitee-side: pending invitations addressed to the caller (email match enforced in SQL).';

revoke all on function public.my_pending_invitations() from public;
grant execute on function public.my_pending_invitations() to authenticated;

-- ---------------------------------------------------------------------------
-- accept_invitation_by_id(p_invitation_id uuid) returns uuid (membership id)
-- ---------------------------------------------------------------------------
create or replace function public.accept_invitation_by_id(p_invitation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv           public.invitations%rowtype;
  v_email         text;
  v_membership_id uuid;
begin
  if p_invitation_id is null then
    raise exception 'crewspace: invitation id is required';
  end if;

  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then
    raise exception 'crewspace: must be signed in to accept an invitation';
  end if;

  select * into v_inv
  from public.invitations
  where id = p_invitation_id
  for update;

  if not found then
    raise exception 'crewspace: invitation not found';
  end if;
  -- The invitation must be addressed to the caller — the account page never
  -- sees raw tokens, so the email match is the authorization check.
  if lower(v_inv.email::text) <> lower(v_email) then
    raise exception 'crewspace: invitation is not addressed to you';
  end if;
  -- Single-use: status + TTL verified inside the transaction (same as
  -- accept_invitation, T3).
  if v_inv.status <> 'pending' then
    raise exception 'crewspace: invitation is no longer pending (status: %)', v_inv.status;
  end if;
  if v_inv.expires_at <= now() then
    raise exception 'crewspace: invitation has expired';
  end if;

  insert into public.profiles (id, full_name)
  values (auth.uid(), '')
  on conflict (id) do nothing;

  insert into public.memberships (org_id, user_id, role_id)
  values (v_inv.org_id, auth.uid(), v_inv.role_id)
  returning id into v_membership_id;

  insert into public.team_memberships (team_id, membership_id, added_by)
  select t.team_id, v_membership_id, auth.uid()
  from unnest(v_inv.team_ids) as t(team_id)
  join public.teams tm on tm.id = t.team_id and tm.org_id = v_inv.org_id
  on conflict do nothing;

  update public.invitations
  set status = 'accepted',
      accepted_at = now(),
      accepted_user_id = auth.uid()
  where id = v_inv.id;

  insert into public.audit_log (org_id, actor_id, action, target_type, target_id, target_label)
  values (v_inv.org_id, auth.uid(), 'invitation.accepted', 'invitation', v_inv.id, v_inv.email::text);

  insert into public.audit_log (org_id, actor_id, action, target_type, target_id)
  values (v_inv.org_id, auth.uid(), 'membership.created', 'membership', v_membership_id);

  return v_membership_id;
end;
$$;

comment on function public.accept_invitation_by_id(uuid) is
  'T3: tokenless invitation accept for the account page. Email match + pending + TTL verified in one transaction.';

revoke all on function public.accept_invitation_by_id(uuid) from public;
grant execute on function public.accept_invitation_by_id(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- decline_invitation(p_invitation_id uuid)
-- ---------------------------------------------------------------------------
create or replace function public.decline_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv   public.invitations%rowtype;
  v_email text;
begin
  if p_invitation_id is null then
    raise exception 'crewspace: invitation id is required';
  end if;

  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then
    raise exception 'crewspace: must be signed in to decline an invitation';
  end if;

  select * into v_inv
  from public.invitations
  where id = p_invitation_id
  for update;

  if not found then
    raise exception 'crewspace: invitation not found';
  end if;
  if lower(v_inv.email::text) <> lower(v_email) then
    raise exception 'crewspace: invitation is not addressed to you';
  end if;
  if v_inv.status <> 'pending' then
    raise exception 'crewspace: invitation is no longer pending (status: %)', v_inv.status;
  end if;

  update public.invitations
  set status = 'revoked'
  where id = v_inv.id;

  insert into public.audit_log (org_id, actor_id, action, target_type, target_id, target_label, metadata)
  values (v_inv.org_id, auth.uid(), 'invitation.revoked', 'invitation', v_inv.id, v_inv.email::text, '{"via": "declined"}'::jsonb);
end;
$$;

comment on function public.decline_invitation(uuid) is
  'Invitee-side decline: reuses the revoked status and logs invitation.revoked with via=declined.';

revoke all on function public.decline_invitation(uuid) from public;
grant execute on function public.decline_invitation(uuid) to authenticated;
