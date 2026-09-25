-- Real bug, caught live while verifying an unrelated feature (the weekly
-- digest admin preview) -- Admin Dashboard's "Recent signups" card was
-- showing "structure of query does not match function result type"
-- instead of real signups. Same exact bug class this project has already
-- hit and fixed three times (list_member_avatars, list_members,
-- member_engagement_report): auth.users.email is varchar(255), not text,
-- and this function's return signature declares `email text` while
-- selecting u.email directly -- Postgres's plpgsql RETURN QUERY requires
-- an exact type match, not just an implicitly-castable one.
create or replace function list_recent_signups(days_back integer default 14, max_rows integer default 25)
returns table (
  member_id uuid,
  display_name text,
  email text,
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
      coalesce(p.name, prof.full_name, u.email::text) as display_name,
      u.email::text,
      prof.created_at
    from profiles prof
    join auth.users u on u.id = prof.id
    left join people p on lower(trim(p.email)) = lower(trim(u.email))
    where prof.created_at >= now() - make_interval(days => days_back)
    order by prof.created_at desc
    limit max_rows;
end;
$$;
