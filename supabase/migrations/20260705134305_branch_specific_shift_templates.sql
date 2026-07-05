alter table shift_templates add column branch_id uuid references branches(id) on delete cascade;
alter table shift_templates add column color text not null default '#4A90E2';

comment on column shift_templates.branch_id is 'NULL ise tum subeler icin gecerli (orn. OFF), doluysa sadece o subeye ozel';