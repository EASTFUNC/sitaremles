do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'branches' and cmd in ('UPDATE', 'DELETE')
  loop
    execute format('drop policy if exists %I on public.branches', pol.policyname);
  end loop;
end $$;

create policy "admin_updates_branches"
on branches for update
using (has_any_role(company_id, array['company_admin']))
with check (has_any_role(company_id, array['company_admin']));

create policy "admin_deletes_branches"
on branches for delete
using (has_any_role(company_id, array['company_admin']));