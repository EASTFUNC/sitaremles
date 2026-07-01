create or replace function flag_suspicious_attendance(p_company_id uuid)
returns int
language plpgsql
security invoker
as $$
declare
  v_count1 int;
  v_count2 int;
begin
  if not has_any_role(p_company_id, array['company_admin', 'store_manager', 'regional_manager']) then
    raise exception 'Bu islem icin yetkiniz yok';
  end if;

  update attendance_logs
  set is_suspicious = true
  where company_id = p_company_id
    and is_within_geofence = false
    and is_suspicious = false;
  get diagnostics v_count1 = row_count;

  update attendance_logs a
  set is_suspicious = true
  where a.company_id = p_company_id
    and a.event_type = 'check_in'
    and a.is_suspicious = false
    and exists (
      select 1 from attendance_logs b
      where b.user_id = a.user_id
        and b.branch_id = a.branch_id
        and b.event_type = 'check_in'
        and b.id <> a.id
        and abs(extract(epoch from (a.event_time - b.event_time))) < 180
    );
  get diagnostics v_count2 = row_count;

  return v_count1 + v_count2;
end;
$$;