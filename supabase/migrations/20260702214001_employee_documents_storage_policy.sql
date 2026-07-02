create policy "admin_manages_employee_document_files"
on storage.objects for all
using (bucket_id = 'employee-documents' and auth.role() = 'authenticated')
with check (bucket_id = 'employee-documents' and auth.role() = 'authenticated');