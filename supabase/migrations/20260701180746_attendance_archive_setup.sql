-- ====== ARŞİV TABLOSU: eski kayıtların taşınacağı yer ======
create table attendance_logs_archive (
  like attendance_logs including all
);

alter table attendance_logs_archive enable row level security;

create policy "tenant_isolation_attendance_archive_select"
on attendance_logs_archive for select
using (company_id in (select company_id from user_roles where user_id = auth.uid()));

grant select on attendance_logs_archive to authenticated;

-- ====== ARŞİVLEME FONKSİYONU ======
-- 90 günden eski attendance_logs kayıtlarını arşive taşır, ana tablodan siler.
-- security definer: RLS'i atlayarak tüm şirketlerin eski verisini tek seferde işleyebilsin
-- (bu fonksiyon sadece cron/admin tarafından tetiklenecek, kullanıcıya açık değil)
create or replace function archive_old_attendance_logs()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  with moved as (
    delete from attendance_logs
    where event_time < now() - interval '90 days'
    returning *
  )
  insert into attendance_logs_archive
  select * from moved;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ÖNEMLİ: Bu fonksiyonu normal kullanıcılara AÇMIYORUZ (grant execute vermiyoruz),
-- sadece Supabase'in kendi postgres/service_role yetkisiyle veya pg_cron ile çalışacak.

-- ====== ZAMANLANMIŞ GÖREV: her ayın 1'inde gece yarısı çalışır ======
-- NOT: Şu an devre dışı bırakıyoruz (schedule'ı yorum satırı yaptık) çünkü
-- test verimiz çok az; gerçek veri birikince Bölüm 6'daki gibi elle aktif edeceğiz.
-- select cron.schedule(
--   'archive-attendance-monthly',
--   '0 0 1 * *',
--   $$select archive_old_attendance_logs();$$
-- );