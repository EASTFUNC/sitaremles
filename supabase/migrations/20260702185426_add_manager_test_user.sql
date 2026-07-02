insert into profiles (id, company_id, branch_id, full_name)
values ('6299b2ad-59be-42f4-93b9-92967df98ff9'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, 'Müdür A');

insert into user_roles (user_id, company_id, role_id)
select '6299b2ad-59be-42f4-93b9-92967df98ff9'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, id
from roles where code = 'store_manager';