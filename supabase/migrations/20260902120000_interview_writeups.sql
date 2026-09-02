-- Makes components/modals/ContributeModal.jsx's "Interview write-up" path
-- real. It was deliberately built to do nothing (per CLAUDE.md's Progress
-- entry: "Contributed content isn't wired into the real Career Resources
-- library... noted in-code rather than faked") because nothing existed to
-- attach a real write-up to. Real jobs now exist (pages/RealJobDetail.jsx),
-- which has no interview-intelligence content at all, unlike the mock
-- pages/JobDetail.jsx's data/jobUtils.js WRITEUP_POOL. This table stores a
-- member's own account of their interview experience -- only the facts the
-- submitter personally enters, in their own words, never scraped/copied
-- employer material (JOB_ENGINE_ARCHITECTURE.md Part 2's established rule
-- for member-submitted content).
--
-- job_id is nullable and optional on purpose: a write-up can be tied to one
-- specific real posting (contributed from that job's own detail page) or
-- just to a company in general (contributed from the generic Career
-- Resources "+ Contribute" entry point, which has no job context) --
-- exactly the two entry points ContributeModal.jsx is wired into.
--
-- outcome mirrors ContributeModal's own OUTCOMES array exactly, so the enum
-- can never drift out of sync with what the form actually offers.
create type interview_writeup_outcome as enum ('Offer', 'Rejected', 'Withdrew', 'Still in process');

create table interview_writeups (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id),
  company text not null,
  title text not null,
  round text,
  outcome interview_writeup_outcome not null,
  body text not null,
  is_anonymous boolean not null default false,
  submitted_by uuid not null references auth.users(id),
  -- Denormalized display name, same prototype convention feature_requests
  -- and RequestFeatureModal.jsx already use (captured from data/mockUser.js's
  -- currentUser at submission time, since nothing populates
  -- profiles.full_name yet) -- but null whenever is_anonymous is true, since
  -- unlike feature_requests this table's whole point is member-facing
  -- display and the submitter's own "Post anonymously" checkbox is a real
  -- choice to honor, not just cosmetic copy in the success message.
  submitted_by_name text,
  created_at timestamptz not null default now()
);

-- Readable by any authenticated member (this is meant to be seen -- it's
-- the whole point, same as jobs/people), writable by the submitter. Unlike
-- feature_requests or opportunity_submissions, there's no admin-review gate
-- here -- a member's own honest account of their interview doesn't need
-- Careers Committee approval before other members can see it.
alter table interview_writeups enable row level security;
create policy "interview_writeups_select_authenticated" on interview_writeups for select using (auth.role() = 'authenticated');
create policy "interview_writeups_insert_own" on interview_writeups for insert with check (submitted_by = auth.uid());

-- Same gap every other table in this project has hit -- explicit grants
-- required even for roles RLS would otherwise allow through.
grant select, insert on public.interview_writeups to authenticated;
