create table attendance_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  branch_id uuid not null references branches(id),
  event_type text not null,                        -- check_in | check_out
  event_time timestamptz not null default now(),
  latitude double precision,
  longitude double precision,
  distance_from_branch_m numeric,
  is_within_geofence boolean,
  is_suspicious boolean not null default false,
  qr_payload text
);

alter table attendance_logs enable row level security;

create policy "tenant_isolation_attendance_select"
on attendance_logs for select
using (company_id in (select company_id from user_roles where user_id = auth.uid()));

create policy "tenant_isolation_attendance_insert"
on attendance_logs for insert
with check (company_id in (select company_id from user_roles where user_id = auth.uid()));

grant select, insert on attendance_logs to authenticated;