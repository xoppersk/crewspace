-- =============================================================================
-- 00009_invitation_preview.sql — Worker 2 (Organizations + Invitations)
--
--   * get_invitation_preview(p_token): SECURITY DEFINER read of the safe,
--     public subset of an invitation by RAW token. The /invite/accept page
--     must render the org card (name, logo, inviter, offered role +
--     permission summary, expiry) for SIGNED-OUT invitees, who have no RLS
--     access to the invitations table. Returns zero rows for unknown/
--     tampered tokens — no information leaks.
--   * org_member_id_by_email(p_org_id, p_email): SECURITY DEFINER lookup of
--     an ACTIVE membership id by member email (auth.users is not readable
--     via the anon/RLS path). Lets the invite server action reject
--     already-members gracefully with a link to their profile instead of
--     issuing a duplicate invite.
--
-- Both are revoked from PUBLIC and granted narrowly: preview to anon +
-- authenticated (invitees are usually signed out), the email lookup to
-- authenticated only (callers must already hold members:invite, enforced in
-- the server action layer).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- get_invitation_preview(p_token text)
-- ---------------------------------------------------------------------------
create or replace function public.get_invitation_preview(p_token text)
returns table (
  org_id uuid,
  org_slug text,
  org_name text,
  org_logo_url text,
  email text,
  role_name text,
  role_description text,
  permission_labels text[],
  inviter_name text,
  status text,
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hash text;
begin
  if p_token is null or p_token = '' then
    return;
  end if;

  -- Only the SHA-256 hash is stored; the raw token never touches the DB.
  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  return query
  select
    i.org_id,
    o.slug,
    o.name,
    o.logo_url,
    i.email::text,
    r.name,
    r.description,
    coalesce(
      (
        select array_agg(p.label order by p.key)
        from public.role_permissions rp
        join public.permissions p on p.key = rp.permission_key
        where rp.role_id = i.role_id
      ),
      '{}'
    ),
    coalesce(pr.full_name, 'A teammate'),
    i.status,
    i.expires_at
  from public.invitations i
  join public.organizations o on o.id = i.org_id
  join public.roles r on r.id = i.role_id
  left join public.profiles pr on pr.id = i.invited_by
  where i.token_hash = v_hash;
end;
$$;

comment on function public.get_invitation_preview(text) is
  'Worker 2: public-safe invitation preview for /invite/accept. SECURITY DEFINER; zero rows for unknown tokens.';

revoke all on function public.get_invitation_preview(text) from public;
grant execute on function public.get_invitation_preview(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- org_member_id_by_email(p_org_id uuid, p_email citext) returns uuid
-- ---------------------------------------------------------------------------
create or replace function public.org_member_id_by_email(p_org_id uuid, p_email citext)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.id
  from public.memberships m
  join auth.users u on u.id = m.user_id
  where m.org_id = p_org_id
    and m.is_active
    and u.email = p_email
  limit 1;
$$;

comment on function public.org_member_id_by_email(uuid, citext) is
  'Worker 2: active-membership lookup by email for duplicate-invite detection. Server actions only.';

revoke all on function public.org_member_id_by_email(uuid, citext) from public;
grant execute on function public.org_member_id_by_email(uuid, citext) to authenticated;
