create or replace function record_manual_attendance(
  p_target_user_id uuid,
  p_branch_id uuid,
  p_event_type text,
  p_event_time timestamptz,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_log_id uuid;
begin
  select company_id into v_company_id from user_roles where user_id = auth.uid() limit 1;

  if not has_any_role(v_company_id, array['company_admin', 'store_manager', 'regional_manager']) then
    raise exception 'Bu islem icin yetkiniz yok';
  end if;

  if not exists (
    select 1 from profiles where id = p_target_user_id and company_id = v_company_id
  ) then
    raise exception 'Personel bu sirkette bulunamadi';
  end if;

  insert into attendance_logs (
    company_id, user_id, branch_id, event_type, event_time,
    is_suspicious, qr_payload
  ) values (
    v_company_id, p_target_user_id, p_branch_id, p_event_type, p_event_time,
    true,
    jsonb_build_object('manual_entry', true, 'entered_by', auth.uid(), 'note', p_note)::text
  )
  returning id into v_log_id;

  return jsonb_build_object('success', true, 'log_id', v_log_id);
end;
$$;

grant execute on function record_manual_attendance(uuid, uuid, text, timestamptz, text) to authenticated;