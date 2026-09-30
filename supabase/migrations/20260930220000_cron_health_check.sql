-- Real cron-failure alerting -- direct ask, alongside the cron-secret fix
-- and self-service account deletion. This club runs entirely on
-- unattended pg_cron jobs (5 daily ingestion/maintenance adapters + the
-- weekly digest); a silent failure in any of them is invisible until
-- someone happens to notice stale data, the exact "small, rotating
-- student team" maintenance risk source_fetch_log's own original
-- migration (20260823100000) already named for a single adapter -- now
-- generalized across all 6.
--
-- Deliberately reuses source_fetch_log, which 5 of the 6 scheduled
-- functions already write their real per-run outcome to (see each
-- function's own insert), rather than trying to infer success from
-- cron.job_run_details/net._http_response -- investigated both directly
-- first: cron.job_run_details.status only ever reflects whether the SQL
-- statement (net.http_post, which just *queues* an async request) ran
-- without error -- it reads "succeeded" even when the destination Edge
-- Function itself later returns a 401/500, so it can't detect a real
-- functional failure. net._http_response has the real HTTP status code,
-- but pg_cron's own return_message never surfaces the request id needed
-- to join it back to a specific run (confirmed live: return_message is
-- always the generic "1 row", not the scalar value) -- correlating by
-- timestamp proximity alone would be fragile. source_fetch_log's
-- application-level status ('success'/'failed'/'skipped') is what these
-- functions already compute for their own real internal logic, so it's
-- the more meaningful signal and needs no new correlation.
--
-- weekly-digest was the one function with no source_fetch_log entry --
-- fixed in the same commit as this migration (see that function's own
-- updated header comment) by giving it a purpose-only "Weekly Digest"
-- sources row to log against, same convention already used for the two
-- non-job-ingestion adapters (Link Health Checker, Job Board Snapshot).

insert into sources (
  name, type, authorization_status, api_available, storage_restrictions, notes
) values (
  'Weekly Digest',
  'system',
  'approved',
  true,
  null,
  'Not a job-listing source -- never contributes a job record. Scheduled weekly (Mondays, weekly-digest) to compute real per-member digest content. Reuses this registry only for source_fetch_log run history, same as Link Health Checker and Job Board Snapshot.'
);

-- Greenhouse/Lever are identified the same way fetch-greenhouse-companies/
-- fetch-lever-companies already select "their own" sources
-- (type='employer_api' and config->>'platform'), not by name-matching --
-- each real run logs one source_fetch_log row per company, so this
-- groups ~150+ per-company rows back into one adapter-level signal.
-- Deloitte/Link Health Checker/Job Board Snapshot/Weekly Digest are each
-- a single dedicated sources row, matched by the exact name their own
-- function already looks itself up by.
create or replace function check_cron_health()
returns table (
  job_key text,
  label text,
  cadence text,
  last_run_at timestamptz,
  last_run_status text,
  last_run_total integer,
  last_run_failed integer,
  is_stale boolean
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
    from source_fetch_log sfl
    join sources s on s.id = sfl.source_id
    where s.type = 'employer_api' and s.config->>'platform' = 'greenhouse'
    union all
    select 'lever', sfl.completed_at, sfl.status
    from source_fetch_log sfl
    join sources s on s.id = sfl.source_id
    where s.type = 'employer_api' and s.config->>'platform' = 'lever'
    union all
    select 'deloitte', sfl.completed_at, sfl.status
    from source_fetch_log sfl
    join sources s on s.id = sfl.source_id
    where s.name = 'Deloitte (Careers RSS Feed)'
    union all
    select 'link_health', sfl.completed_at, sfl.status
    from source_fetch_log sfl
    join sources s on s.id = sfl.source_id
    where s.name = 'Link Health Checker'
    union all
    select 'snapshot', sfl.completed_at, sfl.status
    from source_fetch_log sfl
    join sources s on s.id = sfl.source_id
    where s.name = 'Job Board Snapshot'
    union all
    select 'weekly_digest', sfl.completed_at, sfl.status
    from source_fetch_log sfl
    join sources s on s.id = sfl.source_id
    where s.name = 'Weekly Digest'
  ),
  last_run as (
    select t.job_key, max(t.completed_at) as last_run_at
    from tagged t
    group by t.job_key
  ),
  -- "This run" = every tagged row within 15 minutes of the adapter's own
  -- most recent completed_at -- wide enough to cover a real multi-company
  -- Greenhouse/Lever batch (each company's own row completes within
  -- seconds of the others in practice), narrow enough not to blend
  -- together two genuinely different days' runs.
  batch as (
    select
      t.job_key,
      count(*)::integer as total,
      count(*) filter (where t.status = 'failed')::integer as failed,
      (array_agg(t.status order by t.completed_at desc))[1] as last_status
    from tagged t
    join last_run lr on lr.job_key = t.job_key
    where t.completed_at >= lr.last_run_at - interval '15 minutes'
    group by t.job_key
  ),
  jobs (job_key, label, cadence, stale_after_hours) as (
    values
      ('greenhouse', 'Greenhouse companies', 'daily', 26),
      ('lever', 'Lever companies', 'daily', 26),
      ('deloitte', 'Deloitte (RSS)', 'daily', 26),
      ('link_health', 'Link health check', 'daily', 26),
      ('snapshot', 'Job board snapshot', 'daily', 26),
      ('weekly_digest', 'Weekly digest', 'weekly', 192)
  )
  select
    j.job_key,
    j.label,
    j.cadence,
    lr.last_run_at,
    b.last_status,
    coalesce(b.total, 0),
    coalesce(b.failed, 0),
    (lr.last_run_at is null or lr.last_run_at < now() - make_interval(hours => j.stale_after_hours::integer)) as is_stale
  from jobs j
  left join last_run lr on lr.job_key = j.job_key
  left join batch b on b.job_key = j.job_key
  order by j.job_key;
end;
$$;

grant execute on function check_cron_health() to authenticated;
