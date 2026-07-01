-- Kullanıcı, HERHANGİ bir şirkette super_admin rolüne sahip mi?
create or replace function is_super_admin()
returns boolean
language sql
security invoker
stable
as $$
  select exists (
    select 1 from user_roles ur
    join roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.code = 'super_admin'
  );
$$;

-- Tüm şirketleri, personel sayılarıyla birlikte listele (RLS'i bilinçli olarak atlıyor)
create or replace function get_all_companies_overview()
returns table (
  company_id uuid,
  name text,
  plan text,
  is_active boolean,
  employee_count bigint,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_super_admin() then
    raise exception 'Bu islem icin super admin yetkisi gerekiyor';
  end if;

  return query
  select c.id, c.name, c.plan, c.is_active, count(p.id), c.created_at
  from companies c
  left join profiles p on p.company_id = c.id
  group by c.id, c.name, c.plan, c.is_active, c.created_at
  order by c.created_at desc;
end;
$$;

-- Yeni şirket (kiracı) oluştur
create or replace function create_new_company(p_name text, p_plan text default 'trial')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not is_super_admin() then
    raise exception 'Bu islem icin super admin yetkisi gerekiyor';
  end if;

  insert into companies (name, plan) values (p_name, p_plan) returning id into v_id;
  return v_id;
end;
$$;

-- Şirket planını güncelle
create or replace function update_company_plan(p_company_id uuid, p_plan text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_super_admin() then
    raise exception 'Bu islem icin super admin yetkisi gerekiyor';
  end if;

  update companies set plan = p_plan where id = p_company_id;
end;
$$;

grant execute on function is_super_admin() to authenticated;
grant execute on function get_all_companies_overview() to authenticated;
grant execute on function create_new_company(text, text) to authenticated;
grant execute on function update_company_plan(uuid, text) to authenticated;

-- Test için: Admin A'ya super_admin rolü ver
insert into user_roles (user_id, company_id, role_id)
select '46714a7d-c6d2-4c24-baff-9f8f96dc0cc3'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, id
from roles where code = 'super_admin'
on conflict do nothing;