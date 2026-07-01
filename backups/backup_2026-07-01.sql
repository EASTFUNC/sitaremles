


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


CREATE OR REPLACE FUNCTION "public"."get_leave_balances"("p_user_id" "uuid") RETURNS TABLE("leave_type_id" "uuid", "leave_type_name" "text", "entitled_days" integer, "used_days" integer, "remaining_days" integer)
    LANGUAGE "sql"
    AS $$
  select
    lt.id,
    lt.name,
    lt.annual_entitled_days,
    coalesce(sum(
      case when lr.status = 'approved'
        then (lr.end_date - lr.start_date + 1)
        else 0
      end
    ), 0)::int as used_days,
    lt.annual_entitled_days - coalesce(sum(
      case when lr.status = 'approved'
        then (lr.end_date - lr.start_date + 1)
        else 0
      end
    ), 0)::int as remaining_days
  from leave_types lt
  left join leave_requests lr
    on lr.leave_type_id = lt.id and lr.user_id = p_user_id
  where lt.company_id = (select company_id from user_roles where user_id = p_user_id limit 1)
  group by lt.id, lt.name, lt.annual_entitled_days;
$$;


ALTER FUNCTION "public"."get_leave_balances"("p_user_id" "uuid") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."record_attendance"("p_branch_id" "uuid", "p_event_type" "text", "p_latitude" double precision, "p_longitude" double precision, "p_qr_payload" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."record_attendance"("p_branch_id" "uuid", "p_event_type" "text", "p_latitude" double precision, "p_longitude" double precision, "p_qr_payload" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


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


CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "plan" "text" DEFAULT 'trial'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."departments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "public"."departments" OWNER TO "postgres";


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
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


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
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
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


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "user_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."attendance_logs_archive"
    ADD CONSTRAINT "attendance_logs_archive_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance_logs"
    ADD CONSTRAINT "attendance_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leave_requests"
    ADD CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leave_types"
    ADD CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "company_id", "role_id");



ALTER TABLE ONLY "public"."attendance_logs"
    ADD CONSTRAINT "attendance_logs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."attendance_logs"
    ADD CONSTRAINT "attendance_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance_logs"
    ADD CONSTRAINT "attendance_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



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



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "admin_assigns_roles" ON "public"."user_roles" FOR INSERT WITH CHECK ("public"."has_any_role"("company_id", ARRAY['company_admin'::"text"]));



CREATE POLICY "admin_manages_departments" ON "public"."departments" FOR INSERT WITH CHECK ("public"."has_any_role"("company_id", ARRAY['company_admin'::"text"]));



CREATE POLICY "admin_updates_branches" ON "public"."branches" FOR UPDATE USING ("public"."has_any_role"("company_id", ARRAY['company_admin'::"text"]));



CREATE POLICY "admin_updates_departments" ON "public"."departments" FOR UPDATE USING ("public"."has_any_role"("company_id", ARRAY['company_admin'::"text"]));



ALTER TABLE "public"."attendance_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."attendance_logs_archive" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "authenticated_can_read_roles" ON "public"."roles" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."branches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."departments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leave_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leave_types" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "manager_deletes_shift_assignments" ON "public"."shift_assignments" FOR DELETE USING ("public"."has_any_role"("company_id", ARRAY['company_admin'::"text", 'store_manager'::"text", 'regional_manager'::"text"]));



CREATE POLICY "manager_updates_leave_requests" ON "public"."leave_requests" FOR UPDATE USING ("public"."has_any_role"("company_id", ARRAY['company_admin'::"text", 'store_manager'::"text", 'regional_manager'::"text"]));



CREATE POLICY "manager_updates_shift_assignments" ON "public"."shift_assignments" FOR UPDATE USING ("public"."has_any_role"("company_id", ARRAY['company_admin'::"text", 'store_manager'::"text", 'regional_manager'::"text"]));



CREATE POLICY "manager_updates_shift_templates" ON "public"."shift_templates" FOR UPDATE USING ("public"."has_any_role"("company_id", ARRAY['company_admin'::"text", 'store_manager'::"text", 'regional_manager'::"text"]));



ALTER TABLE "public"."performance_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shift_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shift_templates" ENABLE ROW LEVEL SECURITY;


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



CREATE POLICY "tenant_isolation_branches_insert" ON "public"."branches" FOR INSERT WITH CHECK (("company_id" IN ( SELECT "user_roles"."company_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_companies" ON "public"."companies" FOR SELECT USING (("id" IN ( SELECT "user_roles"."company_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_departments_select" ON "public"."departments" FOR SELECT USING (("company_id" IN ( SELECT "user_roles"."company_id"
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



CREATE POLICY "tenant_isolation_performance_insert" ON "public"."performance_scores" FOR INSERT WITH CHECK (("company_id" IN ( SELECT "user_roles"."company_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_performance_select" ON "public"."performance_scores" FOR SELECT USING (("company_id" IN ( SELECT "user_roles"."company_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_profiles" ON "public"."profiles" FOR SELECT USING (("company_id" IN ( SELECT "user_roles"."company_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_shift_assignments_insert" ON "public"."shift_assignments" FOR INSERT WITH CHECK (("company_id" IN ( SELECT "user_roles"."company_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_shift_assignments_select" ON "public"."shift_assignments" FOR SELECT USING (("company_id" IN ( SELECT "user_roles"."company_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_shift_templates_insert" ON "public"."shift_templates" FOR INSERT WITH CHECK (("company_id" IN ( SELECT "user_roles"."company_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



CREATE POLICY "tenant_isolation_shift_templates_select" ON "public"."shift_templates" FOR SELECT USING (("company_id" IN ( SELECT "user_roles"."company_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_sees_own_roles" ON "public"."user_roles" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "user_updates_own_profile" ON "public"."profiles" FOR UPDATE USING ((("id" = "auth"."uid"()) OR "public"."has_any_role"("company_id", ARRAY['company_admin'::"text"])));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";











































































































































































GRANT ALL ON FUNCTION "public"."get_leave_balances"("p_user_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."has_any_role"("p_company_id" "uuid", "p_role_codes" "text"[]) TO "authenticated";



GRANT ALL ON FUNCTION "public"."record_attendance"("p_branch_id" "uuid", "p_event_type" "text", "p_latitude" double precision, "p_longitude" double precision, "p_qr_payload" "text") TO "authenticated";
























GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."attendance_logs" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."attendance_logs" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."attendance_logs" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."attendance_logs_archive" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."attendance_logs_archive" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."attendance_logs_archive" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."branches" TO "anon";
GRANT ALL ON TABLE "public"."branches" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."branches" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."companies" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."departments" TO "anon";
GRANT ALL ON TABLE "public"."departments" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."departments" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."leave_requests" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."leave_requests" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."leave_requests" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."leave_types" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."leave_types" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."leave_types" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."performance_scores" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."performance_scores" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."performance_scores" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."roles" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."shift_assignments" TO "anon";
GRANT ALL ON TABLE "public"."shift_assignments" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."shift_assignments" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."shift_templates" TO "anon";
GRANT ALL ON TABLE "public"."shift_templates" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."shift_templates" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_roles" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";































