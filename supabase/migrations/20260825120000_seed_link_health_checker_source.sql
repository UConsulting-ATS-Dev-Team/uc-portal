-- Seeds the §3.7-registry row check-job-links looks itself up by name
-- (same pattern fetch-deloitte-jobs/fetch-greenhouse-companies already
-- use), in its own migration/transaction since the previous migration's
-- new 'system' enum value can't be used until that transaction commits.
--
-- authorization_status 'approved' + enabled from day one, same as every
-- other scheduled fetcher's seed row -- SourceManagement.jsx's existing
-- Approved<->Disabled toggle becomes the real kill switch for this too,
-- with no new UI needed (the task's own instruction against building a
-- third parallel admin surface).
insert into sources (
  name, type, authorization_status, api_available, storage_restrictions, notes
) values (
  'Link Health Checker',
  'system',
  'approved',
  true,
  null,
  'Not a job-listing source -- never contributes a job record. Scheduled daily (check-job-links) to HEAD/GET-check every active job''s application_url and flag ones that stay unreachable for 3+ consecutive checks. Reuses this registry only for the enable/disable toggle and source_fetch_log run history every other scheduled fetcher already has.'
);
