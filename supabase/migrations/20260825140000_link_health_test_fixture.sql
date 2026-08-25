-- Temporary test fixture to prove check-job-links' two state transitions
-- deliberately, not just observed incidentally: (1) a consistently
-- unreachable application_url crosses BROKEN_THRESHOLD and flips
-- link_health to 'broken', and (2) a job that was 'broken' cleanly
-- recovers to 'ok' (failures reset to 0) once its URL resolves again --
-- same "reactivate cleanly" principle §3.4 already established for
-- missed_fetches/mark_jobs_missed.
--
-- Not actually needed to prove path (1) alone -- real live data already
-- did that naturally (9 real active Databricks/Figma/Robinhood postings
-- were caught and correctly flagged 'broken' by three consecutive real
-- invocations before this migration was written, all confirmed genuinely
-- dead by manual inspection). This fixture exists specifically for path
-- (2), which real data can't demonstrate on demand (would require waiting
-- for a real dead link to come back to life).
--
-- application_url uses the reserved .example TLD (RFC 2606), which never
-- resolves -- a deterministic network failure on every check, not
-- dependent on any real site's behavior. Deleted via a follow-up cleanup
-- migration once both paths are verified live.
insert into jobs (company, title, employment_type, application_url, active, status)
values (
  'UC Portal Test Fixture',
  'DO NOT APPLY -- check-job-links verification row, deleted after use',
  'internship',
  'https://this-application-does-not-exist.uc-portal-link-health-test.example/apply',
  true,
  'active'
);
