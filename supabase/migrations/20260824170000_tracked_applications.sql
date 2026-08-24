-- Real applications tracker, replacing data/store.jsx's localStorage-only
-- trackedJobs/prepLogged/timelineShiftDays maps as the durable source for
-- a member's actual tracked applications -- the one piece of the core
-- Jobs -> Applications loop still fully mocked after this session's real
-- jobs/people work (see JOB_ENGINE_ARCHITECTURE.md's Stage 5 entry).
--
-- One row per (member, job) rather than one row per member (unlike
-- member_preferences) -- a member tracks many applications, not one blob.
-- job_id is text, not a uuid FK to jobs.id: tracked jobs can be either a
-- real job (uuid id) or one of data/mockJobs.js's still-mock listings
-- (a readable slug like "bain-consulting-intern") -- this table needs to
-- hold both, same as the local trackedJobs map already does.
--
-- Consolidates three separate local-state maps (trackedJobs, prepLogged,
-- timelineShiftDays) into one row per application -- they were only ever
-- split locally for incremental-build reasons (prepLogged and
-- timelineShiftDays were added in later features than trackedJobs), not
-- because they're logically separate; every one of them is really an
-- attribute of "this member's application to this job."
--
-- RLS is member-only with no is_admin() bypass, unlike sources/
-- duplicate_candidates -- CLAUDE.md's Admin Dashboard section is explicit
-- that admins see aggregate recruiting data only and never an individual
-- member's own application list. That's a real product privacy boundary,
-- not an oversight to fix later, so this table deliberately doesn't grant
-- admins a way around it.
create table tracked_applications (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references auth.users(id) on delete cascade,
  job_id text not null,
  stage text not null,
  added_at timestamptz not null default now(),
  stage_history jsonb not null default '[]'::jsonb,
  prep_logged_hours numeric not null default 0,
  timeline_shift_days integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (member_id, job_id)
);

alter table tracked_applications enable row level security;
create policy "tracked_applications_select_own" on tracked_applications for select using (member_id = auth.uid());
create policy "tracked_applications_insert_own" on tracked_applications for insert with check (member_id = auth.uid());
create policy "tracked_applications_update_own" on tracked_applications for update using (member_id = auth.uid());
create policy "tracked_applications_delete_own" on tracked_applications for delete using (member_id = auth.uid());

grant select, insert, update, delete on public.tracked_applications to authenticated;
