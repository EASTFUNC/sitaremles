insert into profiles (id, company_id, full_name)
select 'c1758794-61d9-40ca-a33d-cfa288365a0b'::uuid, c.id, 'EASTFUNC Yönetim'
from companies c where c.name = 'EASTFUNC (İç Hesap)'
on conflict (id) do update set company_id = excluded.company_id, full_name = excluded.full_name;

insert into user_roles (user_id, company_id, role_id)
select 'c1758794-61d9-40ca-a33d-cfa288365a0b'::uuid, c.id, r.id
from companies c, roles r
where c.name = 'EASTFUNC (İç Hesap)' and r.code = 'super_admin'
on conflict do nothing;