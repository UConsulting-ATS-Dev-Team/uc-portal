-- Digest-email groundwork -- direct ask, alongside the fixes/security/
-- optimizations pass. Real email sending is blocked on SES/Gavin (same
-- blocker already noted on "Request a feature" and "Notify admin on new
-- signups"), but everything up to the actual send is genuinely buildable
-- now: real computed content, stored per member per week, admin-visible
-- immediately (so the content can be sanity-checked before any email ever
-- goes out) and exactly the shape a real mailer would consume once SES
-- exists -- flipping on real sending later is "add one send call using
-- this already-computed content," not a redesign.
--
-- Content signals deliberately kept cheap, not the full odds-model/
-- matchJob() scoring algorithm -- this is a weekly summary count, not a
-- ranked list, and a fourth Deno/Node/browser mirror of the full graduated
-- match algorithm just for a digest count isn't worth it. "New matches"
-- is a simple filtered count (posted in the last 7 days, matching the
-- member's #1 ranked industry or a followed company) -- real and honest,
-- just less precise than the full scoring model shown on the Jobs board
-- itself.
create table weekly_digests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  week_of date not null,
  new_matches_count integer not null default 0,
  deadline_count integer not null default 0,
  unread_message_count integer not null default 0,
  new_feed_posts_count integer not null default 0,
  subject text not null,
  body_text text not null,
  created_at timestamptz not null default now(),
  unique (profile_id, week_of)
);
comment on table weekly_digests is 'Computed weekly digest content, one row per real member per week. Written only by the weekly-digest Edge Function (service role) -- no client insert. Real content, not yet actually emailed (blocked on SES/Gavin) -- see this migration''s own header comment.';

alter table weekly_digests enable row level security;
create policy "weekly_digests_select_own" on weekly_digests for select using (profile_id = auth.uid());
create policy "weekly_digests_select_admin" on weekly_digests for select using (is_admin());

-- Same identity-resolution shape as list_recent_signups()/
-- member_engagement_report() -- profiles has no email column and
-- auth.users isn't reachable via PostgREST directly.
create or replace function list_weekly_digest_log(max_rows integer default 100)
returns table (
  digest_id uuid,
  member_id uuid,
  display_name text,
  week_of date,
  new_matches_count integer,
  deadline_count integer,
  unread_message_count integer,
  new_feed_posts_count integer,
  subject text,
  body_text text,
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
      d.id as digest_id,
      u.id as member_id,
      coalesce(p.name, prof.full_name, u.email::text) as display_name,
      d.week_of,
      d.new_matches_count,
      d.deadline_count,
      d.unread_message_count,
      d.new_feed_posts_count,
      d.subject,
      d.body_text,
      d.created_at
    from weekly_digests d
    join profiles prof on prof.id = d.profile_id
    join auth.users u on u.id = d.profile_id
    left join people p on lower(trim(p.email)) = lower(trim(u.email))
    order by d.created_at desc
    limit max_rows;
end;
$$;

grant execute on function list_weekly_digest_log(integer) to authenticated;

-- Weekly, Monday 13:00 UTC -- distinct from every existing daily
-- ingestion/link-health schedule (13:17/14:17/15:17/etc) to avoid
-- resource contention, and early enough in the week that "deadlines this
-- week" content is still genuinely forward-looking when a member would
-- read it.
select cron.schedule(
  'weekly-digest-mondays',
  '0 13 * * 1',
  $$
  select net.http_post(
    url := 'https://cfwbtzajnaodgqilgkqn.supabase.co/functions/v1/weekly-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmd2J0emFqbmFvZGdxaWxna3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MTk3NTQsImV4cCI6MjEwNDQ5NTc1NH0.pMdJ5vEZXrBaVQqkqXJycjGVOF116hTvusYUsagSc7w'
    ),
    body := '{}'::jsonb
  );
  $$
);
