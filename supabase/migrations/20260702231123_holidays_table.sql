create table holidays (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  holiday_type text not null default 'resmi_tatil',
  counts_as_annual_leave boolean not null default true,
  is_active boolean not null default true
);

alter table holidays enable row level security;

create policy "tenant_isolation_holidays_select"
on holidays for select
using (company_id in (select company_id from user_roles where user_id = auth.uid()));

create policy "admin_manages_holidays"
on holidays for all
using (has_any_role(company_id, array['company_admin']))
with check (has_any_role(company_id, array['company_admin']));

grant select, insert, update, delete on holidays to authenticated;

-- 2026 yılı Türkiye resmi tatilleri (başlangıç verisi)
insert into holidays (company_id, name, start_date, end_date, holiday_type, counts_as_annual_leave)
select c.id, h.name, h.start_date::date, h.end_date::date, 'resmi_tatil', true
from companies c
cross join (values
  ('Yılbaşı', '2026-01-01', '2026-01-01'),
  ('23 Nisan Ulusal Egemenlik ve Çocuk Bayramı', '2026-04-23', '2026-04-23'),
  ('1 Mayıs Emek ve Dayanışma Günü', '2026-05-01', '2026-05-01'),
  ('19 Mayıs Atatürk''ü Anma Gençlik ve Spor Bayramı', '2026-05-19', '2026-05-19'),
  ('Kurban Bayramı', '2026-05-27', '2026-05-30'),
  ('15 Temmuz Demokrasi ve Millî Birlik Günü', '2026-07-15', '2026-07-15'),
  ('30 Ağustos Zafer Bayramı', '2026-08-30', '2026-08-30'),
  ('29 Ekim Cumhuriyet Bayramı', '2026-10-29', '2026-10-29')
) as h(name, start_date, end_date)
on conflict do nothing;