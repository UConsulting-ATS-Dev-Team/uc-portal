-- Atomic "new jobs + their job_sources rows" insert for the ingestion fetchers.
--
-- fetch-greenhouse-companies, fetch-lever-companies and fetch-deloitte-jobs used
-- to write a run's new `jobs` rows in one request and the matching
-- `job_sources` rows in a second one. Anything that stopped a run between the
-- two left jobs with no source row ("orphans"): the next run finds existing jobs
-- *through* job_sources, so it treated them as new and inserted them again, and
-- because expiry and the per-company caps only act on tracked jobs, the orphans
-- never expired and were never capped. By 2026-10-03 that was 5,317 of 10,762
-- active jobs. Two things stopped runs in between: the pg_net duplicate-delivery
-- race (the second run's job_sources insert hit a duplicate key) and the
-- all-at-once run being killed by the Edge Function resource limit.
--
-- This runs both inserts inside one function call, which is one transaction: if
-- either fails, neither is kept, so a failed or interrupted run leaves nothing
-- half-written and simply retries cleanly next time.
--
-- It builds the column list from the union of keys present in the payload, which
-- is what PostgREST's own bulk insert does (a row missing a key another row has
-- gets NULL for it; a key present in no row falls through to the column
-- default), so behavior matches the two requests it replaces. Values are typed
-- through jsonb_populate_recordset, and keys go through quote_ident.
--
-- Service role only (called from the Edge Functions), like mark_jobs_missed().
create or replace function insert_jobs_with_sources(p_jobs jsonb, p_sources jsonb)
returns void
language plpgsql
as $$
declare
  cols text;
begin
  if jsonb_typeof(p_jobs) = 'array' and jsonb_array_length(p_jobs) > 0 then
    select string_agg(distinct quote_ident(k), ', ')
      into cols
      from jsonb_array_elements(p_jobs) e, jsonb_object_keys(e) k;
    execute format('insert into jobs (%1$s) select %1$s from jsonb_populate_recordset(null::jobs, $1)', cols)
      using p_jobs;
  end if;

  if jsonb_typeof(p_sources) = 'array' and jsonb_array_length(p_sources) > 0 then
    select string_agg(distinct quote_ident(k), ', ')
      into cols
      from jsonb_array_elements(p_sources) e, jsonb_object_keys(e) k;
    execute format('insert into job_sources (%1$s) select %1$s from jsonb_populate_recordset(null::job_sources, $1)', cols)
      using p_sources;
  end if;
end;
$$;

revoke all on function insert_jobs_with_sources(jsonb, jsonb) from public, anon, authenticated;
