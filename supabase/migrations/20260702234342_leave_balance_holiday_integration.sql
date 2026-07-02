create or replace function get_leave_balances(p_user_id uuid)
returns table (
  leave_type_id uuid,
  leave_type_name text,
  entitled_days int,
  used_days int,
  remaining_days int
)
language plpgsql
security invoker
as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id from user_roles where user_id = p_user_id limit 1;

  return query
  select
    lt.id,
    lt.name,
    lt.annual_entitled_days,
    coalesce(sum(
      case when lr.status = 'approved' then
        -- İzin aralığındaki gün sayısı, EKSİ o aralığa denk gelen ve izinden düşülmeyen tatil günleri
        (lr.end_date - lr.start_date + 1) - (
          select coalesce(sum(
            least(h.end_date, lr.end_date) - greatest(h.start_date, lr.start_date) + 1
          ), 0)
          from holidays h
          where h.company_id = v_company_id
            and h.is_active = true
            and h.counts_as_annual_leave = false
            and h.start_date <= lr.end_date
            and h.end_date >= lr.start_date
        )
      else 0 end
    ), 0)::int as used_days,
    lt.annual_entitled_days - coalesce(sum(
      case when lr.status = 'approved' then
        (lr.end_date - lr.start_date + 1) - (
          select coalesce(sum(
            least(h.end_date, lr.end_date) - greatest(h.start_date, lr.start_date) + 1
          ), 0)
          from holidays h
          where h.company_id = v_company_id
            and h.is_active = true
            and h.counts_as_annual_leave = false
            and h.start_date <= lr.end_date
            and h.end_date >= lr.start_date
        )
      else 0 end
    ), 0)::int as remaining_days
  from leave_types lt
  left join leave_requests lr on lr.leave_type_id = lt.id and lr.user_id = p_user_id
  where lt.company_id = v_company_id
  group by lt.id, lt.name, lt.annual_entitled_days;
end;
$$;

grant execute on function get_leave_balances(uuid) to authenticated;