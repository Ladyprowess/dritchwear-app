-- The /corporate quote form is public (no login required, since the
-- companies submitting it usually have no Dritchwear account) but its
-- optional logo upload reuses the custom-order-assets bucket, which only
-- allows authenticated uploads - confirmed by testing an anonymous upload
-- directly, which the existing policy rejected. Add a narrowly-scoped policy
-- so anonymous visitors can upload only under the corporate-quotes/ prefix
-- this form uses, without loosening access to any other existing path in
-- the bucket (order logos, etc. stay authenticated-only).
drop policy if exists "corporate quote logo anon upload" on storage.objects;
create policy "corporate quote logo anon upload" on storage.objects
  for insert to anon
  with check (bucket_id = 'custom-order-assets' and name like 'corporate-quotes/%');
