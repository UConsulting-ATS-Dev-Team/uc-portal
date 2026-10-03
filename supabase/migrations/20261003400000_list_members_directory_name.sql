-- list_members() showed the account's email as its name whenever
-- profiles.full_name was empty -- which is every pre-created account and most
-- accounts that never opened My Profile -- so Admin > Members (and the
-- accelerator pages, which resolve names through this function) listed raw
-- emails in the Name column. Prefer the real directory name first, the same
-- fallback chain list_messageable_members() already uses, then the email.
-- The lateral limit 1 keeps a duplicated directory email from multiplying rows.
create or replace function list_members()
returns table (
  member_id uuid,
  display_name text,
  email text,
  role member_role,
  member_status text,
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
      coalesce(nullif(p.full_name, ''), pe.name, u.email)::text as display_name,
      u.email::text as email,
      p.role,
      p.member_status,
      u.created_at
    from auth.users u
    join profiles p on p.id = u.id
    left join lateral (
      select d.name
      from people d
      where lower(trim(d.email)) = lower(trim(u.email))
      order by d.created_at asc
      limit 1
    ) pe on true
    order by u.created_at asc;
end;
$$;
grant execute on function list_members() to authenticated;
