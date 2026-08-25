-- US-22/23 -- hardens the expiration state machine. Confirmed live (see
-- JOB_ENGINE_ARCHITECTURE.md's audit note) that fetch-greenhouse-companies
-- flipped a job to 'potentially_expired' on a single missed fetch (no
-- retry threshold at all -- one transient scrape hiccup would falsely flag
-- a still-open job) and never actually flipped `active` to false on real
-- expiry, so pages/Jobs.jsx's `.eq("active", true)` query kept showing
-- "expired" jobs indefinitely with no distinguishing badge anywhere --
-- 'potentially_expired'/'expired' existed as a recorded status, not an
-- enforced one.
--
-- missed_fetches counts *consecutive* daily absences (reset to 0 the
-- moment a job reappears in a fetch). Two thresholds, both walked through
-- gradually rather than jumping straight to "gone":
--   1 miss  -- no visible change yet (a single missed fetch is still
--              plausibly a transient scrape/API hiccup, not a real signal).
--   2 misses -- status flips to 'potentially_expired': visible on the
--              board with a "possibly no longer accepting applications"
--              badge (see pages/Jobs.jsx-side change), but not excluded --
--              a real member can still decide it's worth trying.
--   5 misses -- status flips to 'expired' AND active flips to false: this
--              is the actual archive transition (US-23) -- excluded from
--              every active-jobs query, but the row itself is never
--              deleted, so history/provenance is retained.
alter table jobs
  add column missed_fetches integer not null default 0;

-- PostgREST's .update() can only set absolute values, not "increment by
-- one, then conditionally transition status/active based on the new
-- total" -- that needs to happen atomically in one statement per row, not
-- read-then-write from the Edge Function (which would race against
-- concurrent adapter runs and silently double-count under retry). Same
-- reasoning as company_demand_report's own RPC: PostgREST genuinely can't
-- express this, so a function is the correct tool, not a workaround.
--
-- `active = true` in the WHERE clause is deliberate -- only still-active
-- jobs participate; this can't resurrect an already-expired job or
-- double-increment one a previous run already touched in the same
-- invocation (job_ids should never overlap across calls in practice, but
-- this makes it safe even if they did).
--
-- No `security definer` and no grant to authenticated/anon -- this is only
-- ever called by an Edge Function's service_role client (which already
-- bypasses RLS entirely regardless of the function's own security
-- context), not something any signed-in member should be able to invoke
-- directly to expire arbitrary jobs.
create or replace function mark_jobs_missed(job_ids uuid[])
returns table(id uuid, new_status job_status, new_active boolean) as $$
  update jobs
  set
    missed_fetches = jobs.missed_fetches + 1,
    status = case
      when jobs.missed_fetches + 1 >= 5 then 'expired'::job_status
      when jobs.missed_fetches + 1 >= 2 then 'potentially_expired'::job_status
      else jobs.status
    end,
    active = case when jobs.missed_fetches + 1 >= 5 then false else jobs.active end,
    updated_at = now()
  where jobs.id = any(job_ids)
    and jobs.active = true
  returning jobs.id, jobs.status, jobs.active;
$$ language sql;

revoke all on function mark_jobs_missed(uuid[]) from public, anon, authenticated;
