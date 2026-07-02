create extension if not exists pgcrypto;

-- Dahili: verilen şube + zaman dilimi için imzalı token üretir (gizli anahtar burada saklanır)
create or replace function generate_qr_token(p_branch_id uuid, p_time_bucket bigint)
returns text
language sql
security definer
set search_path = public, extensions
as $$
  select encode(
    extensions.hmac(p_branch_id::text || ':' || p_time_bucket::text, 'sitaremles-qr-secret-v1', 'sha256'),
    'hex'
  );
$$;

-- Dışa açık: sadece "şu anki" geçerli QR verisini döner, geçmiş/gelecek token üretilemez
create or replace function get_current_qr_payload(p_branch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bucket bigint;
  v_token text;
begin
  if not exists (
    select 1 from branches b
    join user_roles ur on ur.company_id = b.company_id
    where b.id = p_branch_id and ur.user_id = auth.uid()
  ) then
    raise exception 'Bu subeye erisim izniniz yok';
  end if;

  v_bucket := floor(extract(epoch from now()) / 5);
  v_token := generate_qr_token(p_branch_id, v_bucket);

  return jsonb_build_object('branch_id', p_branch_id, 'token', v_token, 'bucket', v_bucket);
end;
$$;

grant execute on function generate_qr_token(uuid, bigint) to authenticated;
grant execute on function get_current_qr_payload(uuid) to authenticated;
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
  v_payload jsonb;
  v_token text;
  v_bucket bigint;
  v_current_bucket bigint;
  v_expected_token text;
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

  if p_qr_payload is null then
    raise exception 'QR kod verisi eksik';
  end if;

  v_payload := p_qr_payload::jsonb;
  v_token := v_payload->>'token';
  v_bucket := (v_payload->>'bucket')::bigint;
  v_current_bucket := floor(extract(epoch from now()) / 5);

  if v_token is null or v_bucket is null then
    raise exception 'QR kodu eski surumde, lutfen ekrani yenileyin';
  end if;

  if v_bucket < v_current_bucket - 1 or v_bucket > v_current_bucket then
    raise exception 'QR kodunun suresi dolmus, lutfen tekrar okutun';
  end if;

  v_expected_token := generate_qr_token(p_branch_id, v_bucket);
  if v_token is distinct from v_expected_token then
    raise exception 'Gecersiz QR kodu';
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