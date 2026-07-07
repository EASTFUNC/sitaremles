-- EASTFUNC'in kendi ic hesabi icin ayri bir "sirket" satiri
-- (gercek bir musteri degil, sadece super admin hesabini baglamak icin bir capa)
insert into companies (name, plan, is_active)
select 'EASTFUNC (İç Hesap)', 'internal', true
where not exists (select 1 from companies where name = 'EASTFUNC (İç Hesap)');

-- Admin A'dan super_admin yetkisini kaldiriyoruz - o artik sadece
-- Test Sirketi A'nin sahibi (company_admin), baska hicbir sirketi goremeyecek
delete from user_roles
where user_id = '46714a7d-c6d2-4c24-baff-9f8f96dc0cc3'
  and role_id = (select id from roles where code = 'super_admin');