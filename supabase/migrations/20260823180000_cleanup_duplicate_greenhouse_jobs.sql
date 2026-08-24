-- Cleans up real duplicate jobs rows created for Coinbase/Airbnb/Brex while
-- testing fetch-greenhouse-companies: the first "all 7 companies" backfill
-- attempt crashed on Supabase's resource limit mid-run (before the
-- per-run cap and job_sources upsert fixes existed), and a later retry
-- re-processed these three companies before job_sources.upsert() was in
-- place, hitting the jobs-insert-before-job_sources-insert ordering gap --
-- a job row could be created even when its corresponding job_sources
-- insert then failed on a duplicate key, leaving genuine orphan
-- duplicates (jobs.count significantly exceeded job_sources.count for
-- exactly these three: 305 vs 173, 334 vs 189, 383 vs 294). Databricks'
-- own job_sources slightly exceeding its jobs count is separately
-- confirmed correct (legitimate auto-merges attaching a second source to
-- an already-existing job), not touched here.
--
-- Simplest correct fix: remove every jobs/job_sources row for these three
-- companies and let them be cleanly re-backfilled from scratch now that
-- job_sources.upsert(..., ignoreDuplicates: true) makes the write itself
-- idempotent regardless of how many times it's retried.

delete from job_sources where job_id in (select id from jobs where company in ('Coinbase', 'Airbnb', 'Brex'));
delete from jobs where company in ('Coinbase', 'Airbnb', 'Brex');
