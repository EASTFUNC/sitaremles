create table performance_scores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  period text not null,              -- '2026-07' gibi (yıl-ay)
  score numeric,
  bonus_amount numeric,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table performance_scores enable row level security;

create policy "tenant_isolation_performance_select"
on performance_scores for select
using (company_id in (select company_id from user_roles where user_id = auth.uid()));

create policy "tenant_isolation_performance_insert"
on performance_scores for insert
with check (company_id in (select company_id from user_roles where user_id = auth.uid()));

grant select, insert on performance_scores to authenticated;