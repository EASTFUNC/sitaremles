-- Şube bazlı verimlilik özeti: giriş sayısı, geç kalma sayısı, ortalama mesai
create or replace function get_branch_efficiency(p_company_id uuid)
returns table (
  branch_name text,
  total_checkins bigint,
  suspicious_checkins bigint,
  distinct_employees bigint
)
language sql
security invoker
as $$
  select
    b.name,
    count(a.id) filter (where a.event_type = 'check_in'),
    count(a.id) filter (where a.is_suspicious = true),
    count(distinct a.user_id)
  from branches b
  left join attendance_logs a on a.branch_id = b.id
  where b.company_id = p_company_id
  group by b.id, b.name;
$$;

-- Personel bazlı izin özeti
create or replace function get_employee_leave_summary(p_company_id uuid)
returns table (
  employee_name text,
  pending_requests bigint,
  approved_requests bigint,
  rejected_requests bigint
)
language sql
security invoker
as $$
  select
    p.full_name,
    count(lr.id) filter (where lr.status = 'pending'),
    count(lr.id) filter (where lr.status = 'approved'),
    count(lr.id) filter (where lr.status = 'rejected')
  from profiles p
  left join leave_requests lr on lr.user_id = p.id
  where p.company_id = p_company_id
  group by p.id, p.full_name;
$$;

grant execute on function get_branch_efficiency(uuid) to authenticated;
grant execute on function get_employee_leave_summary(uuid) to authenticated;