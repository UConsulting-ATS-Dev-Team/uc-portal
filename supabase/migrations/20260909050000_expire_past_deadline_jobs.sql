-- Closes the second real gap flagged directly: application_deadline is
-- captured and stored on every job but nothing ever acted on it -- a job
-- stayed exactly as active as one with weeks left, until the unrelated
-- missed-fetch/link-health mechanisms eventually caught up (which could
-- take days, since both need repeated consecutive misses/failures).
-- Direct requester ask, with an explicit grace window: "give it maybe a
-- day and check it again that next day so that if it is pushed back it
-- won't get removed immediately."
--
-- Deliberately a plain SQL function invoked straight from pg_cron, not
-- another Edge Function -- unlike every other scheduled job in this app,
-- this needs zero external network calls (the deadline is already
-- sitting on the row), so there's no reason to round-trip through an
-- HTTP request for what's a single UPDATE statement.
--
-- The grace window: application_deadline < current_date - 1, not just
-- < current_date. A job whose deadline was yesterday is left alone today.
-- Scheduled to run *after* every one of the day's other fetches (13:17
-- Greenhouse, 14:17 Deloitte, 15:17 check-job-links, 16:17 snapshot-job-
-- board, 17:17 Lever), so if an employer pushed a deadline back, that
-- same day's re-scrape has already updated application_deadline to the
-- new date before this runs -- the job simply won't match the condition
-- anymore. Only a deadline still in the past *after* that day's re-scrape
-- had a chance to update it actually gets expired. Same "row kept, never
-- deleted" pattern mark_jobs_missed() already uses -- history/provenance
-- is retained, only `active` (and the visible `status`) changes.
create or replace function expire_past_deadline_jobs()
returns table(id uuid) as $$
  update jobs
  set status = 'expired'::job_status, active = false, updated_at = now()
  where active = true
    and application_deadline is not null
    and application_deadline < (current_date - 1)
  returning jobs.id;
$$ language sql;

revoke all on function expire_past_deadline_jobs() from public, anon, authenticated;

select cron.schedule(
  'expire-past-deadline-jobs-daily',
  '17 18 * * *', -- 18:17 UTC daily -- after every other scheduled fetch/check that day
  $$ select expire_past_deadline_jobs(); $$
);
