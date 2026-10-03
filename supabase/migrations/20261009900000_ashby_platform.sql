-- Ashby as a third job-board platform: pipeline health, dead-board detection and the fetch schedule.
--
-- fetch-ashby-companies (new Edge Function) reads Ashby's public Job Posting API for every source whose
-- config.platform is 'ashby'. This migration makes the rest of the system treat it like Greenhouse:
--  * Admin > Pipeline health reports Ashby coverage (companies fetched in the last 26h, stale under 90%).
--  * list_dead_sources()/disable_dead_source() also consider Ashby boards (three straight HTTP 404s).
--  * A batched schedule: the 14 stalest Ashby companies every 2 hours, offset from Greenhouse's :17 run.
-- check_cron_health() is otherwise unchanged from 20261008400000 and is dropped and recreated with it.
drop function if exists check_cron_health();

create function check_cron_health()
returns table (
  job_key text,
  label text,
  cadence text,
  last_run_at timestamptz,
  last_run_status text,
  last_run_total integer,
  last_run_failed integer,
  is_stale boolean,
  window_hours integer,
  coverage_total integer,
  coverage_fresh integer
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
  with tagged as (
    select 'greenhouse'::text as job_key, sfl.completed_at, sfl.status
    from source_fetch_log sfl join sources s on s.id = sfl.source_id
    where s.type = 'employer_api' and s.config->>'platform' = 'greenhouse'
    union all
    select 'lever', sfl.completed_at, sfl.status
    from source_fetch_log sfl join sources s on s.id = sfl.source_id
    where s.type = 'employer_api' and s.config->>'platform' = 'lever'
    union all
    select 'ashby', sfl.completed_at, sfl.status
    from source_fetch_log sfl join sources s on s.id = sfl.source_id
    where s.type = 'employer_api' and s.config->>'platform' = 'ashby'
    union all
    select 'deloitte', sfl.completed_at, sfl.status
    from source_fetch_log sfl join sources s on s.id = sfl.source_id
    where s.name = 'Deloitte (Careers RSS Feed)'
    union all
    select 'link_health', sfl.completed_at, sfl.status
    from source_fetch_log sfl join sources s on s.id = sfl.source_id
    where s.name = 'Link Health Checker'
    union all
    select 'snapshot', sfl.completed_at, sfl.status
    from source_fetch_log sfl join sources s on s.id = sfl.source_id
    where s.name = 'Job Board Snapshot'
    union all
    select 'weekly_digest', sfl.completed_at, sfl.status
    from source_fetch_log sfl join sources s on s.id = sfl.source_id
    where s.name = 'Weekly Digest'
  ),
  jobs (job_key, label, cadence, stale_after_hours, window_h) as (
    values
      ('greenhouse', 'Greenhouse companies', 'every 2h, in batches', 26, 24),
      ('lever', 'Lever companies', 'daily', 26, 24),
      ('ashby', 'Ashby companies', 'every 2h, in batches', 26, 24),
      ('deloitte', 'Deloitte (RSS)', 'daily', 26, 0),
      ('link_health', 'Link health check', 'daily', 26, 0),
      ('snapshot', 'Job board snapshot', 'daily', 26, 0),
      ('weekly_digest', 'Weekly digest', 'weekly', 192, 0)
  ),
  last_run as (
    select t.job_key, max(t.completed_at) as last_run_at
    from tagged t group by t.job_key
  ),
  -- Unbatched adapters: every row within 15 minutes of the adapter's newest one is "this run".
  -- Batched adapters: every row in the trailing window_h hours.
  batch as (
    select
      t.job_key,
      count(*)::integer as total,
      count(*) filter (where t.status = 'failed')::integer as failed,
      (array_agg(t.status order by t.completed_at desc))[1] as last_status
    from tagged t
    join last_run lr on lr.job_key = t.job_key
    join jobs j on j.job_key = t.job_key
    where case when j.window_h > 0
               then t.completed_at >= now() - make_interval(hours => j.window_h)
               else t.completed_at >= lr.last_run_at - interval '15 minutes' end
    group by t.job_key
  ),
  coverage as (
    select p.platform as job_key,
      (select count(*) from sources s where s.type = 'employer_api' and s.enabled and s.config->>'platform' = p.platform)::integer as total,
      (select count(*) from sources s where s.type = 'employer_api' and s.enabled and s.config->>'platform' = p.platform
         and exists (select 1 from source_fetch_log l where l.source_id = s.id and l.status = 'success'
                     and l.completed_at >= now() - interval '26 hours'))::integer as fresh
    from (values ('greenhouse'), ('lever'), ('ashby')) as p(platform)
  )
  select
    j.job_key,
    j.label,
    j.cadence,
    lr.last_run_at,
    b.last_status,
    coalesce(b.total, 0),
    coalesce(b.failed, 0),
    case when c.total is not null
         then (lr.last_run_at is null or c.fresh < ceil(c.total * 0.9))
         else (lr.last_run_at is null or lr.last_run_at < now() - make_interval(hours => j.stale_after_hours::integer))
    end as is_stale,
    j.window_h::integer,
    c.total,
    c.fresh
  from jobs j
  left join last_run lr on lr.job_key = j.job_key
  left join batch b on b.job_key = j.job_key
  left join coverage c on c.job_key = j.job_key
  order by j.job_key;
end;
$$;

grant execute on function check_cron_health() to authenticated;

create or replace function list_dead_sources()
returns table (
  source_id uuid,
  name text,
  platform text,
  slug text,
  consecutive_404s integer,
  last_failed_at timestamptz,
  active_jobs integer
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
  with recent as (
    select l.source_id, l.status, l.summary, l.completed_at,
           row_number() over (partition by l.source_id order by l.completed_at desc) as rn
    from source_fetch_log l
    join sources s on s.id = l.source_id
    where s.type = 'employer_api' and s.enabled and s.config->>'platform' in ('greenhouse', 'lever', 'ashby')
  ),
  dead as (
    select r.source_id, max(r.completed_at) as last_failed_at
    from recent r
    where r.rn <= 3
    group by r.source_id
    having count(*) = 3
       and bool_and(r.status = 'failed' and coalesce(r.summary->>'error', '') like '%HTTP 404%')
  )
  select s.id, s.name::text, (s.config->>'platform')::text, (s.config->>'slug')::text, 3, d.last_failed_at,
    (select count(*)::integer from job_sources js join jobs j on j.id = js.job_id where js.source_id = s.id and j.active)
  from dead d join sources s on s.id = d.source_id
  order by d.last_failed_at desc;
end;
$$;

grant execute on function list_dead_sources() to authenticated;

create or replace function disable_dead_source(p_source_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired integer;
begin
  if not is_admin() then
    raise exception 'admin access required';
  end if;
  if not exists (select 1 from list_dead_sources() d where d.source_id = p_source_id) then
    raise exception 'This source is not flagged as dead (its last 3 fetches must all have failed with HTTP 404).';
  end if;

  -- Expire only the jobs this source alone tracks; a job also attached to a live source stays.
  update jobs j
     set active = false, status = 'expired', updated_at = now()
   where j.active
     and exists (select 1 from job_sources js where js.job_id = j.id and js.source_id = p_source_id)
     and not exists (select 1 from job_sources js2 where js2.job_id = j.id and js2.source_id <> p_source_id);
  get diagnostics expired = row_count;

  update sources set enabled = false where id = p_source_id;
  return expired;
end;
$$;

grant execute on function disable_dead_source(uuid) to authenticated;


-- Every 2 hours at :47, the 14 least-recently-fetched Ashby companies. Same auth as the other scheduled
-- functions: the cron secret comes from Vault by name, the anon key is the public one in every earlier cron
-- migration. oldest_fetched_sources() is platform-generic.
select cron.schedule(
  'fetch-ashby-companies-batch',
  '47 */2 * * *',
  $$
  select net.http_post(
    url := 'https://cfwbtzajnaodgqilgkqn.supabase.co/functions/v1/fetch-ashby-companies',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmd2J0emFqbmFvZGdxaWxna3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MTk3NTQsImV4cCI6MjEwNDQ5NTc1NH0.pMdJ5vEZXrBaVQqkqXJycjGVOF116hTvusYUsagSc7w',
      'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{"batch": 14}'::jsonb
  );
  $$
);
