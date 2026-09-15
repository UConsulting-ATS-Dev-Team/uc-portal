-- Fix list_member_avatars() -- caught live during testing: PostgREST
-- rejected every call with "structure of query does not match function
-- result type" (auth.users.email is varchar(255), not text; the declared
-- return type was text). Same exact bug class as
-- 20260909041000_fix_list_members_email_type.sql and
-- 20260909042000_fix_member_engagement_report_email_type.sql -- an
-- explicit cast fixes it the same way.
create or replace function list_member_avatars()
returns table (member_id uuid, email text, avatar_url text)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return query
    select u.id as member_id, u.email::text, p.avatar_url
    from auth.users u
    join profiles p on p.id = u.id
    where p.avatar_url is not null;
end;
$$;
