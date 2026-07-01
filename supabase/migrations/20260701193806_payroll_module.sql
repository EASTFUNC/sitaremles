-- Personel bazlı puantaj özeti: çalışılan gün sayısı, izinli gün sayısı
create or replace function get_payroll_summary(p_company_id uuid, p_period text)
returns table (
  user_id uuid,
  full_name text,
  worked_days bigint,
  leave_days bigint
)
language sql
security invoker
as $$
  select
    p.id,
    p.full_name,
    (
      select count(distinct a.event_time::date)
      from attendance_logs a
      where a.user_id = p.id
        and a.event_type = 'check_in'
        and to_char(a.event_time, 'YYYY-MM') = p_period
    ),
    coalesce((
      select sum(
        least(lr.end_date, (p_period || '-28')::date + 3) -
        greatest(lr.start_date, (p_period || '-01')::date) + 1
      )
      from leave_requests lr
      where lr.user_id = p.id
        and lr.status = 'approved'
        and to_char(lr.start_date, 'YYYY-MM') <= p_period
        and to_char(lr.end_date, 'YYYY-MM') >= p_period
    ), 0)
  from profiles p
  where p.company_id = p_company_id;
$$;

grant execute on function get_payroll_summary(uuid, text) to authenticated;

-- Dijital bordro onay kaydı
create table payroll_approvals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  period text not null,
  status text not null default 'pending',
  approved_at timestamptz,
  unique (user_id, period)
);

alter table payroll_approvals enable row level security;

create policy "tenant_isolation_payroll_select"
on payroll_approvals for select
using (company_id in (select company_id from user_roles where user_id = auth.uid()));

create policy "manager_creates_payroll_records"
on payroll_approvals for insert
with check (has_any_role(company_id, array['company_admin', 'store_manager', 'regional_manager']));

create policy "employee_approves_own_payroll"
on payroll_approvals for update
using (user_id = auth.uid());

grant select, insert, update on payroll_approvals to authenticated;