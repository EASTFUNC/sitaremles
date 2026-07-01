-- ====== KURAL TABANLI ANOMALİ TESPİTİ ======
-- Sadece yönetici/müdür rolündeki kullanıcılar çağırabilir (has_any_role ile korunuyor)
create or replace function flag_suspicious_attendance(p_company_id uuid)
returns int
language plpgsql
security invoker
as $$
declare
  v_count int;
begin
  if not has_any_role(p_company_id, array['company_admin', 'store_manager', 'regional_manager']) then
    raise exception 'Bu islem icin yetkiniz yok';
  end if;

  -- Kural 1: Şube dışından (geofence dışı) girişler
  update attendance_logs
  set is_suspicious = true
  where company_id = p_company_id
    and is_within_geofence = false
    and is_suspicious = false;

  -- Kural 2: Aynı kullanıcının, aynı şubede, 3 dakikadan kısa arayla
  -- art arda check_in yapması (QR'ın kopyalanıp tekrar kullanılması ihtimali)
  update attendance_logs a
  set is_suspicious = true
  where a.company_id = p_company_id
    and a.event_type = 'check_in'
    and a.is_suspicious = false
    and exists (
      select 1 from attendance_logs b
      where b.user_id = a.user_id
        and b.branch_id = a.branch_id
        and b.event_type = 'check_in'
        and b.id <> a.id
        and abs(extract(epoch from (a.event_time - b.event_time))) < 180
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function flag_suspicious_attendance(uuid) to authenticated;