create or replace function get_store_display_user_ids(p_company_id uuid)
returns table (user_id uuid)
language sql
security definer
set search_path = public
as $$
  select ur.user_id
  from user_roles ur
  join roles r on r.id = ur.role_id
  where ur.company_id = p_company_id and r.code = 'store_display';
$$;

grant execute on function get_store_display_user_ids(uuid) to authenticated;