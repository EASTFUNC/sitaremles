create table notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  body text,
  type text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;

create policy "user_sees_own_notifications"
on notifications for select
using (user_id = auth.uid());

create policy "user_marks_own_notifications_read"
on notifications for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant select, update on notifications to authenticated;
-- Not: 'insert' iznini authenticated'a vermiyoruz.
-- Bildirimler sadece aşağıdaki güvenli tetikleyici fonksiyonlar tarafından oluşturulacak.

-- İzin talebi onaylandı/reddedildi
create or replace function notify_leave_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status and new.status in ('approved','rejected') then
    insert into notifications (company_id, user_id, title, body, type)
    values (
      new.company_id,
      new.user_id,
      case when new.status = 'approved' then 'İzin talebiniz onaylandı' else 'İzin talebiniz reddedildi' end,
      new.start_date || ' - ' || new.end_date,
      'leave_status'
    );
  end if;
  return new;
end;
$$;

create trigger trg_notify_leave_status
after update on leave_requests
for each row execute function notify_leave_status_change();

-- Yeni görev atandığında
create or replace function notify_task_assigned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (company_id, user_id, title, body, type)
  select new.company_id, new.assigned_to, 'Yeni görev atandı',
    (select title from checklist_templates where id = new.checklist_template_id),
    'task_assigned';
  return new;
end;
$$;

create trigger trg_notify_task_assigned
after insert on task_assignments
for each row execute function notify_task_assigned();

-- Avans/masraf onaylandı/reddedildi
create or replace function notify_expense_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status and new.status in ('approved','rejected') then
    insert into notifications (company_id, user_id, title, body, type)
    values (
      new.company_id,
      new.user_id,
      case when new.status = 'approved' then 'Avans/masraf talebiniz onaylandı' else 'Avans/masraf talebiniz reddedildi' end,
      new.amount || ' ₺ - ' || coalesce(new.description, ''),
      'expense_status'
    );
  end if;
  return new;
end;
$$;

create trigger trg_notify_expense_status
after update on expense_requests
for each row execute function notify_expense_status_change();

-- Yeni bordro dönemi oluşturulduğunda
create or replace function notify_payroll_ready()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (company_id, user_id, title, body, type)
  values (new.company_id, new.user_id, 'Bordronuz onayınızı bekliyor', new.period, 'payroll_ready');
  return new;
end;
$$;

create trigger trg_notify_payroll_ready
after insert on payroll_approvals
for each row execute function notify_payroll_ready();