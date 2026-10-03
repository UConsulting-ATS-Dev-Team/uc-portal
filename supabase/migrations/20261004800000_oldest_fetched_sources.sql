-- Stalest-first ordering for batched ingestion runs.
--
-- fetch-greenhouse-companies used to process all ~160 companies in one
-- invocation. With ~11k active jobs that run exceeds the Edge Function
-- resource limit and is killed after logging only the companies that happened
-- to finish first, so most sources went 2-3+ weeks without a fetch (which also
-- meant no expiry and no per-company cap enforcement for them). The function
-- now accepts { batch: N } and processes only the N least-recently-fetched
-- companies; this returns that ordering.
--
-- "Fetched" means the newest source_fetch_log row of any status -- a company
-- that fails still moves to the back of the line instead of being retried
-- forever ahead of everyone else. Sources never fetched sort first. Disabled
-- sources are skipped so they don't occupy batch slots.
--
-- Service role only (called by the Edge Function), same as mark_jobs_missed().
create or replace function oldest_fetched_sources(p_platform text, p_limit integer)
returns setof uuid
language sql
stable
as $$
  select s.id
  from sources s
  where s.type = 'employer_api'
    and s.config->>'platform' = p_platform
    and s.enabled
  order by (select max(l.completed_at) from source_fetch_log l where l.source_id = s.id) asc nulls first, s.id
  limit p_limit;
$$;

revoke all on function oldest_fetched_sources(text, integer) from public, anon, authenticated;
