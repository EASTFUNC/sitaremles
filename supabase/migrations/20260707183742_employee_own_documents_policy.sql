create policy "employee_manages_own_documents"
on employee_documents for all
using (user_id = auth.uid())
with check (user_id = auth.uid());