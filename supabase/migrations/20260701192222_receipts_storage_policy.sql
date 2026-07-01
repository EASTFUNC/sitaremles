create policy "users_upload_own_receipts"
on storage.objects for insert
with check (
  bucket_id = 'receipts'
  and auth.role() = 'authenticated'
);

create policy "users_view_own_company_receipts"
on storage.objects for select
using (
  bucket_id = 'receipts'
  and auth.role() = 'authenticated'
);