-- =============================================================================
-- 00008_storage.sql — private buckets org-logos + avatars (DATABASE-SCHEMA.md §5)
--
-- Path convention: org-logos/{org_id}/logo.png, avatars/{user_id}/avatar.png
-- (+ -thumb variants). Signed URLs (1h) are minted server-side; the buckets
-- stay private.
--
-- Policy notes:
--   * storage.foldername(name)[1] is the first path segment (org_id/user_id).
--     Comparisons are done as text against id::text to avoid cast errors on
--     malformed paths (a failed cast would abort the statement instead of
--     denying cleanly).
--   * The 2MB / image-MIME limits and EXIF stripping are enforced
--     client-side at upload time (per the spec); storage policies cannot see
--     object size or content type, so they enforce path + membership only.
-- =============================================================================

insert into storage.buckets (id, name, public)
values
  ('org-logos', 'org-logos', false),
  ('avatars',   'avatars',   false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- org-logos
-- ---------------------------------------------------------------------------

-- SELECT: active members of the org that owns the logo.
create policy "org-logos select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'org-logos'
    and exists (
      select 1 from public.organizations o
      where o.id::text = (storage.foldername(name))[1]
        and public.is_org_member(o.id)
    )
  );

-- INSERT / UPDATE / DELETE: holders of org:update in the logo's org.
create policy "org-logos insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'org-logos'
    and exists (
      select 1 from public.organizations o
      where o.id::text = (storage.foldername(name))[1]
        and public.has_permission(o.id, 'org:update')
    )
  );

create policy "org-logos update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'org-logos'
    and exists (
      select 1 from public.organizations o
      where o.id::text = (storage.foldername(name))[1]
        and public.has_permission(o.id, 'org:update')
    )
  )
  with check (
    bucket_id = 'org-logos'
    and exists (
      select 1 from public.organizations o
      where o.id::text = (storage.foldername(name))[1]
        and public.has_permission(o.id, 'org:update')
    )
  );

create policy "org-logos delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'org-logos'
    and exists (
      select 1 from public.organizations o
      where o.id::text = (storage.foldername(name))[1]
        and public.has_permission(o.id, 'org:update')
    )
  );

-- ---------------------------------------------------------------------------
-- avatars
-- ---------------------------------------------------------------------------

-- SELECT: members of any org shared with the avatar's owner.
create policy "avatars select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and exists (
      select 1
      from public.memberships m1
      join public.memberships m2 on m2.org_id = m1.org_id
      where m1.user_id = (select auth.uid())
        and m1.is_active
        and m2.is_active
        and m2.user_id::text = (storage.foldername(name))[1]
    )
  );

-- INSERT / UPDATE / DELETE: own user_id path only (avatars/{auth.uid()}/...).
create policy "avatars insert own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars update own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars delete own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
