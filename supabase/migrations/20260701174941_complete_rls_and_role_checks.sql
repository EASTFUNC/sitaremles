-- ====== YARDIMCI FONKSİYON: Kullanıcı bu şirkette belirtilen rollerden birine sahip mi? ======
create or replace function has_any_role(p_company_id uuid, p_role_codes text[])
returns boolean
language sql
security invoker
stable
as $$
  select exists (
    select 1
    from user_roles ur
    join roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and ur.company_id = p_company_id
      and r.code = any(p_role_codes)
  );
$$;

-- ====== EKSİK KALAN RLS: departments ======
alter table departments enable row level security;

create policy "tenant_isolation_departments_select"
on departments for select
using (company_id in (select company_id from user_roles where user_id = auth.uid()));

create policy "admin_manages_departments"
on departments for insert
with check (has_any_role(company_id, array['company_admin']));

create policy "admin_updates_departments"
on departments for update
using (has_any_role(company_id, array['company_admin']));

-- ====== EKSİK KALAN RLS: roles (herkese okunabilir referans tablosu, yazma yasak) ======
alter table roles enable row level security;

create policy "authenticated_can_read_roles"
on roles for select
using (auth.role() = 'authenticated');

-- ====== profiles: güncelleme yetkisi ======
create policy "user_updates_own_profile"
on profiles for update
using (id = auth.uid() or has_any_role(company_id, array['company_admin']));

-- ====== user_roles: sadece yönetici yeni rol atayabilir ======
create policy "admin_assigns_roles"
on user_roles for insert
with check (has_any_role(company_id, array['company_admin']));

-- ====== branches: güncelleme yetkisi sadece admin ======
create policy "admin_updates_branches"
on branches for update
using (has_any_role(company_id, array['company_admin']));

-- ====== shift_templates / shift_assignments: güncelleme-silme yetkisi yönetici/müdür ======
create policy "manager_updates_shift_templates"
on shift_templates for update
using (has_any_role(company_id, array['company_admin', 'store_manager', 'regional_manager']));

create policy "manager_updates_shift_assignments"
on shift_assignments for update
using (has_any_role(company_id, array['company_admin', 'store_manager', 'regional_manager']));

create policy "manager_deletes_shift_assignments"
on shift_assignments for delete
using (has_any_role(company_id, array['company_admin', 'store_manager', 'regional_manager']));

-- ====== leave_requests: mevcut geniş "update" politikasını daralt ======
-- (Gün 11'de herkes güncelleyebiliyordu; şimdi sadece yöneticiler onay/red verebilsin)
drop policy if exists "tenant_isolation_leave_requests_update" on leave_requests;

create policy "manager_updates_leave_requests"
on leave_requests for update
using (has_any_role(company_id, array['company_admin', 'store_manager', 'regional_manager']));

grant execute on function has_any_role(uuid, text[]) to authenticated;