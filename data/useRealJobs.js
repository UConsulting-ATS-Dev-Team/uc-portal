import { useEffect, useMemo, useState } from "react";
import { fetchAllRows } from "./fetchAllRows.js";
import { matchJob } from "./jobMatch.js";
import { realJobToCardShape } from "./realJobAdapter.js";

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
export function useRealJobs(preferences, classYear) {
  const [rawJobs, setRawJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  useEffect(() => {
    fetchAllRows("jobs", "*", (q) => q.eq("active", true))
      .then(setRawJobs)
      .catch(() => {}) // callers degrade to "0 real jobs" (mock fallback still works) rather than crashing
      .finally(() => setJobsLoading(false));
  }, []);
  const realJobs = useMemo(
    () => rawJobs.map((job) => realJobToCardShape(job, matchJob(job, preferences, classYear))),
    [rawJobs, preferences, classYear]
  );
  return { realJobs, jobsLoading };
}
