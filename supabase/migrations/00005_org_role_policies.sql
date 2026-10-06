-- =============================================================================
-- 00005_org_role_policies.sql — RLS for organizations, roles, permissions,
-- role_permissions (per DATABASE-SCHEMA.md §3)
--
-- Split out of 00004 so that every policy here is written after the helper
-- functions (00003) exist. CREATE POLICY validates its expression, so any
-- policy referencing is_org_member()/has_permission() must come after 00003.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;

create policy organizations_select
  on public.organizations
  for select
  to authenticated
  using (public.is_org_member(id));

-- Any authenticated user may create an org; the org-creation transaction
-- (create_organization(), 00007) adds the owner membership atomically.
-- created_by is pinned to the caller so nobody can forge another founder.
create policy organizations_insert
  on public.organizations
  for insert
  to authenticated
  with check ((select auth.uid()) = created_by);

create policy organizations_update
  on public.organizations
  for update
  to authenticated
  using (public.has_permission(id, 'org:update'))
  with check (public.has_permission(id, 'org:update'));

-- No DELETE policy: org deletion is an owner-only server flow.

grant select, insert, update on public.organizations to authenticated;

-- ---------------------------------------------------------------------------
-- roles — system rows are immutable via RLS (is_system = false required)
-- ---------------------------------------------------------------------------
alter table public.roles enable row level security;

create policy roles_select
  on public.roles
  for select
  to authenticated
  using (public.is_org_member(org_id));

create policy roles_insert
  on public.roles
  for insert
  to authenticated
  with check (
    public.has_permission(org_id, 'roles:create')
    and is_system = false
  );

-- System rows immutable: the old row must be non-system AND the new row must
-- stay non-system (blocks flipping is_system on custom roles too).
create policy roles_update
  on public.roles
  for update
  to authenticated
  using (
    public.has_permission(org_id, 'roles:update')
    and is_system = false
  )
  with check (
    public.has_permission(org_id, 'roles:update')
    and is_system = false
  );

create policy roles_delete
  on public.roles
  for delete
  to authenticated
  using (
    public.has_permission(org_id, 'roles:delete')
    and is_system = false
  );

grant select, insert, update, delete on public.roles to authenticated;

-- ---------------------------------------------------------------------------
-- permissions — read-only catalog for any signed-in user
-- ---------------------------------------------------------------------------
alter table public.permissions enable row level security;

create policy permissions_select
  on public.permissions
  for select
  to authenticated
  using (true);

-- No INSERT / UPDATE / DELETE policies: the app never writes here at runtime.

grant select on public.permissions to authenticated;

-- ---------------------------------------------------------------------------
-- role_permissions — scoped through the parent role's org
-- ---------------------------------------------------------------------------
alter table public.role_permissions enable row level security;

create policy role_permissions_select
  on public.role_permissions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.roles r
      where r.id = role_permissions.role_id
        and public.is_org_member(r.org_id)
    )
  );

create policy role_permissions_insert
  on public.role_permissions
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.roles r
      where r.id = role_permissions.role_id
        and public.has_permission(r.org_id, 'roles:update')
    )
  );

create policy role_permissions_update
  on public.role_permissions
  for update
  to authenticated
  using (
    exists (
      select 1 from public.roles r
      where r.id = role_permissions.role_id
        and public.has_permission(r.org_id, 'roles:update')
    )
  )
  with check (
    exists (
      select 1 from public.roles r
      where r.id = role_permissions.role_id
        and public.has_permission(r.org_id, 'roles:update')
    )
  );

create policy role_permissions_delete
  on public.role_permissions
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.roles r
      where r.id = role_permissions.role_id
        and public.has_permission(r.org_id, 'roles:update')
    )
  );

grant select, insert, update, delete on public.role_permissions to authenticated;
