create or replace function record_attendance(
  p_branch_id uuid,
  p_event_type text,
  p_latitude double precision,
  p_longitude double precision,
  p_qr_payload text default null
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_company_id uuid;
  v_branch record;
  v_distance_m numeric;
  v_within boolean;
  v_log_id uuid;
begin
  select company_id into v_company_id
  from user_roles
  where user_id = auth.uid()
  limit 1;

  if v_company_id is null then
    raise exception 'Kullanici herhangi bir sirkete atanmamis';
  end if;

  select * into v_branch
  from branches
  where id = p_branch_id and company_id = v_company_id;

  if v_branch is null then
    raise exception 'Sube bulunamadi veya erisim izniniz yok';
  end if;

  v_distance_m := 6371000 * acos(
    least(1, greatest(-1,
      cos(radians(v_branch.latitude)) * cos(radians(p_latitude)) *
      cos(radians(p_longitude) - radians(v_branch.longitude)) +
      sin(radians(v_branch.latitude)) * sin(radians(p_latitude))
    ))
  );

  v_within := v_distance_m <= v_branch.geofence_radius_meters;

  insert into attendance_logs (
    company_id, user_id, branch_id, event_type, latitude, longitude,
    distance_from_branch_m, is_within_geofence, qr_payload
  ) values (
    v_company_id, auth.uid(), p_branch_id, p_event_type, p_latitude, p_longitude,
    v_distance_m, v_within, p_qr_payload
  )
  returning id into v_log_id;

  return jsonb_build_object(
    'success', true,
    'log_id', v_log_id,
    'distance_m', round(v_distance_m, 1),
    'within_geofence', v_within
  );
end;
$$;

grant execute on function record_attendance(uuid, text, double precision, double precision, text) to authenticated;