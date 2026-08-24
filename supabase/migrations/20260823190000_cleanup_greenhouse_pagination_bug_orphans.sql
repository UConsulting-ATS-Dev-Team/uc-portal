-- Full cleanup after finding fetch-greenhouse-companies' real root cause:
-- a plain .select() on job_sources/jobs silently truncated at PostgREST's
-- default 1000-row page once combined volume across all 7 Greenhouse
-- companies passed that mark, so existingJobIdBySourceJobId was missing
-- entries for jobs that genuinely already had a job_sources row. Every
-- run that hit this re-processed those jobs as "new," creating a fresh
-- orphaned jobs row each time (job_sources' own insert either failed
-- loudly on the real unique constraint, or -- during the brief window an
-- upsert/ignoreDuplicates mitigation was in place -- failed silently,
-- which is why this wasn't caught immediately). Fixed properly via
-- pagination (fetchAllRows() in the function itself) rather than papered
-- over with upsert semantics, which would have kept masking the same
-- class of bug in the future.
--
-- Databricks/Coinbase/Airbnb/Brex all accumulated orphans during this
-- debugging session; Figma/Robinhood/Stripe's job/job_sources counts
-- stayed exactly consistent with their real Greenhouse postings the
-- entire time and are untouched here. Simplest correct fix, same as the
-- earlier narrower cleanup this session already did once: wipe every
-- jobs/job_sources row for the affected companies and let them be cleanly
-- re-backfilled from scratch now that the actual bug is fixed.

delete from job_sources where job_id in (select id from jobs where company in ('Databricks', 'Coinbase', 'Airbnb', 'Brex'));
delete from jobs where company in ('Databricks', 'Coinbase', 'Airbnb', 'Brex');
