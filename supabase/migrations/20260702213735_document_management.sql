create table document_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  is_required boolean not null default true,
  is_active boolean not null default true,
  sort_order int not null default 0
);

create table employee_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  document_type_id uuid not null references document_types(id),
  file_path text not null,
  uploaded_by uuid references profiles(id),
  uploaded_at timestamptz not null default now()
);

alter table document_types enable row level security;
alter table employee_documents enable row level security;

create policy "tenant_isolation_document_types_select"
on document_types for select
using (company_id in (select company_id from user_roles where user_id = auth.uid()));

create policy "admin_manages_document_types"
on document_types for all
using (has_any_role(company_id, array['company_admin']))
with check (has_any_role(company_id, array['company_admin']));

create policy "only_admin_manages_employee_documents"
on employee_documents for all
using (has_any_role(company_id, array['company_admin']))
with check (has_any_role(company_id, array['company_admin']));

grant select, insert, update, delete on document_types to authenticated;
grant select, insert, update, delete on employee_documents to authenticated;

-- Yaygın kullanılan başlangıç belge türleri (EMLES'teki listeye benzer)
insert into document_types (company_id, name, is_required, sort_order)
select c.id, t.name, true, t.sort_order
from companies c
cross join (values
  ('Kimlik Fotokopisi', 1),
  ('İkametgah Belgesi', 2),
  ('Adli Sicil Kaydı', 3),
  ('Sağlık Raporu', 4),
  ('Belirsiz Süreli İş Sözleşmesi', 5),
  ('KVKK Aydınlatma Metni ve Açık Rıza', 6),
  ('Kamera İzleme Sistemi Bilgilendirme Formu', 7)
) as t(name, sort_order)
on conflict do nothing;