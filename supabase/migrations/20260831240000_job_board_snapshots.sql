-- US-61 (P2, job-trend insights over time) has sat blocked on
-- JOB_ENGINE_ARCHITECTURE.md's own note that it "depends on historical
-- data existing (needs Stage 2+ running for a while first, not just an
-- engineering dependency)" -- true, but every day that passes without
-- capturing *any* history is a day of trend data permanently and
-- irrecoverably lost, since `jobs` only ever reflects the board's current
-- state (first_seen_at/last_seen_at tell you about one row's own
-- lifecycle, never the board's aggregate shape on a given past day). This
-- is the data-collection half only -- not US-61 itself, not a trend UI,
-- just starting to record a daily point-in-time summary so that feature is
-- buildable later once enough history has accumulated.
--
-- Deliberately aggregate stats, not full job rows -- `jobs` (with its own
-- timestamps/history) already is the per-job record; duplicating that
-- daily would be both wasteful and exactly the "exhaustive dump" the task
-- brief warns against. One row per day, cheap to store, meaningful to
-- trend later: total active jobs, active jobs broken down by company / by
-- job function / by employment type / by link health, and average quality
-- score. Link-health breakdown included because it's already a real,
-- cheap-to-aggregate per-job column (20260825110000) and "how has the
-- board's overall link health trended" is a genuinely useful board-health
-- question the task brief's own "anything else you judge genuinely
-- useful" invites -- nothing here beyond what's already a column on `jobs`
-- today.
create table job_board_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null unique,
  total_active_jobs int not null,
  distinct_companies int not null,
  avg_quality_score numeric,
  jobs_by_company jsonb not null default '{}',
  jobs_by_job_function jsonb not null default '{}',
  jobs_by_employment_type jsonb not null default '{}',
  jobs_by_link_health jsonb not null default '{}',
  created_at timestamptz not null default now()
);

comment on table job_board_snapshots is 'One row per day, written by supabase/functions/snapshot-job-board. Infrastructure for US-61 (job-trend insights) -- not the trend feature itself, which still needs real accumulated history before it is meaningful.';

alter table job_board_snapshots enable row level security;
create policy "job_board_snapshots_admin_all" on job_board_snapshots for all using (is_admin()) with check (is_admin());

-- Same grant gap this codebase has hit repeatedly (20260821150000,
-- 20260822110000, 20260825130000) -- RLS alone doesn't grant table access,
-- explicit GRANTs are still required even for roles RLS would otherwise
-- allow through. Mirrors source_fetch_log's own grants exactly (20260823100000).
grant select on public.job_board_snapshots to authenticated;
grant all privileges on public.job_board_snapshots to service_role;

-- Real SQL aggregation, not a client-side pull-every-row-into-JS pass --
-- deliberately avoids the pagination-limit class of bug this codebase has
-- been bitten by twice already (fetch-greenhouse-companies' orphaned-
-- duplicate incident, Stripe's 574-of-575 auto-merge incident, both
-- documented in JOB_ENGINE_ARCHITECTURE.md Part 7 Stage 3/4): counting is
-- exactly what SQL is good at, so there is no unbounded .select() to page
-- through in the Edge Function at all. `language sql` (not plpgsql) since
-- this is a single read-only computation with no branching/control flow;
-- SECURITY INVOKER (the default) is correct here, not SECURITY DEFINER --
-- unlike company_demand_report/job_track_record_report, this has no
-- member-privacy boundary to enforce; it's only ever called by
-- snapshot-job-board's service_role client, which already has unrestricted
-- table access via the grants above.
create or replace function compute_job_board_snapshot()
returns table (
  total_active_jobs int,
  distinct_companies int,
  avg_quality_score numeric,
  jobs_by_company jsonb,
  jobs_by_job_function jsonb,
  jobs_by_employment_type jsonb,
  jobs_by_link_health jsonb
)
language sql
stable
as $$
  with active_jobs as (
    select j.company, j.quality_score, j.employment_type, j.link_health,
           coalesce(jf.name, 'Unclassified') as function_name
    from jobs j
    left join job_functions jf on jf.id = j.job_function_id
    where j.active
  ),
  by_company as (
    select coalesce(jsonb_object_agg(company, cnt order by company), '{}'::jsonb) as agg
    from (select company, count(*) as cnt from active_jobs group by company) s
  ),
  by_function as (
    select coalesce(jsonb_object_agg(function_name, cnt order by function_name), '{}'::jsonb) as agg
    from (select function_name, count(*) as cnt from active_jobs group by function_name) s
  ),
  by_employment_type as (
    select coalesce(jsonb_object_agg(employment_type::text, cnt order by employment_type::text), '{}'::jsonb) as agg
    from (select employment_type, count(*) as cnt from active_jobs group by employment_type) s
  ),
  by_link_health as (
    select coalesce(jsonb_object_agg(link_health::text, cnt order by link_health::text), '{}'::jsonb) as agg
    from (select link_health, count(*) as cnt from active_jobs group by link_health) s
  )
  select
    (select count(*) from active_jobs)::int,
    (select count(distinct company) from active_jobs)::int,
    (select round(avg(quality_score)::numeric, 4) from active_jobs),
    (select agg from by_company),
    (select agg from by_function),
    (select agg from by_employment_type),
    (select agg from by_link_health);
$$;

-- Same grant gap 20260825130000 already found and fixed for
-- mark_link_check_results/mark_jobs_missed: a function created by a
-- migration defaults to EXECUTE granted to the migration runner plus
-- whatever PUBLIC carries, and this project's service_role is not
-- superuser -- it bypasses RLS, not GRANTs -- so it needs the same
-- explicit grant every other service_role-invoked RPC in this codebase
-- has needed, done here up front rather than discovered live a second time.
grant execute on function compute_job_board_snapshot() to service_role;

-- Reuses the §3.7 source registry purely for its enable/disable toggle and
-- source_fetch_log run-history, same as check-job-links' "Link Health
-- Checker" row (20260825120000) -- this isn't a job-listing source either
-- (it never contributes a job record), it's a scheduled internal job that
-- benefits from the same admin-visible on/off switch and run log every
-- other scheduled function already has, without inventing a second admin
-- surface for it. 'system' source_type already exists as of 20260825110000.
insert into sources (
  name, type, authorization_status, api_available, storage_restrictions, notes
) values (
  'Job Board Snapshot',
  'system',
  'approved',
  true,
  null,
  'Not a job-listing source -- never contributes a job record. Scheduled daily (snapshot-job-board) to write one aggregate row per day into job_board_snapshots (US-61 data-collection foundation). Reuses this registry only for the enable/disable toggle and source_fetch_log run history every other scheduled function already has.'
);
