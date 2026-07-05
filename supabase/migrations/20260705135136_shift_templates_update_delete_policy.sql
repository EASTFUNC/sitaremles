do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'shift_templates' and cmd in ('UPDATE', 'DELETE')
  loop
    execute format('drop policy if exists %I on public.shift_templates', pol.policyname);
  end loop;
end $$;

create policy "admin_updates_shift_templates"
on shift_templates for update
using (has_any_role(company_id, array['company_admin']))
with check (has_any_role(company_id, array['company_admin']));

create policy "admin_deletes_shift_templates"
on shift_templates for delete
using (has_any_role(company_id, array['company_admin']));