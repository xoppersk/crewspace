-- =============================================================================
-- 00007_invite_accept.sql — transactional SECURITY DEFINER functions
--
--   * accept_invitation(p_token, p_user_id): verifies the SHA-256 hash,
--     pending status, and 7-day TTL inside one transaction; creates the
--     profile stub (if missing), the membership, team joins; flips the
--     invitation to accepted; writes audit events. Single-use is enforced by
--     the status check inside the transaction (T3: double-clicks and replays
--     cannot double-create).
--   * create_organization(p_name, p_slug, p_logo_url): creates the org, seeds
--     the 5 system roles with the TECHNICAL-REQUIREMENTS §6 permission
--     matrix, assigns the caller as owner, and sets the default role.
--     Exists so org creation needs no RLS bootstrap hole: the caller is not
--     yet a member, so no membership-based policy could authorize the
--     membership insert — the function runs as SECURITY DEFINER instead.
--
-- Both are revoked from PUBLIC and granted to authenticated only.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- accept_invitation(p_token text, p_user_id uuid) returns uuid (membership id)
-- ---------------------------------------------------------------------------
create or replace function public.accept_invitation(p_token text, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv           public.invitations%rowtype;
  v_hash          text;
  v_membership_id uuid;
begin
  if p_token is null or p_token = '' then
    raise exception 'crewspace: invitation token is required';
  end if;
  if p_user_id is null then
    raise exception 'crewspace: user id is required';
  end if;

  -- Only the SHA-256 hash is stored; the raw token never touches the DB.
  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  select * into v_inv
  from public.invitations
  where token_hash = v_hash
  for update;

  if not found then
    raise exception 'crewspace: invitation not found';
  end if;
  -- Single-use: the status check lives inside this transaction, so a replay
  -- or double-submit races against the row lock and loses.
  if v_inv.status <> 'pending' then
    raise exception 'crewspace: invitation is no longer pending (status: %)', v_inv.status;
  end if;
  if v_inv.expires_at <= now() then
    raise exception 'crewspace: invitation has expired';
  end if;

  -- Stub profile for users whose signup trigger somehow missed (normally the
  -- on_auth_user_created trigger already created it at signup).
  insert into public.profiles (id, full_name)
  values (p_user_id, '')
  on conflict (id) do nothing;

  insert into public.memberships (org_id, user_id, role_id)
  values (v_inv.org_id, p_user_id, v_inv.role_id)
  returning id into v_membership_id;

  -- Auto-join teams, but only teams that belong to the invitation's org
  -- (defense in depth against a tampered team_ids array).
  insert into public.team_memberships (team_id, membership_id, added_by)
  select t.team_id, v_membership_id, p_user_id
  from unnest(v_inv.team_ids) as t(team_id)
  join public.teams tm on tm.id = t.team_id and tm.org_id = v_inv.org_id
  on conflict do nothing;

  update public.invitations
  set status = 'accepted',
      accepted_at = now(),
      accepted_user_id = p_user_id
  where id = v_inv.id;

  insert into public.audit_log (org_id, actor_id, action, target_type, target_id, target_label)
  values (v_inv.org_id, p_user_id, 'invitation.accepted', 'invitation', v_inv.id, v_inv.email::text);

  insert into public.audit_log (org_id, actor_id, action, target_type, target_id)
  values (v_inv.org_id, p_user_id, 'membership.created', 'membership', v_membership_id);

  return v_membership_id;
end;
$$;

comment on function public.accept_invitation(text, uuid) is
  'T3: transactional invitation accept. Hash + pending + TTL verified in one transaction; single-use enforced by the row lock.';

revoke all on function public.accept_invitation(text, uuid) from public;
grant execute on function public.accept_invitation(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- create_organization(p_name, p_slug, p_logo_url) returns uuid (org id)
-- ---------------------------------------------------------------------------
create or replace function public.create_organization(
  p_name text,
  p_slug text,
  p_logo_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_org_id  uuid;
begin
  if v_user_id is null then
    raise exception 'crewspace: must be signed in to create an organization';
  end if;
  if p_name is null or btrim(p_name) = '' then
    raise exception 'crewspace: organization name is required';
  end if;
  if p_slug is null or btrim(p_slug) = '' then
    raise exception 'crewspace: organization slug is required';
  end if;

  insert into public.organizations (name, slug, logo_url, created_by)
  values (btrim(p_name), lower(btrim(p_slug)), nullif(btrim(p_logo_url), ''), v_user_id)
  returning id into v_org_id;

  -- The 5 system roles (immutable via app + RLS).
  insert into public.roles (org_id, name, description, is_system, system_key, color, created_by)
  values
    (v_org_id, 'Owner',   'Full control of the organization, including ownership transfer.', true, 'owner',   'primary', v_user_id),
    (v_org_id, 'Admin',   'Manage members, teams, roles, and settings. Cannot transfer ownership.', true, 'admin', 'blue', v_user_id),
    (v_org_id, 'Manager', 'Manage their teams and invite members at Member level.', true, 'manager', 'green', v_user_id),
    (v_org_id, 'Member',  'Standard team member.', true, 'member', 'neutral', v_user_id),
    (v_org_id, 'Viewer',  'Read-only access to the directory and org data.', true, 'viewer', 'neutral', v_user_id);

  -- Permission matrix per TECHNICAL-REQUIREMENTS §6.
  insert into public.role_permissions (role_id, permission_key, granted_by)
  select r.id, m.permission_key, v_user_id
  from public.roles r
  join (values
    ('owner','org:read'),('owner','org:update'),('owner','org:transfer_ownership'),
    ('owner','members:read'),('owner','members:invite'),('owner','members:change_role'),('owner','members:deactivate'),
    ('owner','teams:create'),('owner','teams:manage'),
    ('owner','roles:create'),('owner','roles:assign'),('owner','roles:update'),('owner','roles:delete'),
    ('owner','invitations:manage'),('owner','audit:read'),('owner','audit:export'),
    ('owner','settings:manage'),('owner','billing:view'),
    ('admin','org:read'),('admin','org:update'),
    ('admin','members:read'),('admin','members:invite'),('admin','members:change_role'),('admin','members:deactivate'),
    ('admin','teams:create'),('admin','teams:manage'),
    ('admin','roles:create'),('admin','roles:assign'),('admin','roles:update'),('admin','roles:delete'),
    ('admin','invitations:manage'),('admin','audit:read'),('admin','audit:export'),
    ('admin','settings:manage'),('admin','billing:view'),
    ('manager','org:read'),
    ('manager','members:read'),('manager','members:invite'),('manager','members:change_role'),
    ('manager','teams:create'),('manager','teams:manage'),
    ('manager','invitations:manage'),('manager','audit:read'),
    ('member','org:read'),('member','members:read'),
    ('viewer','org:read'),('viewer','members:read')
  ) as m(system_key, permission_key)
    on m.system_key = r.system_key
  where r.org_id = v_org_id
  on conflict do nothing;

  -- The founder becomes the owner.
  insert into public.memberships (org_id, user_id, role_id)
  select v_org_id, v_user_id, r.id
  from public.roles r
  where r.org_id = v_org_id and r.system_key = 'owner';

  -- New members default to the Member role.
  update public.organizations
  set default_role_id = (
    select r.id from public.roles r
    where r.org_id = v_org_id and r.system_key = 'member'
  )
  where id = v_org_id;

  insert into public.audit_log (org_id, actor_id, action, target_type, target_id, target_label)
  values (v_org_id, v_user_id, 'org.created', 'organization', v_org_id, btrim(p_name));

  return v_org_id;
end;
$$;

comment on function public.create_organization(text, text, text) is
  'Creates an org with its 5 system roles (TECHNICAL-REQUIREMENTS §6 matrix) and makes the caller the owner — one atomic transaction.';

revoke all on function public.create_organization(text, text, text) from public;
grant execute on function public.create_organization(text, text, text) to authenticated;
