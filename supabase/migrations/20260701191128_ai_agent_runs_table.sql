create table ai_agent_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  agent_name text not null,
  status text not null,
  summary text,
  created_at timestamptz not null default now()
);

alter table ai_agent_runs enable row level security;

create policy "tenant_isolation_ai_runs_select"
on ai_agent_runs for select
using (company_id in (select company_id from user_roles where user_id = auth.uid()));

grant select, insert on ai_agent_runs to authenticated;