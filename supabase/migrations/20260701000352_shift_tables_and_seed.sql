-- ====== VARDİYA TABLOLARI ======
create table shift_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  start_time time not null,
  end_time time not null,
  break_minutes int not null default 0
);

create table shift_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  branch_id uuid not null references branches(id),
  shift_template_id uuid references shift_templates(id),
  work_date date not null,
  is_locked boolean not null default false,
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

-- ====== EKSİK KALAN GÜVENLİK: branches için RLS ======
alter table branches enable row level security;

create policy "tenant_isolation_branches"
on branches for select
using (company_id in (select company_id from user_roles where user_id = auth.uid()));

create policy "tenant_isolation_branches_insert"
on branches for insert
with check (company_id in (select company_id from user_roles where user_id = auth.uid()));

-- ====== YENİ TABLOLAR İÇİN RLS ======
alter table shift_templates enable row level security;
alter table shift_assignments enable row level security;

create policy "tenant_isolation_shift_templates_select"
on shift_templates for select
using (company_id in (select company_id from user_roles where user_id = auth.uid()));

create policy "tenant_isolation_shift_templates_insert"
on shift_templates for insert
with check (company_id in (select company_id from user_roles where user_id = auth.uid()));

create policy "tenant_isolation_shift_assignments_select"
on shift_assignments for select
using (company_id in (select company_id from user_roles where user_id = auth.uid()));

create policy "tenant_isolation_shift_assignments_insert"
on shift_assignments for insert
with check (company_id in (select company_id from user_roles where user_id = auth.uid()));

-- ====== ERİŞİM İZİNLERİ ======
grant select, insert, update, delete on shift_templates, shift_assignments to authenticated;

-- ====== TEST VERİSİ: Test Sirketi A için şube ve vardiya şablonu ======
insert into branches (id, company_id, name, latitude, longitude)
values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Merkez Sube', 41.015137, 28.979530);

insert into shift_templates (company_id, name, start_time, end_time, break_minutes)
values ('11111111-1111-1111-1111-111111111111', 'Gunduz Vardiyasi', '09:00', '18:00', 60);