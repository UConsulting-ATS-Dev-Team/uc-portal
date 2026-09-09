-- Same real bug as 20260909041000's list_members() fix, caught live on
-- Admin Dashboard's Member engagement section immediately after: "structure
-- of query does not match function result type". auth.users.email is
-- character varying, not text -- plpgsql's returns table requires an exact
-- type match. This function had the identical issue in two places (the
-- bare `u.email` return column, and the coalesce() computing display_name,
-- which also resolves to varchar when u.email is its result).
create or replace function member_engagement_report(inactive_threshold_days integer default 14)
returns table (
  member_id uuid,
  display_name text,
  email text,
  last_active_at timestamptz,
  days_inactive integer,
  is_disengaged boolean
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
      coalesce(p.name, prof.full_name, u.email)::text as display_name,
      u.email::text as email,
      la.last_active_at,
      case when la.last_active_at is null then null
           else (extract(day from now() - la.last_active_at))::integer
      end as days_inactive,
      coalesce(la.last_active_at < now() - make_interval(days => inactive_threshold_days), true) as is_disengaged
    from auth.users u
    left join profiles prof on prof.id = u.id
    left join people p on lower(trim(p.email)) = lower(trim(u.email))
    left join lateral (
      select greatest(
        u.last_sign_in_at,
        (select max(mp.updated_at) from member_preferences mp where mp.id = u.id),
        (select max(ta.updated_at) from tracked_applications ta where ta.member_id = u.id),
        (select max(sj.saved_at) from saved_jobs sj where sj.member_id = u.id),
        (select max(nc.updated_at) from network_connections nc where nc.member_id = u.id)
      ) as last_active_at
    ) la on true
    order by la.last_active_at asc nulls first;
end;
$$;
