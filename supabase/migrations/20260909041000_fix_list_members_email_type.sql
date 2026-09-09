-- Fixes a real bug caught live immediately after deploying list_members():
-- "structure of query does not match function result type". auth.users.email
-- is character varying, not text -- plpgsql's returns table requires an
-- exact type match, not just an implicit-castable one, so the declared
-- `email text` column needs an explicit cast in the select.
create or replace function list_members()
returns table (
  member_id uuid,
  display_name text,
  email text,
  role member_role,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not is_admin() then
    raise exception 'admin access required';
  end if;

  return query
    select
      u.id as member_id,
      coalesce(nullif(p.full_name, ''), u.email)::text as display_name,
      u.email::text as email,
      p.role,
      u.created_at
    from auth.users u
    join profiles p on p.id = u.id
    order by u.created_at asc;
end;
$$;
