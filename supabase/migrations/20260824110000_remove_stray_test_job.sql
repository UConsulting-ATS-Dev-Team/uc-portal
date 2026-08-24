-- Removes a single leftover manual test job ("Test Company Inc") found
-- while computing the relevance-filter dry-run impact (JOB_ENGINE_
-- ARCHITECTURE.md's Stage 4 notes) -- not a real company, obviously test
-- debris from earlier approve-submission feature testing (same category as
-- 20260824100000's Stage 2 demo-job cleanup, just one stray row instead of
-- a whole seed batch). Turned out to still be referenced by the
-- opportunity_submissions row that originally created it via
-- approve-submission -- delete that first, then the job it produced.
delete from opportunity_submissions where job_id in (select id from jobs where company = 'Test Company Inc');
delete from jobs where company = 'Test Company Inc';
