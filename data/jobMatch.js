// Real hard-constraint + soft-preference matching (US-32/33/34) and ranking
// (US-40/41/43) against real Supabase jobs rows. Ports the logic already
// proven in server/src/match.ts + rank.ts to plain JS, since the frontend
// can't directly import those TS/Deno-oriented modules -- the two should be
// kept in sync by hand if the scoring approach changes. Reads the same
// `preferences` object already built in data/store.jsx and `currentUser`
// from data/mockUser.js (classYear), exactly as JobDetail.jsx's existing
// match checklist does for mock jobs -- this is the same logic, now able to
// run against a real job row's field names (city/remote_type/
// relevant_industries instead of location/workMode/industry).
// Standalone, like jobSearch.js -- doesn't touch Jobs.jsx's UI yet.

// --- Hard constraints (US-33): filter out entirely, never just down-rank ---
function isEligible(job, preferences, classYear) {
  const gradEligible = !job.graduation_years?.length || job.graduation_years.includes(classYear);

  const typeEligible =
    preferences.opportunityType === "Both" ||
    !preferences.opportunityType ||
    (preferences.opportunityType === "Internship" && job.employment_type === "internship") ||
    (preferences.opportunityType === "Full-time" && job.employment_type === "full_time");

  return gradEligible && typeEligible;
}

// --- Soft preferences (US-33/34): affect score only, always explainable ---
export function matchJob(job, preferences, classYear) {
  const factors = [];
  const eligible = isEligible(job, preferences, classYear);

  factors.push({
    key: "graduationYear",
    match: !job.graduation_years?.length || job.graduation_years.includes(classYear),
    label: job.graduation_years?.length ? `Eligible years: ${job.graduation_years.join(", ")}` : "No graduation-year requirement listed",
  });

  if (!eligible) return { eligible: false, score: 0, factors };

  let score = 0;

  const industryMatch = (job.relevant_industries ?? []).some((i) => preferences.industries.includes(i));
  factors.push({ key: "industry", match: industryMatch, label: job.relevant_industries?.join(", ") || "Not classified" });
  score += industryMatch ? 30 : 0;

  const roleMatch = (job.relevant_roles ?? []).some((r) => preferences.roles.some((pr) => r.toLowerCase().includes(pr.toLowerCase())));
  factors.push({ key: "role", match: roleMatch, label: job.title });
  score += roleMatch ? 25 : 0;

  const locationMatch =
    (!!job.city && preferences.locations.includes(job.city)) ||
    (preferences.remoteOrHybridOnly && (job.remote_type === "remote" || job.remote_type === "hybrid")) ||
    preferences.openToRelocating;
  factors.push({ key: "location", match: locationMatch, label: job.city ?? job.remote_type ?? "Unknown" });
  score += locationMatch ? 20 : 0;

  const compMatch = preferences.compTarget == null || (job.salary_min != null && job.salary_min >= preferences.compTarget);
  factors.push({ key: "compensation", match: compMatch, label: job.compensation_text ?? "Not listed" });
  score += compMatch ? 25 : 0;

  return { eligible: true, score: Math.round(score), factors };
}

// US-40/41/43 -- weighted by member-match + freshness, with the same
// per-company anti-domination cap server/src/rank.ts uses (max 3 per
// company in the top 20), so one employer's posting volume can't crowd out
// everything else.
const MAX_PER_COMPANY_IN_TOP_WINDOW = 3;
const TOP_WINDOW_SIZE = 20;

function freshnessScore(job, now) {
  if (!job.posted_date) return 0.5;
  const days = (now - new Date(job.posted_date)) / 86400000;
  return Math.max(0, Math.min(1, 1 - days / 90));
}

export function rankJobs(jobs, preferences, classYear, now = new Date()) {
  const ranked = jobs
    .map((job) => {
      const match = matchJob(job, preferences, classYear);
      if (!match.eligible) return null;
      const finalScore = 0.7 * (match.score / 100) + 0.3 * freshnessScore(job, now);
      return { job, match, finalScore };
    })
    .filter(Boolean)
    .sort((a, b) => b.finalScore - a.finalScore);

  const counts = new Map();
  const primary = [];
  const demoted = [];
  for (const item of ranked) {
    const count = counts.get(item.job.company) ?? 0;
    if (primary.length < TOP_WINDOW_SIZE && count < MAX_PER_COMPANY_IN_TOP_WINDOW) {
      primary.push(item);
      counts.set(item.job.company, count + 1);
    } else {
      demoted.push(item);
    }
  }
  return [...primary, ...demoted];
}
