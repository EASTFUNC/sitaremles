do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'branches' and cmd = 'INSERT'
  loop
    execute format('drop policy if exists %I on public.branches', pol.policyname);
  end loop;
end $$;

create policy "only_admin_creates_branches"
on branches for insert
with check (has_any_role(company_id, array['company_admin']));