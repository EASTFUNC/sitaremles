create or replace function validate_tc_kimlik(p_tc text)
returns boolean
language plpgsql
immutable
as $$
declare
  d int[];
  i int;
  odd_sum int := 0;
  even_sum int := 0;
  total_sum int := 0;
begin
  if p_tc !~ '^[1-9][0-9]{10}$' then
    return false;
  end if;
  for i in 1..11 loop
    d[i] := substring(p_tc from i for 1)::int;
  end loop;
  odd_sum := d[1]+d[3]+d[5]+d[7]+d[9];
  even_sum := d[2]+d[4]+d[6]+d[8];
  if ((odd_sum * 7 - even_sum) % 10) <> d[10] then
    return false;
  end if;
  for i in 1..10 loop
    total_sum := total_sum + d[i];
  end loop;
  return (total_sum % 10) = d[11];
end;
$$;

create table employee_legal_details (
  user_id uuid primary key references profiles(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  tc_kimlik_no text not null,
  birth_date date,
  address text,
  contract_type text not null default 'belirsiz_sureli',
  hire_date date not null default current_date,
  blood_type text,
  emergency_contact_name text,
  emergency_contact_phone text,
  created_at timestamptz not null default now(),
  constraint tc_kimlik_format check (tc_kimlik_no ~ '^[1-9][0-9]{10}$'),
  constraint tc_kimlik_valid check (validate_tc_kimlik(tc_kimlik_no))
);

alter table employee_legal_details enable row level security;

create policy "only_admin_manages_legal_details"
on employee_legal_details for all
using (has_any_role(company_id, array['company_admin']))
with check (has_any_role(company_id, array['company_admin']));

grant select, insert, update on employee_legal_details to authenticated;