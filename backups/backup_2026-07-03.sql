


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."archive_old_attendance_logs"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_count int;
begin
  with moved as (
    delete from attendance_logs
    where event_time < now() - interval '90 days'
    returning *
  )
  insert into attendance_logs_archive
  select * from moved;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


ALTER FUNCTION "public"."archive_old_attendance_logs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_shift_conflicts"("p_user_id" "uuid", "p_work_date" "date", "p_shift_template_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    AS $$
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


ALTER FUNCTION "public"."check_shift_conflicts"("p_user_id" "uuid", "p_work_date" "date", "p_shift_template_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_new_company"("p_name" "text", "p_plan" "text" DEFAULT 'trial'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_id uuid;
begin
  if not is_super_admin() then
    raise exception 'Bu islem icin super admin yetkisi gerekiyor';
  end if;

  insert into companies (name, plan) values (p_name, p_plan) returning id into v_id;
  return v_id;
end;
$$;


ALTER FUNCTION "public"."create_new_company"("p_name" "text", "p_plan" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."flag_suspicious_attendance"("p_company_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."flag_suspicious_attendance"("p_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_qr_token"("p_branch_id" "uuid", "p_time_bucket" bigint) RETURNS "text"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
  select encode(
    extensions.hmac(p_branch_id::text || ':' || p_time_bucket::text, 'sitaremles-qr-secret-v1', 'sha256'),
    'hex'
  );
$$;


ALTER FUNCTION "public"."generate_qr_token"("p_branch_id" "uuid", "p_time_bucket" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_all_companies_overview"() RETURNS TABLE("company_id" "uuid", "name" "text", "plan" "text", "is_active" boolean, "employee_count" bigint, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not is_super_admin() then
    raise exception 'Bu islem icin super admin yetkisi gerekiyor';
  end if;

  return query
  select c.id, c.name, c.plan, c.is_active, count(p.id), c.created_at
  from companies c
  left join profiles p on p.company_id = c.id
  group by c.id, c.name, c.plan, c.is_active, c.created_at
  order by c.created_at desc;
end;
$$;


ALTER FUNCTION "public"."get_all_companies_overview"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_branch_efficiency"("p_company_id" "uuid") RETURNS TABLE("branch_name" "text", "total_checkins" bigint, "suspicious_checkins" bigint, "distinct_employees" bigint)
    LANGUAGE "sql"
    AS $$
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


ALTER FUNCTION "public"."get_branch_efficiency"("p_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_qr_payload"("p_branch_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."get_current_qr_payload"("p_branch_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_employee_leave_summary"("p_company_id" "uuid") RETURNS TABLE("employee_name" "text", "pending_requests" bigint, "approved_requests" bigint, "rejected_requests" bigint)
    LANGUAGE "sql"
    AS $$
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


ALTER FUNCTION "public"."get_employee_leave_summary"("p_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_leave_balances"("p_user_id" "uuid") RETURNS TABLE("leave_type_id" "uuid", "leave_type_name" "text", "entitled_days" integer, "used_days" integer, "remaining_days" integer)
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."get_leave_balances"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_payroll_summary"("p_company_id" "uuid", "p_period" "text") RETURNS TABLE("user_id" "uuid", "full_name" "text", "worked_days" bigint, "leave_days" bigint)
    LANGUAGE "sql"
    AS $$
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


ALTER FUNCTION "public"."get_payroll_summary"("p_company_id" "uuid", "p_period" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_shift_agent_context"("p_company_id" "uuid", "p_branch_id" "uuid", "p_week_start" "date") RETURNS "jsonb"
    LANGUAGE "sql"
    AS $$
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


ALTER FUNCTION "public"."get_shift_agent_context"("p_company_id" "uuid", "p_branch_id" "uuid", "p_week_start" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_any_role"("p_company_id" "uuid", "p_role_codes" "text"[]) RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1
    from user_roles ur
    join roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and ur.company_id = p_company_id
      and r.code = any(p_role_codes)
  );
$$;


ALTER FUNCTION "public"."has_any_role"("p_company_id" "uuid", "p_role_codes" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_super_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1 from user_roles ur
    join roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.code = 'super_admin'
  );
$$;


ALTER FUNCTION "public"."is_super_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_expense_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.status is distinct from old.status and new.status in ('approved','rejected') then
    insert into notifications (company_id, user_id, title, body, type)
    values (
      new.company_id,
      new.user_id,
      case when new.status = 'approved' then 'Avans/masraf talebiniz onaylandı' else 'Avans/masraf talebiniz reddedildi' end,
      new.amount || ' ₺ - ' || coalesce(new.description, ''),
      'expense_status'
    );
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."notify_expense_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_leave_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.status is distinct from old.status and new.status in ('approved','rejected') then
    insert into notifications (company_id, user_id, title, body, type)
    values (
      new.company_id,
      new.user_id,
      case when new.status = 'approved' then 'İzin talebiniz onaylandı' else 'İzin talebiniz reddedildi' end,
      new.start_date || ' - ' || new.end_date,
      'leave_status'
    );
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."notify_leave_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_payroll_ready"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into notifications (company_id, user_id, title, body, type)
  values (new.company_id, new.user_id, 'Bordronuz onayınızı bekliyor', new.period, 'payroll_ready');
  return new;
end;
$$;


ALTER FUNCTION "public"."notify_payroll_ready"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_task_assigned"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into notifications (company_id, user_id, title, body, type)
  select new.company_id, new.assigned_to, 'Yeni görev atandı',
    (select title from checklist_templates where id = new.checklist_template_id),
    'task_assigned';
  return new;
end;
$$;


ALTER FUNCTION "public"."notify_task_assigned"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_attendance"("p_branch_id" "uuid", "p_event_type" "text", "p_latitude" double precision, "p_longitude" double precision, "p_qr_payload" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."record_attendance"("p_branch_id" "uuid", "p_event_type" "text", "p_latitude" double precision, "p_longitude" double precision, "p_qr_payload" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_manual_attendance"("p_target_user_id" "uuid", "p_branch_id" "uuid", "p_event_type" "text", "p_event_time" timestamp with time zone, "p_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."record_manual_attendance"("p_target_user_id" "uuid", "p_branch_id" "uuid", "p_event_type" "text", "p_event_time" timestamp with time zone, "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_company_plan"("p_company_id" "uuid", "p_plan" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not is_super_admin() then
    raise exception 'Bu islem icin super admin yetkisi gerekiyor';
  end if;

  update companies set plan = p_plan where id = p_company_id;
end;
$$;


ALTER FUNCTION "public"."update_company_plan"("p_company_id" "uuid", "p_plan" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_tc_kimlik"("p_tc" "text") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    AS $_$
declare
  d int[];
  i int;
  odd_sum int := 0;
  even_sum int := 0;
  total_sum int := 0;
begin
  if p_tc !~ '^[1-9][0-9]{10}$' then
    return false;
  end if;
  for i in 1..11 loop
    d[i] := substring(p_tc from i for 1)::int;
  end loop;
  odd_sum := d[1]+d[3]+d[5]+d[7]+d[9];
  even_sum := d[2]+d[4]+d[6]+d[8];
  if ((odd_sum * 7 - even_sum) % 10) <> d[10] then
    return false;
  end if;
  for i in 1..10 loop
    total_sum := total_sum + d[i];
  end loop;
  return (total_sum % 10) = d[11];
end;
$_$;


ALTER FUNCTION "public"."validate_tc_kimlik"("p_tc" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."ai_agent_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "agent_name" "text" NOT NULL,
    "status" "text" NOT NULL,
    "summary" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_agent_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendance_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "event_time" timestamp with time zone DEFAULT "now"() NOT NULL,
    "latitude" double precision,
    "longitude" double precision,
    "distance_from_branch_m" numeric,
    "is_within_geofence" boolean,
    "is_suspicious" boolean DEFAULT false NOT NULL,
    "qr_payload" "text"
);


ALTER TABLE "public"."attendance_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendance_logs_archive" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "event_time" timestamp with time zone DEFAULT "now"() NOT NULL,
    "latitude" double precision,
    "longitude" double precision,
    "distance_from_branch_m" numeric,
    "is_within_geofence" boolean,
    "is_suspicious" boolean DEFAULT false NOT NULL,
    "qr_payload" "text"
);


ALTER TABLE "public"."attendance_logs_archive" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."branches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "latitude" double precision,
    "longitude" double precision,
    "geofence_radius_meters" integer DEFAULT 100 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."branches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."checklist_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "checklist_template_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."checklist_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."checklist_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "title" "text" NOT NULL
);


ALTER TABLE "public"."checklist_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "plan" "text" DEFAULT 'trial'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_settings" (
    "company_id" "uuid" NOT NULL,
    "max_weekly_hours" numeric DEFAULT 45 NOT NULL,
    "max_daily_hours" numeric DEFAULT 11 NOT NULL,
    "min_rest_hours" numeric DEFAULT 11 NOT NULL,
    "break_tolerance_minutes" integer DEFAULT 5 NOT NULL,
    "late_tolerance_minutes" integer DEFAULT 15 NOT NULL,
    "early_leave_tolerance_minutes" integer DEFAULT 15 NOT NULL,
    "geofence_default_radius_m" integer DEFAULT 100 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."company_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."departments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "public"."departments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "is_required" boolean DEFAULT true NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."document_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "document_type_id" "uuid" NOT NULL,
    "file_path" "text" NOT NULL,
    "uploaded_by" "uuid",
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."employee_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_legal_details" (
    "user_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "tc_kimlik_no" "text" NOT NULL,
    "birth_date" "date",
    "address" "text",
    "contract_type" "text" DEFAULT 'belirsiz_sureli'::"text" NOT NULL,
    "hire_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "blood_type" "text",
    "emergency_contact_name" "text",
    "emergency_contact_phone" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tc_kimlik_format" CHECK (("tc_kimlik_no" ~ '^[1-9][0-9]{10}$'::"text")),
    CONSTRAINT "tc_kimlik_valid" CHECK ("public"."validate_tc_kimlik"("tc_kimlik_no"))
);


ALTER TABLE "public"."employee_legal_details" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expense_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "request_type" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "description" "text",
    "receipt_url" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "approved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."expense_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."holidays" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "holiday_type" "text" DEFAULT 'resmi_tatil'::"text" NOT NULL,
    "counts_as_annual_leave" boolean DEFAULT true NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."holidays" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leave_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "leave_type_id" "uuid" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "approved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."leave_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leave_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "is_paid" boolean DEFAULT true NOT NULL,
    "annual_entitled_days" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."leave_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "type" "text" NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payroll_approvals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "period" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "approved_at" timestamp with time zone
);


ALTER TABLE "public"."payroll_approvals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."performance_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "period" "text" NOT NULL,
    "score" numeric,
    "bonus_amount" numeric,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."performance_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "branch_id" "uuid",
    "department_id" "uuid",
    "full_name" "text" NOT NULL,
    "employee_code" "text",
    "phone" "text",
    "hire_date" "date",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_status_check" CHECK (("status" = ANY (ARRAY['application'::"text", 'onboarding'::"text", 'active'::"text", 'on_leave'::"text", 'terminated'::"text", 'blacklisted'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."status" IS 'application: basvuru | onboarding: ise alim sureci | active: calisiyor | on_leave: izinli | terminated: ayrildi | blacklisted: kara liste';



CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shift_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "shift_template_id" "uuid",
    "work_date" "date" NOT NULL,
    "is_locked" boolean DEFAULT false NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_published" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."shift_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shift_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "break_minutes" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."shift_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "checklist_template_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "assigned_to" "uuid" NOT NULL,
    "due_date" "date",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."task_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_item_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_assignment_id" "uuid" NOT NULL,
    "checklist_item_id" "uuid" NOT NULL,
    "is_checked" boolean DEFAULT false NOT NULL,
    "note" "text"
);


ALTER TABLE "public"."task_item_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "user_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."ai_agent_runs"
    ADD CONSTRAINT "ai_agent_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance_logs_archive"
    ADD CONSTRAINT "attendance_logs_archive_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance_logs"
    ADD CONSTRAINT "attendance_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."checklist_items"
    ADD CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."checklist_templates"
    ADD CONSTRAINT "checklist_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_settings"
    ADD CONSTRAINT "company_settings_pkey" PRIMARY KEY ("company_id");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_types"
    ADD CONSTRAINT "document_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_documents"
    ADD CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_legal_details"
    ADD CONSTRAINT "employee_legal_details_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."expense_requests"
    ADD CONSTRAINT "expense_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."holidays"
    ADD CONSTRAINT "holidays_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leave_requests"
    ADD CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leave_types"
    ADD CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payroll_approvals"
    ADD CONSTRAINT "payroll_approvals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payroll_approvals"
    ADD CONSTRAINT "payroll_approvals_user_id_period_key" UNIQUE ("user_id", "period");



ALTER TABLE ONLY "public"."performance_scores"
    ADD CONSTRAINT "performance_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shift_assignments"
    ADD CONSTRAINT "shift_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shift_templates"
    ADD CONSTRAINT "shift_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_assignments"
    ADD CONSTRAINT "task_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_item_results"
    ADD CONSTRAINT "task_item_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "company_id", "role_id");



CREATE OR REPLACE TRIGGER "trg_notify_expense_status" AFTER UPDATE ON "public"."expense_requests" FOR EACH ROW EXECUTE FUNCTION "public"."notify_expense_status_change"();



CREATE OR REPLACE TRIGGER "trg_notify_leave_status" AFTER UPDATE ON "public"."leave_requests" FOR EACH ROW EXECUTE FUNCTION "public"."notify_leave_status_change"();



CREATE OR REPLACE TRIGGER "trg_notify_payroll_ready" AFTER INSERT ON "public"."payroll_approvals" FOR EACH ROW EXECUTE FUNCTION "public"."notify_payroll_ready"();



CREATE OR REPLACE TRIGGER "trg_notify_task_assigned" AFTER INSERT ON "public"."task_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."notify_task_assigned"();



ALTER TABLE ONLY "public"."ai_agent_runs"
    ADD CONSTRAINT "ai_agent_runs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance_logs"
    ADD CONSTRAINT "attendance_logs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."attendance_logs"
    ADD CONSTRAINT "attendance_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance_logs"
    ADD CONSTRAINT "attendance_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."checklist_items"
    ADD CONSTRAINT "checklist_items_checklist_template_id_fkey" FOREIGN KEY ("checklist_template_id") REFERENCES "public"."checklist_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."checklist_templates"
    ADD CONSTRAINT "checklist_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_settings"
    ADD CONSTRAINT "company_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_types"
    ADD CONSTRAINT "document_types_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_documents"
    ADD CONSTRAINT "employee_documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_documents"
    ADD CONSTRAINT "employee_documents_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "public"."document_types"("id");



ALTER TABLE ONLY "public"."employee_documents"
    ADD CONSTRAINT "employee_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."employee_documents"
    ADD CONSTRAINT "employee_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_legal_details"
    ADD CONSTRAINT "employee_legal_details_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_legal_details"
    ADD CONSTRAINT "employee_legal_details_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expense_requests"
    ADD CONSTRAINT "expense_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."expense_requests"
    ADD CONSTRAINT "expense_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expense_requests"
    ADD CONSTRAINT "expense_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."holidays"
    ADD CONSTRAINT "holidays_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leave_requests"
    ADD CONSTRAINT "leave_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."leave_requests"
    ADD CONSTRAINT "leave_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leave_requests"
    ADD CONSTRAINT "leave_requests_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id");



ALTER TABLE ONLY "public"."leave_requests"
    ADD CONSTRAINT "leave_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leave_types"
    ADD CONSTRAINT "leave_types_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payroll_approvals"
    ADD CONSTRAINT "payroll_approvals_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payroll_approvals"
    ADD CONSTRAINT "payroll_approvals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."performance_scores"
    ADD CONSTRAINT "performance_scores_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."performance_scores"
    ADD CONSTRAINT "performance_scores_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."performance_scores"
    ADD CONSTRAINT "performance_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shift_assignments"
    ADD CONSTRAINT "shift_assignments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."shift_assignments"
    ADD CONSTRAINT "shift_assignments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shift_assignments"
    ADD CONSTRAINT "shift_assignments_shift_template_id_fkey" FOREIGN KEY ("shift_template_id") REFERENCES "public"."shift_templates"("id");



ALTER TABLE ONLY "public"."shift_assignments"
    ADD CONSTRAINT "shift_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shift_templates"
    ADD CONSTRAINT "shift_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_assignments"
    ADD CONSTRAINT "task_assignments_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_assignments"
    ADD CONSTRAINT "task_assignments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."task_assignments"
    ADD CONSTRAINT "task_assignments_checklist_template_id_fkey" FOREIGN KEY ("checklist_template_id") REFERENCES "public"."checklist_templates"("id");



ALTER TABLE ONLY "public"."task_assignments"
    ADD CONSTRAINT "task_assignments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_item_results"
    ADD CONSTRAINT "task_item_results_checklist_item_id_fkey" FOREIGN KEY ("checklist_item_id") REFERENCES "public"."checklist_items"("id");



ALTER TABLE ONLY "public"."task_item_results"
    ADD CONSTRAINT "task_item_results_task_assignment_id_fkey" FOREIGN KEY ("task_assignment_id") REFERENCES "public"."task_assignments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "admin_assigns_roles" ON "public"."user_roles" FOR INSERT WITH CHECK ("public"."has_any_role"("company_id", ARRAY['company_admin'::"text"]));



CREATE POLICY "admin_manages_departments" ON "public"."departments" FOR INSERT WITH CHECK ("public"."has_any_role"("company_id", ARRAY['company_admin'::"text"]));



CREATE POLICY "admin_manages_document_types" ON "public"."document_types" USING ("public"."has_any_role"("company_id", ARRAY['company_admin'::"text"])) WITH CHECK ("public"."has_any_role"("company_id", ARRAY['company_admin'::"text"]));



CREATE POLICY "admin_manages_holidays" ON "public"."holidays" USING ("public"."has_any_role"("company_id", ARRAY['company_admin'::"text"])) WITH CHECK ("public"."has_any_role"("company_id", ARRAY['company_admin'::"text"]));



CREATE POLICY "admin_manages_settings" ON "public"."company_settings" USING ("public"."has_any_role"("company_id", ARRAY['company_admin'::"text"])) WITH CHECK ("public"."has_any_role"("company_id", ARRAY['company_admin'::"text"]));



CREATE POLICY "admin_updates_branches" ON "public"."branches" FOR UPDATE USING ("public"."has_any_role"("company_id", ARRAY['company_admin'::"text"]));



CREATE POLICY "admin_updates_departments" ON "public"."departments" FOR UPDATE USING ("public"."has_any_role"("company_id", ARRAY['company_admin'::"text"]));



ALTER TABLE "public"."ai_agent_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "assignee_manages_task_results" ON "public"."task_item_results" FOR INSERT WITH CHECK (("task_assignment_id" IN ( SELECT "task_assignments"."id"
   FROM "public"."task_assignments"
  WHERE ("task_assignments"."assigned_to" = "auth"."uid"()))));



CREATE POLICY "assignee_updates_task_results" ON "public"."task_item_results" FOR UPDATE USING (("task_assignment_id" IN ( SELECT "task_assignments"."id"
   FROM "public"."task_assignments"
  WHERE ("task_assignments"."assigned_to" = "auth"."uid"()))));



CREATE POLICY "assignee_updates_task_status" ON "public"."task_assignments" FOR UPDATE USING ((("assigned_to" = "auth"."uid"()) OR "public"."has_any_role"("company_id", ARRAY['company_admin'::"text", 'store_manager'::"text", 'regional_manager'::"text"])));



ALTER TABLE "public"."attendance_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."attendance_logs_archive" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "authenticated_can_read_roles" ON "public"."roles" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."branches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."checklist_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."checklist_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."departments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_types" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "employee_approves_own_payroll" ON "public"."payroll_approvals" FOR UPDATE USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."employee_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employee_legal_details" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expense_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."holidays" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leave_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leave_types" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "manager_creates_branches" ON "public"."branches" FOR INSERT WITH CHECK ("public"."has_any_role"("company_id", ARRAY['company_admin'::"text", 'store_manager'::"text", 'regional_manager'::"text"]));



CREATE POLICY "manager_creates_payroll_records" ON "public"."payroll_approvals" FOR INSERT WITH CHECK ("public"."has_any_role"("company_id", ARRAY['company_admin'::"text", 'store_manager'::"text", 'regional_manager'::"text"]));



CREATE POLICY "manager_creates_task_assignments" ON "public"."task_assignments" FOR INSERT WITH CHECK ("public"."has_any_role"("company_id", ARRAY['company_admin'::"text", 'store_manager'::"text", 'regional_manager'::"text"]));



CREATE POLICY "manager_deletes_shift_assignments" ON "public"."shift_assignments" FOR DELETE USING ("public"."has_any_role"("company_id", ARRAY['company_admin'::"text", 'store_manager'::"text", 'regional_manager'::"text"]));



CREATE POLICY "manager_flags_suspicious_attendance" ON "public"."attendance_logs" FOR UPDATE USING ("public"."has_any_role"("company_id", ARRAY['company_admin'::"text", 'store_manager'::"text", 'regional_manager'::"text"]));



CREATE POLICY "manager_manages_checklist_items" ON "public"."checklist_items" FOR INSERT WITH CHECK (("checklist_template_id" IN ( SELECT "checklist_templates"."id"
   FROM "public"."checklist_templates"
  WHERE "public"."has_any_role"("checklist_templates"."company_id", ARRAY['company_admin'::"text", 'store_manager'::"text", 'regional_manager'::"text"]))));



CREATE POLICY "manager_manages_checklist_templates" ON "public"."checklist_templates" FOR INSERT WITH CHECK ("public"."has_any_role"("company_id", ARRAY['company_admin'::"text", 'store_manager'::"text", 'regional_manager'::"text"]));



CREATE POLICY "manager_updates_expense" ON "public"."expense_requests" FOR UPDATE USING ("public"."has_any_role"("company_id", ARRAY['company_admin'::"text", 'store_manager'::"text", 'regional_manager'::"text"]));



CREATE POLICY "manager_updates_leave_requests" ON "public"."leave_requests" FOR UPDATE USING ("public"."has_any_role"("company_id", ARRAY['company_admin'::"text", 'store_manager'::"text", 'regional_manager'::"text"]));



CREATE POLICY "manager_updates_shift_assignments" ON "public"."shift_assignments" FOR UPDATE USING ("public"."has_any_role"("company_id", ARRAY['company_admin'::"text", 'store_manager'::"text", 'regional_manager'::"text"]));



CREATE POLICY "manager_updates_shift_templates" ON "public"."shift_templates" FOR UPDATE USING ("public"."has_any_role"("company_id", ARRAY['company_admin'::"text", 'store_manager'::"text", 'regional_manager'::"text"]));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "only_admin_manages_employee_documents" ON "public"."employee_documents" USING ("public"."has_any_role"("company_id", ARRAY['company_admin'::"text"])) WITH CHECK ("public"."has_any_role"("company_id", ARRAY['company_admin'::"text"]));



CREATE POLICY "only_admin_manages_legal_details" ON "public"."employee_legal_details" USING ("public"."has_any_role"("company_id", ARRAY['company_admin'::"text"])) WITH CHECK ("public"."has_any_role"("company_id", ARRAY['company_admin'::"text"]));



ALTER TABLE "public"."payroll_approvals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."performance_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shift_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shift_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_item_results" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_isolation_ai_runs_insert" ON "public"."ai_agent_runs" FOR INSERT WITH CHECK (("company_id" IN ( SELECT "user_roles"."company_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_ai_runs_select" ON "public"."ai_agent_runs" FOR SELECT USING (("company_id" IN ( SELECT "user_roles"."company_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_attendance_archive_select" ON "public"."attendance_logs_archive" FOR SELECT USING (("company_id" IN ( SELECT "user_roles"."company_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_attendance_insert" ON "public"."attendance_logs" FOR INSERT WITH CHECK (("company_id" IN ( SELECT "user_roles"."company_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_attendance_select" ON "public"."attendance_logs" FOR SELECT USING (("company_id" IN ( SELECT "user_roles"."company_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_branches" ON "public"."branches" FOR SELECT USING (("company_id" IN ( SELECT "user_roles"."company_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_checklist_items_select" ON "public"."checklist_items" FOR SELECT USING (("checklist_template_id" IN ( SELECT "checklist_templates"."id"
   FROM "public"."checklist_templates"
  WHERE ("checklist_templates"."company_id" IN ( SELECT "user_roles"."company_id"
           FROM "public"."user_roles"
          WHERE ("user_roles"."user_id" = "auth"."uid"()))))));



CREATE POLICY "tenant_isolation_checklist_templates_select" ON "public"."checklist_templates" FOR SELECT USING (("company_id" IN ( SELECT "user_roles"."company_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_companies" ON "public"."companies" FOR SELECT USING (("id" IN ( SELECT "user_roles"."company_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_departments_select" ON "public"."departments" FOR SELECT USING (("company_id" IN ( SELECT "user_roles"."company_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_document_types_select" ON "public"."document_types" FOR SELECT USING (("company_id" IN ( SELECT "user_roles"."company_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_expense_insert" ON "public"."expense_requests" FOR INSERT WITH CHECK ((("company_id" IN ( SELECT "user_roles"."company_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))) AND ("user_id" = "auth"."uid"())));



CREATE POLICY "tenant_isolation_expense_select" ON "public"."expense_requests" FOR SELECT USING (("company_id" IN ( SELECT "user_roles"."company_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_holidays_select" ON "public"."holidays" FOR SELECT USING (("company_id" IN ( SELECT "user_roles"."company_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_leave_requests_insert" ON "public"."leave_requests" FOR INSERT WITH CHECK ((("company_id" IN ( SELECT "user_roles"."company_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))) AND ("user_id" = "auth"."uid"())));



CREATE POLICY "tenant_isolation_leave_requests_select" ON "public"."leave_requests" FOR SELECT USING (("company_id" IN ( SELECT "user_roles"."company_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_leave_types_insert" ON "public"."leave_types" FOR INSERT WITH CHECK (("company_id" IN ( SELECT "user_roles"."company_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_leave_types_select" ON "public"."leave_types" FOR SELECT USING (("company_id" IN ( SELECT "user_roles"."company_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_payroll_select" ON "public"."payroll_approvals" FOR SELECT USING (("company_id" IN ( SELECT "user_roles"."company_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_performance_insert" ON "public"."performance_scores" FOR INSERT WITH CHECK (("company_id" IN ( SELECT "user_roles"."company_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_performance_select" ON "public"."performance_scores" FOR SELECT USING (("company_id" IN ( SELECT "user_roles"."company_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_profiles" ON "public"."profiles" FOR SELECT USING (("company_id" IN ( SELECT "user_roles"."company_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_settings_select" ON "public"."company_settings" FOR SELECT USING (("company_id" IN ( SELECT "user_roles"."company_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_shift_assignments_insert" ON "public"."shift_assignments" FOR INSERT WITH CHECK (("company_id" IN ( SELECT "user_roles"."company_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_shift_assignments_select" ON "public"."shift_assignments" FOR SELECT USING ((("company_id" IN ( SELECT "user_roles"."company_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))) AND (("is_published" = true) OR "public"."has_any_role"("company_id", ARRAY['company_admin'::"text", 'store_manager'::"text", 'regional_manager'::"text"]))));



CREATE POLICY "tenant_isolation_shift_templates_insert" ON "public"."shift_templates" FOR INSERT WITH CHECK (("company_id" IN ( SELECT "user_roles"."company_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_shift_templates_select" ON "public"."shift_templates" FOR SELECT USING (("company_id" IN ( SELECT "user_roles"."company_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_task_assignments_select" ON "public"."task_assignments" FOR SELECT USING (("company_id" IN ( SELECT "user_roles"."company_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_task_results_select" ON "public"."task_item_results" FOR SELECT USING (("task_assignment_id" IN ( SELECT "task_assignments"."id"
   FROM "public"."task_assignments"
  WHERE ("task_assignments"."company_id" IN ( SELECT "user_roles"."company_id"
           FROM "public"."user_roles"
          WHERE ("user_roles"."user_id" = "auth"."uid"()))))));



CREATE POLICY "user_marks_own_notifications_read" ON "public"."notifications" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_sees_own_notifications" ON "public"."notifications" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "user_sees_own_roles" ON "public"."user_roles" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "user_updates_own_profile" ON "public"."profiles" FOR UPDATE USING ((("id" = "auth"."uid"()) OR "public"."has_any_role"("company_id", ARRAY['company_admin'::"text"])));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";











































































































































































GRANT ALL ON FUNCTION "public"."check_shift_conflicts"("p_user_id" "uuid", "p_work_date" "date", "p_shift_template_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."create_new_company"("p_name" "text", "p_plan" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."flag_suspicious_attendance"("p_company_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."generate_qr_token"("p_branch_id" "uuid", "p_time_bucket" bigint) TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_all_companies_overview"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_branch_efficiency"("p_company_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_current_qr_payload"("p_branch_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_employee_leave_summary"("p_company_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_leave_balances"("p_user_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_payroll_summary"("p_company_id" "uuid", "p_period" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_shift_agent_context"("p_company_id" "uuid", "p_branch_id" "uuid", "p_week_start" "date") TO "authenticated";



GRANT ALL ON FUNCTION "public"."has_any_role"("p_company_id" "uuid", "p_role_codes" "text"[]) TO "authenticated";



GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."record_attendance"("p_branch_id" "uuid", "p_event_type" "text", "p_latitude" double precision, "p_longitude" double precision, "p_qr_payload" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."record_manual_attendance"("p_target_user_id" "uuid", "p_branch_id" "uuid", "p_event_type" "text", "p_event_time" timestamp with time zone, "p_note" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."update_company_plan"("p_company_id" "uuid", "p_plan" "text") TO "authenticated";
























GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ai_agent_runs" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ai_agent_runs" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."ai_agent_runs" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."attendance_logs" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."attendance_logs" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."attendance_logs" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."attendance_logs_archive" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."attendance_logs_archive" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."attendance_logs_archive" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."branches" TO "anon";
GRANT ALL ON TABLE "public"."branches" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."branches" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."checklist_items" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."checklist_items" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."checklist_items" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."checklist_templates" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."checklist_templates" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."checklist_templates" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."companies" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."company_settings" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."company_settings" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."company_settings" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."departments" TO "anon";
GRANT ALL ON TABLE "public"."departments" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."departments" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."document_types" TO "anon";
GRANT ALL ON TABLE "public"."document_types" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."document_types" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."employee_documents" TO "anon";
GRANT ALL ON TABLE "public"."employee_documents" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."employee_documents" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."employee_legal_details" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."employee_legal_details" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."employee_legal_details" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."expense_requests" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."expense_requests" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."expense_requests" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."holidays" TO "anon";
GRANT ALL ON TABLE "public"."holidays" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."holidays" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."leave_requests" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."leave_requests" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."leave_requests" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."leave_types" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."leave_types" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."leave_types" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."notifications" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."notifications" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."notifications" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."payroll_approvals" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."payroll_approvals" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."payroll_approvals" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."performance_scores" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."performance_scores" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."performance_scores" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."profiles" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."roles" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."shift_assignments" TO "anon";
GRANT ALL ON TABLE "public"."shift_assignments" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."shift_assignments" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."shift_templates" TO "anon";
GRANT ALL ON TABLE "public"."shift_templates" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."shift_templates" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."task_assignments" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."task_assignments" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."task_assignments" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."task_item_results" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."task_item_results" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."task_item_results" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_roles" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";































