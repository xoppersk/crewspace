-- =============================================================================
-- 00009_org_settings.sql — security settings columns on organizations
--
-- The Settings → Security tab (APP-FLOW §3) needs somewhere to store the
-- session timeout and the re-authentication toggle. Both are app-enforced
-- (read by middleware / server actions); defaults match the schema doc's
-- posture (8h sessions, re-auth opt-in).
-- =============================================================================

alter table public.organizations
  add column session_timeout_minutes integer default 480,
  add column require_reauth_destructive boolean not null default false;

comment on column public.organizations.session_timeout_minutes is
  'Idle session timeout in minutes (app-enforced). NULL = never expire. Default 480 (8h).';
comment on column public.organizations.require_reauth_destructive is
  'When true, destructive actions (deactivate, remove, delete role) require fresh re-authentication.';
