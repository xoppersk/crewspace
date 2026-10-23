-- =============================================================================
-- 00018_org_config_columns.sql — config-driven plan price + canon register
-- numbers (Worker S)
--
--   * organizations.seat_price_cents — the per-seat price as CONFIG.
--     00009 added only session columns to organizations; no price field
--     existed anywhere. Default 800 = the $8 placeholder from org.json
--     plan.pricePerSeat, stored as a DEFAULT so it is editable per org in
--     settings. The app must read the price from here, never hard-code it.
--   * roles.reg_number / teams.reg_number — the canon register numbers
--     (R-01..R-09, T-01..T-07) exposed by src/lib/types.ts. Nullable; the
--     seed + create_workspace fill them for canon rows.
--   * teams.is_unlisted — Partnerships is canon `unlisted: true` in
--     data/teams.json; there was no column to carry it.
--
-- IDEMPOTENT: every statement uses IF NOT EXISTS / DO blocks and runs
-- cleanly on a fresh DB and on a DB where 00001-00016 already applied.
-- =============================================================================

alter table public.organizations
  add column if not exists seat_price_cents integer not null default 800;

comment on column public.organizations.seat_price_cents is
  'Per-seat price in cents (config, editable in org settings). Default 800 = $8 placeholder from the v2 canon; the app reads it from here and never hard-codes a price.';

-- Guard against negative prices (constraint added defensively — a plain
-- ADD CONSTRAINT is not idempotent, hence the DO block).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'organizations_seat_price_nonnegative'
      and conrelid = 'public.organizations'::regclass
  ) then
    alter table public.organizations
      add constraint organizations_seat_price_nonnegative
      check (seat_price_cents >= 0);
  end if;
end $$;

alter table public.roles
  add column if not exists reg_number text;

comment on column public.roles.reg_number is
  'Canon register number (R-01..) shown by the v2 UI. Nullable for ad-hoc custom roles.';

alter table public.teams
  add column if not exists reg_number text;

comment on column public.teams.reg_number is
  'Canon register number (T-01..) shown by the v2 UI. Nullable for ad-hoc teams.';

alter table public.teams
  add column if not exists is_unlisted boolean not null default false;

comment on column public.teams.is_unlisted is
  'True for canon unlisted teams (e.g. Partnerships): hidden from default team lists.';
