-- =============================================================================
-- 00019_role_permission_changes.sql — register DRAFT (pending) changes
-- (Worker S)
--
-- Why this exists: the v2 UI models a committed-vs-draft review flow —
-- types.ts Role.pendingChanges {permissionId, from, to}, org.json's Product
-- admin carries 2 pending changes, and overview.json surfaces "N changes
-- ready" -> apply / discard. Migrations 00015/00016 cover only COMMITTED
-- state (grants + denies) and copy. Nothing stored drafts, so this table
-- is the minimal addition:
--
--   * one row per proposed (role, permission) state change, scoped by org
--   * status: pending -> applied | discarded (rows are kept for history)
--   * from_state / to_state use the register vocabulary:
--     'allow' | 'deny' | 'inherit' | 'locked'
--   * apply/discard happen through the SECURITY DEFINER RPCs below, which
--     translate the change into role_permissions / role_permission_denies
--     writes inside one transaction and stamp the row.
--
-- Committed-state semantics on apply (mirrors 00017's translation):
--   to 'allow'   -> insert grant, delete any deny for (role, key)
--   to 'deny'    -> insert deny, delete any grant for (role, key)
--   to 'inherit' -> delete grant AND deny (baseline decides; permission 3's
--                   baseline grant is re-derived by the app layer)
--   to 'locked'  -> treated as deny for org:transfer_ownership only; the
--                   RPC refuses 'locked' for any other key.
--
-- IDEMPOTENT / DEFENSIVE: create table if not exists, drop-policy-if-exists
-- before each create policy, create-or-replace functions. Safe on fresh
-- and already-migrated databases.
-- =============================================================================

create table if not exists public.role_permission_changes (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations (id) on delete cascade,
  role_id        uuid not null references public.roles (id) on delete cascade,
  permission_key text not null references public.permissions (key),
  from_state     text not null check (from_state in ('allow', 'deny', 'inherit', 'locked')),
  to_state       text not null check (to_state in ('allow', 'deny', 'inherit', 'locked')),
  status         text not null default 'pending'
                   check (status in ('pending', 'applied', 'discarded')),
  proposed_by    uuid not null references auth.users (id),
  proposed_at    timestamptz not null default now(),
  decided_by     uuid references auth.users (id),
  decided_at     timestamptz
);

-- Exactly one PENDING change per (role, permission); applied/discarded
-- history rows are unrestricted.
create unique index if not exists role_permission_changes_one_pending
  on public.role_permission_changes (role_id, permission_key)
  where status = 'pending';

create index if not exists role_permission_changes_org_idx
  on public.role_permission_changes (org_id, status);

comment on table public.role_permission_changes is
  'Draft (pending) permission-register changes for the v2 review flow: propose -> apply/discard. Committed state lives in role_permissions + role_permission_denies (00015).';

alter table public.role_permission_changes enable row level security;

-- Read: any active member of the org (the count badge is org-visible);
-- direct writes are closed — mutations go through the RPCs below, which
-- require roles:update. A SELECT-only policy set is deliberate.
drop policy if exists role_permission_changes_select on public.role_permission_changes;
create policy role_permission_changes_select
  on public.role_permission_changes
  for select
  to authenticated
  using (public.is_org_member(org_id));

grant select on public.role_permission_changes to authenticated;

-- ---------------------------------------------------------------------------
-- propose_permission_change(p_role_id, p_permission_key, p_to_state) -> uuid
-- Computes from_state from the committed register, so callers can't spoof it.
-- ---------------------------------------------------------------------------
create or replace function public.propose_permission_change(
  p_role_id uuid,
  p_permission_key text,
  p_to_state text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_from   text;
  v_id     uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'crewspace: must be signed in to propose a permission change';
  end if;
  if p_to_state not in ('allow', 'deny', 'inherit', 'locked') then
    raise exception 'crewspace: invalid target state %', p_to_state;
  end if;
  if p_to_state = 'locked' and p_permission_key <> 'org:transfer_ownership' then
    raise exception 'crewspace: only org:transfer_ownership can be locked';
  end if;

  select org_id into v_org_id from public.roles where id = p_role_id;
  if v_org_id is null then
    raise exception 'crewspace: role not found';
  end if;
  if not public.has_permission(v_org_id, 'roles:update') then
    raise exception 'crewspace: missing roles:update permission';
  end if;

  v_from := case
    when exists (select 1 from public.role_permission_denies d
                 where d.role_id = p_role_id and d.permission_key = p_permission_key)
      then 'deny'
    when exists (select 1 from public.role_permissions g
                 where g.role_id = p_role_id and g.permission_key = p_permission_key)
      then 'allow'
    else 'inherit'
  end;

  if v_from = p_to_state then
    raise exception 'crewspace: permission % is already %', p_permission_key, p_to_state;
  end if;

  insert into public.role_permission_changes
    (org_id, role_id, permission_key, from_state, to_state, proposed_by)
  values (v_org_id, p_role_id, p_permission_key, v_from, p_to_state, (select auth.uid()))
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.propose_permission_change(uuid, text, text) is
  'Proposes a draft register change (roles:update required). from_state is derived from committed grants/denies, never caller-supplied.';

revoke all on function public.propose_permission_change(uuid, text, text) from public;
grant execute on function public.propose_permission_change(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- apply_permission_change(p_change_id) — writes committed state + stamps row
-- discard_permission_change(p_change_id) — stamps row only
-- ---------------------------------------------------------------------------
create or replace function public.apply_permission_change(p_change_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_change public.role_permission_changes%rowtype;
begin
  select * into v_change from public.role_permission_changes
  where id = p_change_id for update;
  if not found then
    raise exception 'crewspace: permission change not found';
  end if;
  if v_change.status <> 'pending' then
    raise exception 'crewspace: permission change is no longer pending (status: %)', v_change.status;
  end if;
  if not public.has_permission(v_change.org_id, 'roles:update') then
    raise exception 'crewspace: missing roles:update permission';
  end if;

  if v_change.to_state = 'allow' then
    delete from public.role_permission_denies
      where role_id = v_change.role_id and permission_key = v_change.permission_key;
    insert into public.role_permissions (role_id, permission_key, granted_by)
    values (v_change.role_id, v_change.permission_key, (select auth.uid()))
    on conflict do nothing;
  elsif v_change.to_state in ('deny', 'locked') then
    delete from public.role_permissions
      where role_id = v_change.role_id and permission_key = v_change.permission_key;
    insert into public.role_permission_denies (role_id, permission_key, denied_by)
    values (v_change.role_id, v_change.permission_key, (select auth.uid()))
    on conflict do nothing;
  else -- 'inherit': clear both sides; the baseline decides from here
    delete from public.role_permissions
      where role_id = v_change.role_id and permission_key = v_change.permission_key;
    delete from public.role_permission_denies
      where role_id = v_change.role_id and permission_key = v_change.permission_key;
  end if;

  update public.role_permission_changes
  set status = 'applied', decided_by = (select auth.uid()), decided_at = now()
  where id = p_change_id;

  insert into public.audit_log (org_id, actor_id, action, target_type, target_id, target_label, diff)
  values (
    v_change.org_id, (select auth.uid()), 'role.permissions_changed', 'role',
    v_change.role_id, v_change.permission_key,
    jsonb_build_object('permission', v_change.permission_key,
                       'from', v_change.from_state, 'to', v_change.to_state)
  );
end;
$$;

comment on function public.apply_permission_change(uuid) is
  'Applies one pending register change to role_permissions / role_permission_denies atomically and writes the audit row.';

revoke all on function public.apply_permission_change(uuid) from public;
grant execute on function public.apply_permission_change(uuid) to authenticated;

create or replace function public.discard_permission_change(p_change_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_change public.role_permission_changes%rowtype;
begin
  select * into v_change from public.role_permission_changes
  where id = p_change_id for update;
  if not found then
    raise exception 'crewspace: permission change not found';
  end if;
  if v_change.status <> 'pending' then
    raise exception 'crewspace: permission change is no longer pending (status: %)', v_change.status;
  end if;
  if not public.has_permission(v_change.org_id, 'roles:update') then
    raise exception 'crewspace: missing roles:update permission';
  end if;

  update public.role_permission_changes
  set status = 'discarded', decided_by = (select auth.uid()), decided_at = now()
  where id = p_change_id;
end;
$$;

comment on function public.discard_permission_change(uuid) is
  'Discards one pending register change without touching committed grants/denies.';

revoke all on function public.discard_permission_change(uuid) from public;
grant execute on function public.discard_permission_change(uuid) to authenticated;
