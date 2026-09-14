-- Real "recent signups" visibility for Admin Dashboard -- closes the
-- "Notify admin on new signups" quick win from the 2026-09-14 MVP-feedback
-- triage (in-app only for now; the email arm waits on SES/Gavin, same
-- blocker noted on the sibling "Request a feature" email item). No new
-- persistent notification/queue table -- profiles.created_at is already
-- the real source of truth for "when did this account get created," so
-- this is a direct real-time read each time Admin Dashboard loads, not
-- something to enqueue.
--
-- Same identity-resolution and security-definer shape as
-- member_engagement_report() (20260902110000): profiles has no email
-- column and auth.users isn't reachable via PostgREST directly, so a
-- plain client query can't produce a real display name/email on its own.
-- Reuses the exact same coalesce order (people.name via email match, then
-- profiles.full_name, then the account's own email) for the same reason
-- that function already documented -- profiles.full_name is usually empty
-- since members rarely fill in My Profile's Personal tab.
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
      coalesce(p.name, prof.full_name, u.email) as display_name,
      u.email,
      prof.created_at
    from profiles prof
    join auth.users u on u.id = prof.id
    left join people p on lower(trim(p.email)) = lower(trim(u.email))
    where prof.created_at >= now() - make_interval(days => days_back)
    order by prof.created_at desc
    limit max_rows;
end;
$$;

grant execute on function list_recent_signups(integer, integer) to authenticated;
