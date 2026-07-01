create table expense_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  request_type text not null,          -- advance (avans) | expense (masraf)
  amount numeric not null,
  description text,
  receipt_url text,
  status text not null default 'pending',
  approved_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table expense_requests enable row level security;

create policy "tenant_isolation_expense_select"
on expense_requests for select
using (company_id in (select company_id from user_roles where user_id = auth.uid()));

create policy "tenant_isolation_expense_insert"
on expense_requests for insert
with check (
  company_id in (select company_id from user_roles where user_id = auth.uid())
  and user_id = auth.uid()
);

create policy "manager_updates_expense"
on expense_requests for update
using (has_any_role(company_id, array['company_admin', 'store_manager', 'regional_manager']));

grant select, insert, update on expense_requests to authenticated;