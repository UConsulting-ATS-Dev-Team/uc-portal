-- US-52's other real half, per JOB_ENGINE_ARCHITECTURE.md §3.5/Part 7's own
-- deferral note ("live application-URL health checks aren't meaningful yet
-- with no real automated source running") -- that condition no longer
-- holds: 12 real automated sources are live with thousands of real
-- postings (see the Fifth-addition entries in Part 7's Stage 4 log). This
-- is the schema half of closing that gap; check-job-links (the Edge
-- Function) and its cron schedule are the next two migrations.
--
-- Shape deliberately mirrors 20260824270000's missed_fetches/mark_jobs_missed
-- pattern -- the closest real analog in this codebase for "a counter that
-- tracks consecutive failures and flips a status once a threshold is
-- crossed, never on a single miss." Two differences from that pattern,
-- both intentional:
--   1. link_health never touches `active`/`status`/the expiration state
--      machine. missed_fetches answers "is this source's feed still
--      listing this job" (a presence signal); link_health answers "does
--      this job's own application_url still resolve" (a reachability
--      signal). Conflating the two would mean a bot-protection false
--      positive (see check-job-links' own header comment on the real,
--      confirmed Carvana case) could silently deactivate a genuinely live
--      posting -- exactly the "never delete/deactivate on a single failed
--      check" principle this whole feature is required to honor, just
--      applied to a second, independent counter rather than reusing the
--      first one for a signal it wasn't designed to carry.
--   2. Kept as three states (unchecked/ok/broken), not four+ -- no
--      "checking soon"/"expiring" gradient the way job_status has, since
--      there's no member-facing badge for this yet (admin-only surface,
--      per the task's own scope line: "detect and surface broken links,
--      not a redesign of the quality scoring system").
create type link_health_status as enum ('unchecked', 'ok', 'broken');

alter table jobs
  add column link_health link_health_status not null default 'unchecked',
  add column link_check_failures integer not null default 0,
  add column last_link_checked_at timestamptz;

-- Lets check-job-links cheaply pick "the jobs least recently checked" each
-- run (oldest-first, nulls -- i.e. never checked -- first) without a
-- sequential scan, since active jobs (~3,300 as of this migration) is
-- already too many to check exhaustively in one Edge Function invocation
-- -- see that function's own MAX_LINKS_PER_RUN comment for why it
-- deliberately checks a rotating slice instead of everything every day.
create index jobs_link_check_idx on jobs (last_link_checked_at) where active;

-- Same reasoning as mark_jobs_missed (20260824270000): PostgREST's
-- .update() can only set absolute values, not "increment this job's
-- consecutive-failure counter, then conditionally flip link_health based
-- on the new total" -- that has to happen atomically per row inside one
-- statement, not read-then-write from the Edge Function (which would
-- race against a concurrent invocation and risk double-counting a single
-- check as two failures). Two ID arrays instead of mark_jobs_missed's one,
-- since a single check-job-links run produces both outcomes every time
-- (some URLs resolve, some don't) and batching both into one round trip
-- is the same "no per-row round-trip" principle §3.5/Part 6 already
-- established for this codebase.
--
-- ok_ids: check succeeded -- resets the counter and clears any prior
-- 'broken' flag. A job that comes back healthy after being flagged
-- reactivates cleanly, matching §3.4's existing "a job reappearing should
-- reactivate cleanly" principle for the analogous missed_fetches case.
--
-- failed_ids: check failed -- increments the counter; only flips
-- link_health to 'broken' once the count reaches the threshold (3
-- consecutive failed checks, matching §3.4's own "after 3+ consecutive
-- failed fetches" language -- mark_jobs_missed itself ended up tuned to 2
-- for a different, more time-sensitive signal (deadline-bearing listings
-- vanishing from an exhaustive feed); a dead link is not time-sensitive
-- the same way, so this uses §3.4's original, less aggressive number
-- rather than copying mark_jobs_missed's tuned value). 1-2 misses stay
-- invisible -- still plausibly a transient timeout or a momentary outage,
-- not a real signal yet.
--
-- No `security definer` and no grant to authenticated/anon, same as
-- mark_jobs_missed -- only ever called by check-job-links' service_role
-- client, never something a signed-in member should invoke directly to
-- flag arbitrary jobs broken.
create or replace function mark_link_check_results(ok_ids uuid[], failed_ids uuid[])
returns void as $$
  update jobs
  set link_health = 'ok', link_check_failures = 0, last_link_checked_at = now(), updated_at = now()
  where id = any(ok_ids);

  update jobs
  set
    link_check_failures = jobs.link_check_failures + 1,
    link_health = case when jobs.link_check_failures + 1 >= 3 then 'broken'::link_health_status else jobs.link_health end,
    last_link_checked_at = now(),
    updated_at = now()
  where id = any(failed_ids);
$$ language sql;

revoke all on function mark_link_check_results(uuid[], uuid[]) from public, anon, authenticated;

-- check-job-links isn't a job-listing source (it never contributes a job
-- record), but it reuses the sources/source_fetch_log registry+logging
-- infrastructure anyway rather than inventing a parallel admin surface
-- for one feature (the task's own instruction) -- 'system' is a new
-- source_type specifically for this: not a job source the §3.7 gate needs
-- to authorize ingestion for, just a scheduled internal job that benefits
-- from the same enable/disable toggle and run-history log every other
-- scheduled fetcher already has on SourceManagement.jsx. Added in its own
-- migration/transaction (not reused inline below) because a brand-new enum
-- value can't be used in the same transaction that adds it.
alter type source_type add value 'system';
