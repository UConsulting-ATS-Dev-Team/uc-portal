-- Seeds the two sources every opportunity_submissions row currently comes
-- from (member-facing "Post a job" and Admin's "+ Post opportunity" both use
-- the same PostOpportunityModal.jsx and land in the same review queue,
-- distinguished only by the submitter's own profiles.role at approval time).
-- Required by supabase/functions/approve-submission -- job_sources.source_id
-- is a not-null FK, and §3.7's registry gate is what that Edge Function
-- checks before writing anything (a 'disabled' or 'not_approved' row here
-- would stop it cold, by design).
--
-- Per Part 2's source table, both are the zero-legal-risk baseline case:
-- the submitter enters facts in their own words (never auto-scraped), so
-- storage_restrictions is left null rather than a placeholder string.

insert into sources (name, type, authorization_status, api_available, attribution_required, redistribution_restricted, notes)
values
  ('UC Admin Submission', 'admin', 'approved', false, false, false, 'Careers Committee-submitted opportunities via Post an opportunity (Admin Dashboard).'),
  ('UC Member Submission', 'member', 'approved', false, false, false, 'Member-submitted opportunities via Post an opportunity (Jobs board). Facts as entered by the submitter, never auto-scraped -- see JOB_ENGINE_ARCHITECTURE.md Part 2''s copyright note.');
