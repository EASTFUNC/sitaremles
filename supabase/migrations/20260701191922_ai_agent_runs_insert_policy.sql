create policy "tenant_isolation_ai_runs_insert"
on ai_agent_runs for insert
with check (company_id in (select company_id from user_roles where user_id = auth.uid()));