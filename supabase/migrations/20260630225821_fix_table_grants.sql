grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on companies, branches, departments, profiles, roles, user_roles
  to authenticated;
grant select on roles to anon;