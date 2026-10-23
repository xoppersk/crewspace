-- =============================================================================
-- 00017_create_workspace.sql — v2 workspace bootstrap (Worker S)
--
-- RPC CHOSEN: public.create_workspace(p_name text, p_slug text) returns uuid
--   Worker A (app) must call THIS function for v2 public sign-up.
--   The v1 function create_organization(text, text, text) from 00007 is left
--   untouched for backward compatibility; it still seeds the OLD 5-role
--   matrix and must NOT be used by the v2 app.
--
-- What create_workspace does, atomically, for auth.uid() only:
--   1. inserts the organizations row (created_by = caller)
--   2. seeds the 9 canon roles from data/org.json AS A TEMPLATE
--      (Organization owner / Member / Guest = System; Product admin /
--      Support lead / Analyst / Finance viewer / Auditor / Billing admin
--      = Custom, is_system = false, system_key = NULL)
--   3. seeds COMMITTED register states (see mapping below) into
--      role_permissions (grants) + role_permission_denies (denies, 00015)
--   4. creates the caller's membership with the Organization owner role
--   5. sets default_role_id to Member and initializes org settings
--      (seat_price_cents default from 00018 when present, session defaults)
--   6. writes the org.created audit row and returns the org id
--
-- PERMISSION MAPPING (v2 fixture id -> v1 catalog key) — keep in sync with
-- scripts/generate-seed.mjs (PERM_MAP_DB). Committed-state translation:
--   allow   -> grant row
--   deny    -> deny row
--   inherit -> neither, EXCEPT fixture permission 3 (members:read): the org
--              baseline allows it (org.json baseline.allowedPermissionIds=[3]),
--              so inherit on #3 -> GRANT.
--   locked  -> (#18 org:transfer_ownership, non-owner) explicit deny row.
--   Owner (allow on all 18) -> grants for ALL 18 v1 catalog keys, no denies.
--   org:read is additionally granted to every template role (platform
--   baseline: any member can read their org shell).
--   Fixture permissions 12 / 14 / 16 are app-layer only (no v1 key) and
--   produce no rows. roles:assign / roles:delete go to the owner only.
--
-- IDEMPOTENT / DEFENSIVE: create-or-replace function; safe on a fresh DB
-- (00001-00016 + 00018 applied) and on a live DB where 00001-00016 already
-- ran. Depends on: organizations, roles, role_permissions,
-- role_permission_denies (00015), memberships, audit_log, permissions.
-- seat_price_cents (00018) is written only if the column exists, so this
-- file also runs if applied before 00018.
-- =============================================================================

create or replace function public.create_workspace(
  p_name text,
  p_slug text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_org_id  uuid;
  v_slug    text;
  v_member_role_id uuid;
begin
  if v_user_id is null then
    raise exception 'crewspace: must be signed in to create a workspace';
  end if;
  if p_name is null or btrim(p_name) = '' then
    raise exception 'crewspace: workspace name is required';
  end if;

  -- Slug: caller-supplied, or derived from the name (+ short random suffix
  -- on collision, slug is globally unique).
  v_slug := nullif(lower(btrim(coalesce(p_slug, ''))), '');
  if v_slug is null then
    v_slug := regexp_replace(lower(btrim(p_name)), '[^a-z0-9]+', '-', 'g');
    v_slug := trim(both '-' from v_slug);
    if v_slug = '' then v_slug := 'workspace'; end if;
  end if;
  if exists (select 1 from public.organizations where slug = v_slug::citext) then
    v_slug := v_slug || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
  end if;

  insert into public.organizations (name, slug, created_by)
  values (btrim(p_name), v_slug, v_user_id)
  returning id into v_org_id;

  -- Per-seat price config default ($8 placeholder = 800 cents; editable in
  -- settings, read by the app from here — never hard-coded). Guarded so this
  -- migration is order-tolerant with 00018.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'organizations'
      and column_name = 'seat_price_cents'
  ) then
    execute 'update public.organizations set seat_price_cents = 800 where id = $1'
      using v_org_id;
  end if;

  -- The 9 canon roles (org.json order; reg_number requires 00018, guarded).
  insert into public.roles (org_id, name, description, is_system, system_key, color, created_by)
  values
    (v_org_id, 'Organization owner', 'Everything, including transferring ownership of the organization.', true,  'owner',  'primary', v_user_id),
    (v_org_id, 'Member',             'Uses the workspace; sees their own record and the teams they are on.', true,  'member', 'neutral', v_user_id),
    (v_org_id, 'Guest',              'Sees only the teams they are invited to, from outside the organization.', true, 'guest', 'neutral', v_user_id),
    (v_org_id, 'Product admin',      'Product admins run the product workspace. They can invite people, change roles and organize teams. They can''t edit what a role allows, change sign-in or billing, or export the audit archive.', false, null, 'blue', v_user_id),
    (v_org_id, 'Support lead',       'Helps members with profiles, invitations and sessions, and reads the audit log.', false, null, 'amber', v_user_id),
    (v_org_id, 'Analyst',            'Reads the audit log and billing, to report on how access is used.', false, null, 'violet', v_user_id),
    (v_org_id, 'Finance viewer',     'Sees billing and invoices.', false, null, 'green', v_user_id),
    (v_org_id, 'Auditor',            'Reads and exports the audit log for external review.', false, null, 'neutral', v_user_id),
    (v_org_id, 'Billing admin',      'Owns the plan, seats and payment for the organization.', false, null, 'amber', v_user_id)
  on conflict (org_id, name) do nothing;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'roles'
      and column_name = 'reg_number'
  ) then
    execute $upd$
      update public.roles r set reg_number = v.reg
      from (values
        ('Organization owner','R-01'), ('Member','R-02'), ('Guest','R-03'),
        ('Product admin','R-04'), ('Support lead','R-05'), ('Analyst','R-06'),
        ('Finance viewer','R-07'), ('Auditor','R-08'), ('Billing admin','R-09')
      ) as v(role_name, reg)
      where r.org_id = $1 and r.name = v.role_name and r.reg_number is null
    $upd$ using v_org_id;
  end if;

  -- Committed GRANTS (role name, permission key), per the mapping above.
  insert into public.role_permissions (role_id, permission_key, granted_by)
  select r.id, g.permission_key, v_user_id
  from public.roles r
  join (values
    -- Organization owner: all 18 v1 catalog keys
    ('Organization owner','org:read'), ('Organization owner','org:update'), ('Organization owner','org:transfer_ownership'),
    ('Organization owner','members:read'), ('Organization owner','members:invite'), ('Organization owner','members:change_role'), ('Organization owner','members:deactivate'),
    ('Organization owner','teams:create'), ('Organization owner','teams:manage'),
    ('Organization owner','roles:create'), ('Organization owner','roles:assign'), ('Organization owner','roles:update'), ('Organization owner','roles:delete'),
    ('Organization owner','invitations:manage'), ('Organization owner','audit:read'), ('Organization owner','audit:export'),
    ('Organization owner','settings:manage'), ('Organization owner','billing:view'),
    -- Member / Guest: org shell only (their #3 is an explicit deny)
    ('Member','org:read'),
    ('Guest','org:read'),
    -- Product admin
    ('Product admin','org:read'), ('Product admin','members:invite'), ('Product admin','members:read'),
    ('Product admin','members:change_role'), ('Product admin','audit:read'),
    ('Product admin','teams:create'), ('Product admin','teams:manage'), ('Product admin','invitations:manage'),
    -- Support lead (#3 inherit -> baseline grant of members:read)
    ('Support lead','org:read'), ('Support lead','members:read'),
    ('Support lead','audit:read'), ('Support lead','invitations:manage'),
    -- Analyst
    ('Analyst','org:read'), ('Analyst','audit:read'), ('Analyst','billing:view'),
    -- Finance viewer
    ('Finance viewer','org:read'), ('Finance viewer','billing:view'),
    -- Auditor
    ('Auditor','org:read'), ('Auditor','audit:read'), ('Auditor','audit:export'),
    -- Billing admin
    ('Billing admin','org:read'), ('Billing admin','audit:read'), ('Billing admin','billing:view')
  ) as g(role_name, permission_key) on g.role_name = r.name
  where r.org_id = v_org_id
  on conflict do nothing;

  -- Committed DENIES (role name, permission key) — explicit Deny always wins
  -- in user_permissions() (00015).
  insert into public.role_permission_denies (role_id, permission_key, denied_by)
  select r.id, d.permission_key, v_user_id
  from public.roles r
  join (values
    ('Member','members:read'), ('Member','org:transfer_ownership'),
    ('Guest','members:read'), ('Guest','org:transfer_ownership'),
    ('Product admin','members:deactivate'), ('Product admin','roles:create'),
    ('Product admin','settings:manage'), ('Product admin','org:update'), ('Product admin','org:transfer_ownership'),
    ('Support lead','roles:update'), ('Support lead','roles:create'), ('Support lead','audit:export'),
    ('Support lead','teams:create'), ('Support lead','teams:manage'), ('Support lead','settings:manage'),
    ('Support lead','billing:view'), ('Support lead','org:update'), ('Support lead','org:transfer_ownership'),
    ('Analyst','members:invite'), ('Analyst','members:read'), ('Analyst','members:change_role'),
    ('Analyst','roles:update'), ('Analyst','roles:create'), ('Analyst','audit:export'),
    ('Analyst','teams:create'), ('Analyst','teams:manage'), ('Analyst','org:transfer_ownership'),
    ('Finance viewer','members:invite'), ('Finance viewer','members:deactivate'), ('Finance viewer','members:read'),
    ('Finance viewer','members:change_role'), ('Finance viewer','roles:update'), ('Finance viewer','roles:create'),
    ('Finance viewer','audit:export'), ('Finance viewer','teams:create'), ('Finance viewer','teams:manage'),
    ('Finance viewer','org:transfer_ownership'),
    ('Auditor','members:invite'), ('Auditor','members:deactivate'), ('Auditor','members:read'),
    ('Auditor','members:change_role'), ('Auditor','roles:update'), ('Auditor','roles:create'),
    ('Auditor','teams:create'), ('Auditor','teams:manage'), ('Auditor','billing:view'),
    ('Auditor','org:transfer_ownership'),
    ('Billing admin','members:invite'), ('Billing admin','members:deactivate'), ('Billing admin','members:read'),
    ('Billing admin','members:change_role'), ('Billing admin','roles:update'), ('Billing admin','roles:create'),
    ('Billing admin','audit:export'), ('Billing admin','teams:create'), ('Billing admin','teams:manage'),
    ('Billing admin','org:transfer_ownership')
  ) as d(role_name, permission_key) on d.role_name = r.name
  where r.org_id = v_org_id
  on conflict do nothing;

  -- Founder membership with the Organization owner role.
  insert into public.memberships (org_id, user_id, role_id)
  select v_org_id, v_user_id, r.id
  from public.roles r
  where r.org_id = v_org_id and r.system_key = 'owner'
  on conflict (org_id, user_id) do nothing;

  -- Default role for future members = Member.
  select r.id into v_member_role_id
  from public.roles r
  where r.org_id = v_org_id and r.system_key = 'member';
  update public.organizations set default_role_id = v_member_role_id where id = v_org_id;

  insert into public.audit_log (org_id, actor_id, action, target_type, target_id, target_label)
  values (v_org_id, v_user_id, 'org.created', 'organization', v_org_id, btrim(p_name));

  return v_org_id;
end;
$$;

comment on function public.create_workspace(text, text) is
  'v2 bootstrap: creates a workspace for auth.uid(), seeds the 9 canon roles with committed register states (grants + denies), makes the caller Organization owner, sets default role + seat price default. Worker A: call this (not v1 create_organization) on sign-up workspace creation.';

revoke all on function public.create_workspace(text, text) from public;
grant execute on function public.create_workspace(text, text) to authenticated;
