-- Removes the test opportunity_submissions/jobs created while verifying
-- supabase/functions/approve-submission end-to-end against the live
-- project: one clean-insert case ("Redwood Strategy Partners") and two
-- dedup cases against the seeded Bain job (an exact canonical-URL
-- auto-merge, and a company+title+location review-band flag). All three
-- outcomes (live, merged, live_flagged_duplicate) were confirmed correct
-- before this cleanup ran -- see the approve-submission Edge Function's
-- header comment for what it does. Submissions are deleted first since
-- opportunity_submissions.job_id -> jobs(id) has no ON DELETE CASCADE
-- (unlike job_sources/duplicate_candidates, which do), so a job can't be
-- deleted while a submission still references it.

delete from opportunity_submissions
where id in (
  '36732dd7-494f-4fee-966a-cb0cc9a22da6', -- Redwood (clean insert)
  '21b7cd68-647e-470a-a9b7-c55b8b02268d', -- Bain auto-merge test
  'ee6f1dd0-0127-41c1-ab3e-71c22a90b21d'  -- Bain review-band test
);

-- The auto-merge test correctly attached itself as a second job_source on
-- the real seeded Bain job (479d5811-...) rather than creating a duplicate
-- job -- that attachment is test provenance and needs its own explicit
-- delete, since it's on a job that isn't itself being removed.
delete from job_sources where id = '7690236d-089b-4cae-bea0-85295b90e849';

-- Cascades to each job's own job_sources/duplicate_candidates rows.
delete from jobs
where id in (
  '3af6d4e6-4944-481e-8b1a-34228e3bbcfd', -- Redwood Strategy Partners
  '560fd119-d954-42d4-a287-1f998492025c'  -- Bain review-band duplicate
);
