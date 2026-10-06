-- Site analytics for admins: who is using the portal and which pages they use. A page view is recorded by the app itself (a
-- row per route change while signed in), so there is no third-party tracker and nothing leaves this database. Admins read the
-- aggregates; individual rows are never shown anywhere, and an account's own events are only ever read for its "last active".

create table analytics_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete cascade,
  user_type text not null check (user_type in ('admin', 'member', 'alumni', 'intern')),
  event text not null check (event in ('page_view')),
  path text not null,
  session_id text
);
comment on table analytics_events is 'One row per signed-in page view. user_type is the account''s real type at the time (an admin viewing as someone else is still an admin).';
create index analytics_events_time_idx on analytics_events (occurred_at);
create index analytics_events_user_idx on analytics_events (user_id, occurred_at);

alter table analytics_events enable row level security;
create policy "analytics_events_insert_own" on analytics_events for insert with check (user_id = auth.uid());
create policy "analytics_events_select_admin" on analytics_events for select using (is_admin());
grant insert on analytics_events to authenticated;
grant select on analytics_events to authenticated;

-- Days are the club's own (Pacific) days, not UTC, so "yesterday" means what people expect.
create function analytics_daily(p_days integer default 30)
returns table (day date, user_type text, active_users integer, sessions integer, page_views integer)
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
      (e.occurred_at at time zone 'America/Los_Angeles')::date as day,
      e.user_type,
      count(distinct e.user_id)::integer as active_users,
      count(distinct e.session_id)::integer as sessions,
      count(*)::integer as page_views
    from analytics_events e
    where e.occurred_at >= now() - make_interval(days => p_days)
    group by 1, 2
    order by 1, 2;
end;
$$;

create function analytics_top_pages(p_days integer default 30, p_limit integer default 15)
returns table (path text, views integer, users integer)
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
    select e.path, count(*)::integer as views, count(distinct e.user_id)::integer as users
    from analytics_events e
    where e.occurred_at >= now() - make_interval(days => p_days)
    group by e.path
    order by 2 desc, 1
    limit p_limit;
end;
$$;

-- Distinct people, sessions and page views per account type over the range (the daily function can't be summed for distinct counts).
create function analytics_range_summary(p_days integer default 30)
returns table (user_type text, users integer, sessions integer, page_views integer, users_today integer)
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
      e.user_type,
      count(distinct e.user_id)::integer,
      count(distinct e.session_id)::integer,
      count(*)::integer,
      (count(distinct e.user_id) filter (
        where (e.occurred_at at time zone 'America/Los_Angeles')::date = (now() at time zone 'America/Los_Angeles')::date
      ))::integer
    from analytics_events e
    where e.occurred_at >= now() - make_interval(days => p_days)
    group by e.user_type
    order by e.user_type;
end;
$$;

-- Keep six months of raw events; the aggregates above only look back 90 days at most.
select cron.unschedule('analytics-retention') where exists (select 1 from cron.job where jobname = 'analytics-retention');
select cron.schedule('analytics-retention', '30 10 * * *', $$delete from analytics_events where occurred_at < now() - interval '180 days'$$);
