-- =============================================================================
-- 00003_rbac_helpers.sql — SECURITY DEFINER predicate helpers for RLS
--
-- Every tenant-table policy starts from "the requesting user has an *active*
-- membership in the row's org". These helpers answer that question (and the
-- permission-union question) in one place so policies never inline the join.
--
-- Conventions (per the starter's RLS helper guide):
--   * SECURITY DEFINER + fixed search_path (no search_path hijacking).
--   * STABLE, touch only the membership/role tables — they leak no rows.
--   * Callers wrap auth.uid() in (select ...) so it is evaluated once per
--     statement (initplan), not once per row.
--   * Because they are SECURITY DEFINER they bypass RLS on the tables they
--     read — this is what prevents infinite recursion when RLS policies on
--     memberships themselves call is_org_member().
--
-- Load-bearing order: these functions must exist BEFORE any RLS policy that
-- references them (policies are validated at CREATE POLICY time). The tenant
-- tables (00004) and their policies (00004/00005) come after this file.
-- =============================================================================

-- Active membership in an org?
create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships
    where org_id = p_org_id
      and user_id = (select auth.uid())
      and is_active
  );
$$;

comment on function public.is_org_member(uuid) is
  'True when the requesting user has an active membership in the org. SECURITY DEFINER so RLS policies can call it without recursing.';

-- Union of permission keys for a user's active membership in an org.
-- (Spec: DATABASE-SCHEMA.md §1, helper function.)
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
    and m.is_active;
$$;

comment on function public.user_permissions(uuid, uuid) is
  'Union of permission keys granted by the user''s active membership role in the org. Empty array when there is no active membership.';

-- Does the requesting user hold a permission key in the org?
create or replace function public.has_permission(p_org_id uuid, p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_key = any (public.user_permissions(p_org_id, (select auth.uid())));
$$;

comment on function public.has_permission(uuid, text) is
  'True when the requesting user''s active membership grants the permission key in the org.';
