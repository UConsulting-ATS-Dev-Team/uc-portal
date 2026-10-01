-- Real, confirmed-live fix for a systemic pg_net worker-level duplicate-
-- delivery bug: every one of this project's 6 scheduled Edge Functions
-- has been invoked TWICE per real cron firing, every single day, for at
-- least the last 10 days (2026-09-20 through 2026-09-29, confirmed via
-- direct source_fetch_log queries against both check-job-links and
-- snapshot-job-board). cron.job_run_details shows exactly ONE row per
-- job per day (so the SQL-level net.http_post() call itself only ever
-- fires once), and cron.job itself has no duplicate/leftover
-- registration (7 jobs, 7 distinct jobids, confirmed directly) -- so the
-- duplication happens inside pg_net's own background worker, not in
-- this app's cron SQL or Edge Function code. Ruled out a request-
-- timeout-triggered retry theory too: the duplicate happens identically
-- on a slow function (check-job-links, ~25-30s real runtime) and a fast
-- one (snapshot-job-board, well under 1s), with the two real
-- invocations starting only ~250ms-1.5s apart each time.
--
-- Since the cause lives inside pg_net itself (v0.20.4) and can't be
-- patched from here, this guards the real, evidenced harm instead: every
-- scheduled adapter currently runs its real external work (Greenhouse/
-- Lever/Deloitte API calls, HTTP HEAD/GET checks against every active
-- job's own application_url) at roughly 2x its intended daily frequency
-- -- exactly the kind of over-invocation check-job-links' own header
-- comment already documents as having caused a real false-positive burst
-- once before, just via a different mechanism this time.
create table cron_run_locks (
  job_key text not null,
  run_window timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (job_key, run_window)
);

comment on table cron_run_locks is
  'Unique-constraint-backed dedup guard for the 6 scheduled Edge Functions -- see supabase/functions/_shared/dedupeRun.ts for the claim logic and this migration''s own header for the full pg_net duplicate-delivery finding. A near-simultaneous duplicate invocation collides on (job_key, run_window) and is atomically rejected by the primary key; the next real day''s run lands in an entirely different minute, so a legitimate run is never suppressed. Negligible scale (7 rows/day at most) -- no cleanup job needed.';

alter table cron_run_locks enable row level security;
-- Service-role only (each function's own adminClient) -- no legitimate
-- client-side reader or writer, same posture as access_request_attempts
-- (RLS enabled, zero policies, default-deny).
