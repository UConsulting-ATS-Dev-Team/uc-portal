import { supabase } from "./supabaseClient.js";

// Maps a real jobs-table row (+ an optional data/jobMatch.js match result)
// into the exact shape components/JobCard.jsx and data/jobUtils.js already
// expect from a mock job (data/mockJobs.js) -- role/location/workMode/
// compDisplay/deadlineDate/rolling/etc. This is what lets pages/Jobs.jsx
// reuse JobCard unchanged for real jobs instead of forking a second card
// component, and lets jobUtils.js's deadline math work on a real job
// without any changes there either.
//
// UC-intelligence fields (ucConnections, pastCycleApplicants/Offers,
// referralAvailable, companySize) are left undefined rather than faked as
// 0 -- that data comes from the CRM/application-tracker boundary a real job
// doesn't have yet (Part 3.6), and showing "0 UC members applied" would
// read as a real, checked fact instead of "we don't know." JobCard.jsx's
// footer is guarded to skip rendering when these are undefined.

const EMPLOYMENT_TYPE_LABEL = {
  internship: "Internship",
  full_time: "Full-time",
  part_time: "Part-time",
  fellowship: "Fellowship",
  co_op: "Co-op",
  apprenticeship: "Apprenticeship",
  externship: "Externship",
};
const REMOTE_TYPE_LABEL = { remote: "Remote", hybrid: "Hybrid", in_person: "In-person" };

export function realJobToCardShape(job, matchResult) {
  const workMode = REMOTE_TYPE_LABEL[job.remote_type] ?? "In-person";
  const postedDaysAgo = job.posted_date ? Math.max(0, Math.floor((Date.now() - new Date(job.posted_date)) / 86400000)) : 0;

  return {
    id: job.id,
    isReal: true, // lets Jobs.jsx tell real cards apart from mock ones without re-deriving it
    company: job.company,
    logoInitials: job.company.slice(0, 3).toUpperCase(),
    role: job.title,
    matchScore: matchResult?.score ?? 0,
    matchEligible: matchResult?.eligible ?? true,
    qualityScore: job.quality_score,
    possiblyClosed: job.status === "potentially_expired", // US-22/23 -- still active, but the source has missed it 2+ consecutive fetches
    ucPosted: false,
    referralAvailable: false,
    location: job.city ?? (job.remote_type === "remote" ? "Remote" : ""),
    workMode,
    compMin: job.salary_min,
    compMax: job.salary_max,
    compDisplay: job.compensation_text || (job.salary_min ? `$${job.salary_min}${job.compensation_type === "hourly" ? "/hr" : "/yr"}` : "Not listed"),
    compHourly: job.compensation_type === "hourly",
    type: EMPLOYMENT_TYPE_LABEL[job.employment_type] ?? "Not classified",
    classYears: job.graduation_years ?? [],
    industry: job.relevant_industries?.[0] ?? "",
    deadlineDate: job.application_deadline,
    rolling: !job.application_deadline,
    companySize: undefined,
    ucConnections: undefined,
    pastCycleApplicants: undefined,
    pastCycleOffers: undefined,
    postedDaysAgo,
    whyLowerMatch: null,
  };
}

// A bounded, on-demand search (top `limit` matches) for components/modals/
// AddApplicationModal.jsx's "From a UC posting" search -- deliberately NOT
// fetchAllRows() (that's for "get every row and page through it," the
// right tool for pages/Jobs.jsx's board, but wildly wasteful for a search
// box that only ever needs a handful of results). A plain .or(ilike) query
// with its own .limit() instead. Skips already-tracked jobs the same way
// the mock-job search below already did, so this can't offer to
// re-add something already in the tracker.
export async function searchRealJobs(query, trackedJobIds = [], limit = 6) {
  const q = query.trim();
  if (!q) return [];
  let builder = supabase
    .from("jobs")
    .select("*")
    .eq("active", true)
    .or(`company.ilike.%${q}%,title.ilike.%${q}%`)
    .limit(limit + trackedJobIds.length); // pad the query limit since already-tracked rows get filtered out below
  const { data, error } = await builder;
  if (error) throw new Error(`Searching jobs failed: ${error.message}`);
  return (data ?? [])
    .filter((job) => !trackedJobIds.includes(job.id))
    .slice(0, limit)
    .map((job) => realJobToCardShape(job));
}
