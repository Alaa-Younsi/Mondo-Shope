-- =============================================================================
-- 0006_storage.sql — media buckets
--
-- Creates the buckets and their policies in SQL so setup is not a manual
-- dashboard step that is easy to get half-right. Both buckets are public-read
-- (product photos are public by definition) and admin-only write.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 10485760,
   array['image/jpeg','image/png','image/webp','image/avif','image/gif']),
  ('product-videos', 'product-videos', true, 78643200,
   array['video/mp4','video/webm','video/quicktime'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public read ------------------------------------------------------------------
drop policy if exists "public read media" on storage.objects;
create policy "public read media" on storage.objects
  for select to anon, authenticated
  using (bucket_id in ('product-images', 'product-videos'));

-- Admin write --------------------------------------------------------------------
-- Object-level rules per section are not worth it here: the tables that
-- reference the uploads are what carry the real permissions.
drop policy if exists "admin upload media" on storage.objects;
create policy "admin upload media" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('product-images', 'product-videos') and public.is_admin());

drop policy if exists "admin update media" on storage.objects;
create policy "admin update media" on storage.objects
  for update to authenticated
  using (bucket_id in ('product-images', 'product-videos') and public.is_admin())
  with check (bucket_id in ('product-images', 'product-videos') and public.is_admin());

drop policy if exists "admin delete media" on storage.objects;
create policy "admin delete media" on storage.objects
  for delete to authenticated
  using (bucket_id in ('product-images', 'product-videos') and public.is_admin());
