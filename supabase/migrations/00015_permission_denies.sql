-- 00015_permission_denies.sql
--
-- Explicit Deny decisions for the permission register's Allow / Deny /
-- Inherit tri-state (Flagship UI Designs artifact — Crewspace signature UI).
--
--   Allow   → row in role_permissions (grants the key)
--   Deny    → row in role_permission_denies (explicitly blocks the key)
--   Inherit → row in neither table (follows the organization baseline)
--
-- user_permissions() subtracts denied keys so an explicit Deny always wins
-- over a grant. With one role per membership this is belt-and-braces today;
-- it becomes load-bearing the moment an org baseline can grant keys.

-- ---------------------------------------------------------------------------
-- role_permission_denies — join: which permission keys a role explicitly denies
-- ---------------------------------------------------------------------------
create table public.role_permission_denies (
  role_id        uuid not null references public.roles (id) on delete cascade,
  permission_key text not null references public.permissions (key),
  denied_at      timestamptz not null default now(),
  denied_by      uuid references auth.users (id),
  primary key (role_id, permission_key)
);

create index role_permission_denies_key_idx on public.role_permission_denies (permission_key);

-- ---------------------------------------------------------------------------
-- user_permissions() — subtract explicit denies from the granted union
-- ---------------------------------------------------------------------------
create or replace function public.user_permissions(p_org_id uuid, p_user_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct rp.permission_key), '{}')
  from public.memberships m
  join public.role_permissions rp on rp.role_id = m.role_id
  where m.org_id = p_org_id
    and m.user_id = p_user_id
    and m.is_active
    and not exists (
      select 1
      from public.role_permission_denies rd
      where rd.role_id = m.role_id
        and rd.permission_key = rp.permission_key
    );
$$;

comment on function public.user_permissions(uuid, uuid) is
  'Union of permission keys granted by the user''s active membership role in the org, minus explicitly denied keys. Empty array when there is no active membership.';

-- ---------------------------------------------------------------------------
-- role_permission_denies — scoped through the parent role's org
-- (mirrors the role_permissions policies in 00005)
-- ---------------------------------------------------------------------------
alter table public.role_permission_denies enable row level security;

create policy role_permission_denies_select
  on public.role_permission_denies
  for select
  to authenticated
  using (
    exists (
      select 1 from public.roles r
      where r.id = role_permission_denies.role_id
        and public.is_org_member(r.org_id)
    )
  );

create policy role_permission_denies_insert
  on public.role_permission_denies
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.roles r
      where r.id = role_permission_denies.role_id
        and public.has_permission(r.org_id, 'roles:update')
    )
  );

create policy role_permission_denies_update
  on public.role_permission_denies
  for update
  to authenticated
  using (
    exists (
      select 1 from public.roles r
      where r.id = role_permission_denies.role_id
        and public.has_permission(r.org_id, 'roles:update')
    )
  )
  with check (
    exists (
      select 1 from public.roles r
      where r.id = role_permission_denies.role_id
        and public.has_permission(r.org_id, 'roles:update')
    )
  );

create policy role_permission_denies_delete
  on public.role_permission_denies
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.roles r
      where r.id = role_permission_denies.role_id
        and public.has_permission(r.org_id, 'roles:update')
    )
  );
