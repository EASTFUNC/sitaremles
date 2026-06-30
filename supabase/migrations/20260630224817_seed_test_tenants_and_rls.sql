-- Test şirketleri
insert into companies (id, name) values
  ('11111111-1111-1111-1111-111111111111', 'Test Sirketi A'),
  ('22222222-2222-2222-2222-222222222222', 'Test Sirketi B');

-- Test kullanicilarinin profilleri (UID_A / UID_B kendi degerlerinle degisecek)
insert into profiles (id, company_id, full_name) values
  ('46714a7d-c6d2-4c24-baff-9f8f96dc0cc3', '11111111-1111-1111-1111-111111111111', 'Admin A'),
  ('933e85e3-2d48-45ec-9e88-c066c634a836', '22222222-2222-2222-2222-222222222222', 'Admin B');

-- Rol atamasi
insert into user_roles (user_id, company_id, role_id)
select '46714a7d-c6d2-4c24-baff-9f8f96dc0cc3'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, id from roles where code = 'company_admin'
union all
select '933e85e3-2d48-45ec-9e88-c066c634a836'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, id from roles where code = 'company_admin';

-- ====== RLS (Satır Seviyesi Güvenlik) ======
alter table companies enable row level security;
alter table profiles enable row level security;
alter table user_roles enable row level security;

create policy "tenant_isolation_companies"
on companies for select
using (
  id in (select company_id from user_roles where user_id = auth.uid())
);

create policy "tenant_isolation_profiles"
on profiles for select
using (
  company_id in (select company_id from user_roles where user_id = auth.uid())
);

create policy "user_sees_own_roles"
on user_roles for select
using (user_id = auth.uid());