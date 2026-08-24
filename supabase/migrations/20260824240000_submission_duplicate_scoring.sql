-- US-09/§8.2 -- "run the dedup pipeline on every submission before it
-- reaches the review queue." Found not actually true in practice (see
-- JOB_ENGINE_ARCHITECTURE.md's audit note): dedup only ran inside
-- approve-submission, at Approve time -- an admin looking at the queue had
-- no idea a submission was a likely duplicate until after clicking
-- Approve. These three columns let a new Edge Function
-- (score-submission-duplicate) score a submission the moment it's
-- created, so the queue itself can show the signal. This is informational
-- for the queue display only -- it does not replace approve-submission's
-- own dedup check at approval time, which stays authoritative (data can
-- change between submission and approval) and still runs every time.
alter table opportunity_submissions
  add column duplicate_tier text check (duplicate_tier in ('distinct', 'review', 'auto_merge')),
  add column duplicate_best_job_id uuid references jobs(id),
  add column duplicate_best_score real;

-- Same reasoning as opportunity_submissions_update_admin (client-side
-- safety net; the real writer is the Edge Function's service_role client,
-- which bypasses RLS entirely) -- a member submitting their own
-- opportunity has no business writing a dedup verdict about it directly.
comment on column opportunity_submissions.duplicate_tier is
  'Written by score-submission-duplicate at submission time; re-checked (not read from here) by approve-submission at approval time, which stays authoritative.';
