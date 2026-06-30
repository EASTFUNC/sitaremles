create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'trial',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table branches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  latitude double precision,
  longitude double precision,
  geofence_radius_meters int not null default 100,
  is_active boolean not null default true
);

create table departments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  branch_id uuid references branches(id),
  department_id uuid references departments(id),
  full_name text not null,
  employee_code text,
  phone text,
  hire_date date,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table roles (
  id uuid primary key default gen_random_uuid(),
  code text unique not null
);

create table user_roles (
  user_id uuid not null references profiles(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  role_id uuid not null references roles(id),
  primary key (user_id, company_id, role_id)
);

insert into roles (code) values
  ('super_admin'), ('company_admin'), ('regional_manager'), ('store_manager'), ('employee');