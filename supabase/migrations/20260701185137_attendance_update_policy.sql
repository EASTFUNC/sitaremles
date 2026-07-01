create policy "manager_flags_suspicious_attendance"
on attendance_logs for update
using (has_any_role(company_id, array['company_admin', 'store_manager', 'regional_manager']));