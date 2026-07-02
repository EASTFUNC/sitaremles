create table company_settings (
  company_id uuid primary key references companies(id) on delete cascade,
  max_weekly_hours numeric not null default 45,
  max_daily_hours numeric not null default 11,
  min_rest_hours numeric not null default 11,
  break_tolerance_minutes int not null default 5,
  late_tolerance_minutes int not null default 15,
  early_leave_tolerance_minutes int not null default 15,
  geofence_default_radius_m int not null default 100,
  updated_at timestamptz not null default now()
);

alter table company_settings enable row level security;

create policy "tenant_isolation_settings_select"
on company_settings for select
using (company_id in (select company_id from user_roles where user_id = auth.uid()));

create policy "admin_manages_settings"
on company_settings for all
using (has_any_role(company_id, array['company_admin']))
with check (has_any_role(company_id, array['company_admin']));

grant select, insert, update on company_settings to authenticated;

-- Test şirketlerimiz için varsayılan ayar satırları oluştur
insert into company_settings (company_id)
select id from companies
on conflict do nothing;