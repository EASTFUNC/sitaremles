create table checklist_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  title text not null
);

create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_template_id uuid not null references checklist_templates(id) on delete cascade,
  label text not null,
  sort_order int not null default 0
);

create table task_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  checklist_template_id uuid not null references checklist_templates(id),
  branch_id uuid not null references branches(id),
  assigned_to uuid not null references profiles(id) on delete cascade,
  due_date date,
  status text not null default 'pending',    -- pending | in_progress | completed
  created_at timestamptz not null default now()
);

create table task_item_results (
  id uuid primary key default gen_random_uuid(),
  task_assignment_id uuid not null references task_assignments(id) on delete cascade,
  checklist_item_id uuid not null references checklist_items(id),
  is_checked boolean not null default false,
  note text
);

alter table checklist_templates enable row level security;
alter table checklist_items enable row level security;
alter table task_assignments enable row level security;
alter table task_item_results enable row level security;

create policy "tenant_isolation_checklist_templates_select"
on checklist_templates for select
using (company_id in (select company_id from user_roles where user_id = auth.uid()));

create policy "manager_manages_checklist_templates"
on checklist_templates for insert
with check (has_any_role(company_id, array['company_admin', 'store_manager', 'regional_manager']));

create policy "tenant_isolation_checklist_items_select"
on checklist_items for select
using (checklist_template_id in (
  select id from checklist_templates where company_id in (select company_id from user_roles where user_id = auth.uid())
));

create policy "manager_manages_checklist_items"
on checklist_items for insert
with check (checklist_template_id in (
  select id from checklist_templates where has_any_role(company_id, array['company_admin', 'store_manager', 'regional_manager'])
));

create policy "tenant_isolation_task_assignments_select"
on task_assignments for select
using (company_id in (select company_id from user_roles where user_id = auth.uid()));

create policy "manager_creates_task_assignments"
on task_assignments for insert
with check (has_any_role(company_id, array['company_admin', 'store_manager', 'regional_manager']));

create policy "assignee_updates_task_status"
on task_assignments for update
using (assigned_to = auth.uid() or has_any_role(company_id, array['company_admin', 'store_manager', 'regional_manager']));

create policy "tenant_isolation_task_results_select"
on task_item_results for select
using (task_assignment_id in (
  select id from task_assignments where company_id in (select company_id from user_roles where user_id = auth.uid())
));

create policy "assignee_manages_task_results"
on task_item_results for insert
with check (task_assignment_id in (select id from task_assignments where assigned_to = auth.uid()));

create policy "assignee_updates_task_results"
on task_item_results for update
using (task_assignment_id in (select id from task_assignments where assigned_to = auth.uid()));

grant select, insert, update on checklist_templates, checklist_items, task_assignments, task_item_results to authenticated;

-- Test verisi: basit bir checklist şablonu
insert into checklist_templates (id, company_id, title) values
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Günlük Mağaza Açılış Kontrolü');

insert into checklist_items (checklist_template_id, label, sort_order) values
  ('44444444-4444-4444-4444-444444444444', 'Vitrin düzeni kontrol edildi', 1),
  ('44444444-4444-4444-4444-444444444444', 'Kasa açılış sayımı yapıldı', 2),
  ('44444444-4444-4444-4444-444444444444', 'Aydınlatma ve klima çalışıyor', 3);