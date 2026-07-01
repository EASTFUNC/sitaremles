-- Belirli bir şube ve hafta için: personel listesi, o haftaki onaylı izinleri,
-- mevcut vardiya atamalarını tek bir JSON'da toplayan fonksiyon.
create or replace function get_shift_agent_context(p_company_id uuid, p_branch_id uuid, p_week_start date)
returns jsonb
language sql
security invoker
as $$
  select jsonb_build_object(
    'employees', (
      select jsonb_agg(jsonb_build_object('user_id', p.id, 'full_name', p.full_name))
      from profiles p
      where p.company_id = p_company_id and p.branch_id = p_branch_id
    ),
    'leave_conflicts', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', lr.user_id,
        'start_date', lr.start_date,
        'end_date', lr.end_date
      )), '[]'::jsonb)
      from leave_requests lr
      where lr.company_id = p_company_id
        and lr.status = 'approved'
        and lr.start_date <= p_week_start + 6
        and lr.end_date >= p_week_start
    ),
    'existing_assignments', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', sa.user_id,
        'work_date', sa.work_date
      )), '[]'::jsonb)
      from shift_assignments sa
      where sa.company_id = p_company_id
        and sa.branch_id = p_branch_id
        and sa.work_date between p_week_start and p_week_start + 6
    ),
    'shift_templates', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', st.id, 'name', st.name, 'start_time', st.start_time, 'end_time', st.end_time
      )), '[]'::jsonb)
      from shift_templates st
      where st.company_id = p_company_id
    )
  );
$$;

grant execute on function get_shift_agent_context(uuid, uuid, date) to authenticated;