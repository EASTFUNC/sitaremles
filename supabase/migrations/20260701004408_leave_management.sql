create table leave_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  is_paid boolean not null default true
);

create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  leave_type_id uuid not null references leave_types(id),
  start_date date not null,
  end_date date not null,
  status text not null default 'pending',        -- pending | approved | rejected
  approved_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table leave_types enable row level security;
alter table leave_requests enable row level security;

create policy "tenant_isolation_leave_types_select"
on leave_types for select
using (company_id in (select company_id from user_roles where user_id = auth.uid()));

create policy "tenant_isolation_leave_types_insert"
on leave_types for insert
with check (company_id in (select company_id from user_roles where user_id = auth.uid()));

create policy "tenant_isolation_leave_requests_select"
on leave_requests for select
using (company_id in (select company_id from user_roles where user_id = auth.uid()));

create policy "tenant_isolation_leave_requests_insert"
on leave_requests for insert
with check (
  company_id in (select company_id from user_roles where user_id = auth.uid())
  and user_id = auth.uid()
);

create policy "tenant_isolation_leave_requests_update"
on leave_requests for update
using (company_id in (select company_id from user_roles where user_id = auth.uid()));

grant select, insert, update on leave_types, leave_requests to authenticated;

-- Test verisi: Şirket A için standart izin türleri
insert into leave_types (company_id, name, is_paid) values
  ('11111111-1111-1111-1111-111111111111', 'Yıllık İzin', true),
  ('11111111-1111-1111-1111-111111111111', 'Ücretsiz İzin', false),
  ('11111111-1111-1111-1111-111111111111', 'Mazeret İzni', true);