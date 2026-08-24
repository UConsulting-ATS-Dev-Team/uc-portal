-- Removes the throwaway test submission/job used to verify the
-- approve-submission Edge Function still works end-to-end after
-- 20260824220000-adjacent code changes to jobInsertFromNormalized's
-- signature (US-56 storage-restrictions enforcement, see
-- JOB_ENGINE_ARCHITECTURE.md). Not a real posting; the app itself is never
-- granted DELETE on any of these tables (same intentional boundary as
-- network_connections), so cleanup goes through a migration like every
-- other test-data removal this session.
delete from opportunity_submissions where id = '25d164b4-7337-482d-8274-9d1897c08f90';
delete from job_sources where job_id = '62c6dbe9-fb47-43cc-97ed-da4195652f6d';
delete from jobs where id = '62c6dbe9-fb47-43cc-97ed-da4195652f6d';
