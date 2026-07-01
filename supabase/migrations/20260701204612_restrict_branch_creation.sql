drop policy if exists "tenant_isolation_branches_insert" on branches;

create policy "manager_creates_branches"
on branches for insert
with check (has_any_role(company_id, array['company_admin', 'store_manager', 'regional_manager']));