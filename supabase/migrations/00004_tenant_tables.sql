-- =============================================================================
-- 00004_tenant_tables.sql — memberships, teams, invitations, audit_log + RLS
--
-- Every table here carries org_id and has RLS enabled with policies rooted at
-- is_org_member(row.org_id) / has_permission(row.org_id, key) from 00003.
--
-- Table creation order respects FK dependencies:
--   memberships -> teams (lead_membership_id) -> team_memberships -> invitations,
--   audit_log. The profiles RLS policies are replaced here because the new
--   SELECT policy joins memberships (created in this file).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- memberships — the heart of tenancy and RBAC
-- ---------------------------------------------------------------------------
create table public.memberships (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  role_id        uuid not null references public.roles (id) on delete restrict,
  is_active      boolean not null default true,
  deactivated_at timestamptz,
  deactivated_by uuid references auth.users (id),
  last_active_at timestamptz,
  joined_at      timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  unique (org_id, user_id)
);

comment on table public.memberships is
  'A user''s membership in an org. is_active=false revokes access; the row is kept.';

create index memberships_org_idx on public.memberships (org_id);
create index memberships_user_idx on public.memberships (user_id);
create index memberships_role_idx on public.memberships (role_id);

alter table public.memberships enable row level security;

-- Members with members:read see the directory; everyone sees their own row.
create policy memberships_select
  on public.memberships
  for select
  to authenticated
  using (
    public.is_org_member(org_id)
    and (
      public.has_permission(org_id, 'members:read')
      or user_id = (select auth.uid())
    )
  );

-- New memberships come from accept_invitation() / create_organization()
-- (SECURITY DEFINER, bypass RLS) or from an inviter holding members:invite.
create policy memberships_insert
  on public.memberships
  for insert
  to authenticated
  with check (public.has_permission(org_id, 'members:invite'));

-- Role changes: members:change_role, never on your own row (T1). Column-level
-- precision (role_id vs is_active) is enforced by the membership_update_guard
-- trigger in 00006 — RLS policies are permissive-OR'd, so the trigger is the
-- layer that distinguishes which permission each changed column needs.
create policy memberships_update_role
  on public.memberships
  for update
  to authenticated
  using (
    public.is_org_member(org_id)
    and user_id <> (select auth.uid())
    and public.has_permission(org_id, 'members:change_role')
  )
  with check (
    public.is_org_member(org_id)
    and user_id <> (select auth.uid())
    and public.has_permission(org_id, 'members:change_role')
  );

-- Deactivation / reactivation: members:deactivate, never on your own row.
create policy memberships_update_deactivate
  on public.memberships
  for update
  to authenticated
  using (
    public.is_org_member(org_id)
    and user_id <> (select auth.uid())
    and public.has_permission(org_id, 'members:deactivate')
  )
  with check (
    public.is_org_member(org_id)
    and user_id <> (select auth.uid())
    and public.has_permission(org_id, 'members:deactivate')
  );

-- Removal: members:deactivate; the prevent_last_owner_loss trigger (00006)
-- blocks orphaning the org (T2).
create policy memberships_delete
  on public.memberships
  for delete
  to authenticated
  using (
    public.is_org_member(org_id)
    and user_id <> (select auth.uid())
    and public.has_permission(org_id, 'members:deactivate')
  );

grant select, insert, update, delete on public.memberships to authenticated;

-- ---------------------------------------------------------------------------
-- teams
-- ---------------------------------------------------------------------------
create table public.teams (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations (id) on delete cascade,
  name               text not null,
  description        text,
  lead_membership_id uuid references public.memberships (id) on delete set null,
  is_archived        boolean not null default false,
  created_by         uuid not null references auth.users (id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (org_id, name)
);

create index teams_org_idx on public.teams (org_id);

alter table public.teams enable row level security;

create policy teams_select
  on public.teams for select to authenticated
  using (public.is_org_member(org_id));

create policy teams_insert
  on public.teams for insert to authenticated
  with check (public.has_permission(org_id, 'teams:create'));

-- Archive is preferred over hard delete; both need teams:manage.
create policy teams_update
  on public.teams for update to authenticated
  using (public.has_permission(org_id, 'teams:manage'))
  with check (public.has_permission(org_id, 'teams:manage'));

create policy teams_delete
  on public.teams for delete to authenticated
  using (public.has_permission(org_id, 'teams:manage'));

grant select, insert, update, delete on public.teams to authenticated;

create trigger teams_set_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- team_memberships
-- ---------------------------------------------------------------------------
create table public.team_memberships (
  team_id       uuid not null references public.teams (id) on delete cascade,
  membership_id uuid not null references public.memberships (id) on delete cascade,
  added_by      uuid not null references auth.users (id),
  added_at      timestamptz not null default now(),
  primary key (team_id, membership_id)
);

create index team_memberships_membership_idx
  on public.team_memberships (membership_id);

alter table public.team_memberships enable row level security;

-- Org of the row = org of the parent team.
create policy team_memberships_select
  on public.team_memberships for select to authenticated
  using (
    exists (
      select 1 from public.teams t
      where t.id = team_memberships.team_id
        and public.is_org_member(t.org_id)
    )
  );

create policy team_memberships_insert
  on public.team_memberships for insert to authenticated
  with check (
    exists (
      select 1 from public.teams t
      where t.id = team_memberships.team_id
        and public.has_permission(t.org_id, 'teams:manage')
    )
  );

-- No UPDATE policy: change team membership by delete + re-insert.
create policy team_memberships_delete
  on public.team_memberships for delete to authenticated
  using (
    exists (
      select 1 from public.teams t
      where t.id = team_memberships.team_id
        and public.has_permission(t.org_id, 'teams:manage')
    )
  );

grant select, insert, delete on public.team_memberships to authenticated;

-- ---------------------------------------------------------------------------
-- invitations — token stored as SHA-256 hash; raw token only in the email
-- ---------------------------------------------------------------------------
create table public.invitations (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations (id) on delete cascade,
  email            citext not null,
  role_id          uuid not null references public.roles (id),
  team_ids         uuid[] not null default '{}',
  token_hash       text not null unique,
  status           text not null default 'pending'
    check (status in ('pending', 'accepted', 'expired', 'revoked')),
  invited_by       uuid not null references auth.users (id),
  message          text,
  source           text not null default 'manual'
    check (source in ('manual', 'bulk')),
  expires_at       timestamptz not null default (now() + interval '7 days'),
  accepted_at      timestamptz,
  accepted_user_id uuid references auth.users (id),
  resend_count     integer not null default 0,
  created_at       timestamptz not null default now()
);

comment on table public.invitations is
  'Email invitations. token_hash is the SHA-256 of the raw token; the raw token exists only in the email link.';

create index invitations_org_idx on public.invitations (org_id);
create index invitations_email_idx on public.invitations (email);
create index invitations_status_idx on public.invitations (org_id, status);

alter table public.invitations enable row level security;

-- Invitation managers see everything; members:read holders see the list too.
create policy invitations_select
  on public.invitations for select to authenticated
  using (
    public.has_permission(org_id, 'invitations:manage')
    or public.has_permission(org_id, 'members:read')
  );

-- Issuing needs members:invite. The org invite_policy (owners/admins/managers)
-- is enforced one layer up in the issuing server action (later phase).
create policy invitations_insert
  on public.invitations for insert to authenticated
  with check (public.has_permission(org_id, 'members:invite'));

-- Resend / revoke flip status + token.
create policy invitations_update
  on public.invitations for update to authenticated
  using (public.has_permission(org_id, 'invitations:manage'))
  with check (public.has_permission(org_id, 'invitations:manage'));

-- No DELETE policy: revoke != delete; invitation history is preserved.

grant select, insert, update on public.invitations to authenticated;

-- ---------------------------------------------------------------------------
-- audit_log — immutable, append-only. INSERT + SELECT only; no UPDATE/DELETE
-- policies exist, and the audit_log_no_modify trigger (00006) raises on any
-- UPDATE/DELETE attempt, even from service-role connections (T4).
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  actor_id     uuid not null references auth.users (id),
  action       text not null,
  target_type  text,
  target_id    uuid,
  target_label text,
  diff         jsonb not null default '{}',
  metadata     jsonb not null default '{}',
  created_at   timestamptz not null default now()
);

comment on table public.audit_log is
  'Immutable, append-only audit trail. No UPDATE/DELETE policy exists; the audit_log_no_modify trigger raises on any attempt.';

create index audit_log_org_created_idx
  on public.audit_log (org_id, created_at desc);
create index audit_log_action_idx on public.audit_log (org_id, action);

alter table public.audit_log enable row level security;

create policy audit_log_select
  on public.audit_log for select to authenticated
  using (public.has_permission(org_id, 'audit:read'));

-- Writes come from server actions running as the actor; no anonymous writes.
create policy audit_log_insert
  on public.audit_log for insert to authenticated
  with check (public.is_org_member(org_id));

-- Deliberately NO update / NO delete policy.

grant select, insert on public.audit_log to authenticated;

-- ---------------------------------------------------------------------------
-- profiles RLS: replace the starter's owner-only policies.
-- Spec §3: SELECT = own row OR any active member of a shared org;
--          INSERT/UPDATE = own row only; DELETE = none.
-- (Must live here — the SELECT policy joins memberships, created above.)
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

create policy profiles_select_shared
  on public.profiles
  for select
  to authenticated
  using (
    (select auth.uid()) = id
    or exists (
      select 1
      from public.memberships m1
      join public.memberships m2 on m2.org_id = m1.org_id
      where m1.user_id = (select auth.uid())
        and m1.is_active
        and m2.user_id = profiles.id
        and m2.is_active
    )
  );

create policy profiles_insert_own
  on public.profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- No DELETE policy: account deletion is a privileged server flow.

grant select, insert, update on public.profiles to authenticated;
