insert into profiles (id, company_id, full_name)
values ('1730600f-3541-4f5c-9046-aecec246d6a4'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'Calisan A');

insert into user_roles (user_id, company_id, role_id)
select '1730600f-3541-4f5c-9046-aecec246d6a4'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, id
from roles where code = 'employee';