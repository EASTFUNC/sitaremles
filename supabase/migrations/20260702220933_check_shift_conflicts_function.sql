create or replace function check_shift_conflicts(
  p_user_id uuid, p_work_date date, p_shift_template_id uuid
) returns jsonb
language plpgsql stable as $$
declare
  v_conflicts jsonb := '[]'::jsonb;
  v_existing_count int;
  v_prev_end time;
  v_new_start time;
  v_rest_hours numeric;
begin
  select count(*) into v_existing_count
  from shift_assignments
  where user_id = p_user_id and work_date = p_work_date;

  if v_existing_count > 0 then
    v_conflicts := v_conflicts || jsonb_build_object('type', 'same_day_double', 'severity', 'blocking');
  end if;

  select st.end_time into v_prev_end
  from shift_assignments sa join shift_templates st on st.id = sa.shift_template_id
  where sa.user_id = p_user_id and sa.work_date = p_work_date - 1;

  select start_time into v_new_start from shift_templates where id = p_shift_template_id;

  if v_prev_end is not null and v_new_start is not null then
    v_rest_hours := extract(epoch from (
      (p_work_date::timestamp + v_new_start) - ((p_work_date - 1)::timestamp + v_prev_end)
    )) / 3600;
    if v_rest_hours < 11 and v_rest_hours >= 0 then
      v_conflicts := v_conflicts || jsonb_build_object('type', 'rest_period', 'severity', 'warning', 'rest_hours', v_rest_hours);
    end if;
  end if;

  return v_conflicts;
end;
$$;

grant execute on function check_shift_conflicts(uuid, date, uuid) to authenticated;