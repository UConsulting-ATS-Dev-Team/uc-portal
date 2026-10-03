import { useEffect, useMemo, useState } from "react";
import { fetchAllRows } from "./fetchAllRows.js";
import { useYcCompanies } from "./useYcCompanies.js";
import { matchJob } from "./jobMatch.js";
import { realJobToCardShape, JOB_LIST_COLUMNS, fetchJobsByIds, isRealJobId } from "./realJobAdapter.js";

// Shared by every page/component that needs to resolve a trackedJobs
// entry (or otherwise look up a job by id) against real data, not just
// data/mockJobs.js's 8 demo jobs -- extracted rather than copy-pasting
// the same ~10-line fetch+adapt block into pages/CareerResources.jsx,
// LearningTrackDetail.jsx, ResourceDetail.jsx, Notifications.jsx, and
// components/modals/LogPrepModal.jsx to fix the same bug in each: once a
// real job can genuinely reach the tracker (RealJobDetail.jsx's "Add to
// tracker"), any of these that only ever checked the mock list would
// silently drop it, the identical failure shape the Home/Applications/
// Saved-tab bugs already had. One implementation now, one place to keep
// in sync with pages/Jobs.jsx's own version of this same pipeline if the
// approach ever changes.
//
// classYear is optional -- callers that only need a job's basic
// card-shape fields (company, role, industry, deadlineDate) for display/
// matching, not a real match score, can omit preferences/classYear
// entirely; matchJob(job, undefined, undefined) still returns a shape
// realJobToCardShape can read (score defaults to 0 via its own `?? 0`).
//
// Two lists come back, and which one a caller wants matters:
//   realJobs      -- only jobs still on the board (active). Use for anything
//                    that is about what to apply to NOW: recommendations,
//                    "new matches", counts, deadline reminders.
//   allKnownJobs  -- realJobs plus any of `extraJobIds` (a member's tracked or
//                    saved jobs) that have since closed. Use to RESOLVE a
//                    member's own job ids, so a tracked or saved posting that
//                    expires shows up as closed instead of vanishing. The
//                    closed rows are only readable because of the
//                    jobs_select_own_tracked_or_saved policy.
export function useRealJobs(preferences, classYear, gradMonth, enabled = true, extraJobIds = []) {
  const [rawJobs, setRawJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [closedRaw, setClosedRaw] = useState([]);
  useEffect(() => {
    if (!enabled) {
      setJobsLoading(false);
      return;
    }
    // JOB_LIST_COLUMNS, not "*" -- same ~58% payload cut as pages/Jobs.jsx's
    // identical fetch (see data/realJobAdapter.js's own comment), which
    // this shared hook's callers all read through the same
    // realJobToCardShape/matchJob pipeline, so the trim is safe here too.
    fetchAllRows("jobs", JOB_LIST_COLUMNS, (q) => q.eq("active", true))
      .then(setRawJobs)
      .catch(() => {}) // callers degrade to "0 real jobs" (mock fallback still works) rather than crashing
      .finally(() => setJobsLoading(false));
  }, [enabled]);

  // Jobs the member tracked/saved that are no longer in the active list.
  // Keyed on the id list's content so adding a tracked job re-runs it.
  const idsKey = extraJobIds.filter(isRealJobId).sort().join(",");
  useEffect(() => {
    if (!enabled || jobsLoading || !idsKey) {
      setClosedRaw([]);
      return;
    }
    const active = new Set(rawJobs.map((j) => j.id));
    const missing = idsKey.split(",").filter((id) => !active.has(id));
    if (missing.length === 0) {
      setClosedRaw([]);
      return;
    }
    let cancelled = false;
    fetchJobsByIds(missing)
      .then((rows) => {
        if (!cancelled) setClosedRaw(rows);
      })
      .catch(() => {}); // degrade to "not shown" rather than crash
    return () => {
      cancelled = true;
    };
  }, [enabled, jobsLoading, rawJobs, idsKey]);

  const ycByCompany = useYcCompanies();
  const realJobs = useMemo(
    () =>
      rawJobs.map((job) => ({
        ...realJobToCardShape(job, matchJob(job, preferences, classYear, gradMonth, ycByCompany.get(job.company))),
        yc: ycByCompany.get(job.company) ?? null,
      })),
    [rawJobs, preferences, classYear, gradMonth, ycByCompany]
  );
  const allKnownJobs = useMemo(
    () => [...realJobs, ...closedRaw.map((job) => realJobToCardShape(job, matchJob(job, preferences, classYear, gradMonth, ycByCompany.get(job.company))))],
    [realJobs, closedRaw, preferences, classYear, gradMonth, ycByCompany]
  );
  return { realJobs, allKnownJobs, jobsLoading };
}
