-- Removes the throwaway test submission used to verify
-- score-submission-duplicate + approve-submission's auto-merge path
-- end-to-end (a deliberate exact-duplicate of a real live Stripe job,
-- submitted to confirm the new duplicate_tier scoring actually fires and
-- the admin queue shows it before Approve is clicked). It resolved via
-- auto-merge, so only the extra job_sources attachment row and the
-- submission itself need removing -- no new `jobs` row was ever created.
delete from job_sources where id = '8ecd4877-6ba9-4686-89ac-5b42e5bef161';
delete from opportunity_submissions where id = 'c173e3e4-5903-467d-aad5-495c5911085e';
