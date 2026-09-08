// Real hard-constraint + soft-preference matching (US-32/33/34) and ranking
// (US-40/41/42/43) against real Supabase jobs rows. Ports the logic already
// proven in server/src/match.ts + rank.ts to plain JS, since the frontend
// can't directly import those TS/Deno-oriented modules -- the two should be
// kept in sync by hand if the scoring approach changes. Reads the same
// `preferences` object already built in data/store.jsx and `currentUser`
// from data/mockUser.js (classYear), exactly as JobDetail.jsx's existing
// match checklist does for mock jobs -- this is the same logic, now able to
// run against a real job row's field names (city/remote_type/
// relevant_industries instead of location/workMode/industry).
//
// matchJob() is used directly (RealJobDetail.jsx's checklist, and
// pages/Jobs.jsx to compute each card's matchScore). finalScore() below is
// the actual §3.9 ranking formula -- wired into pages/Jobs.jsx's "Best
// match" sort, not just present in the file; a from-scratch, never-called
// version of this used to live here with a different, simpler formula
// than server/src/rank.ts's real one -- see finalScore()'s own comment.

import { canonicalIndustry } from "./careerOptions.js";

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

  // canonicalIndustry(), not raw string equality -- "Strategy consulting"
  // and "Management consulting" are the same real-world work (see that
  // function's comment in data/careerOptions.js), and real jobs only
  // ever get tagged "Management consulting" by the ingestion taxonomy.
  const industryMatch = (job.relevant_industries ?? []).some((i) =>
    preferences.industries.some((p) => canonicalIndustry(p) === canonicalIndustry(i))
  );
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
  score += compMatch ? 10 : 0;

  // Part 10/US-26 -- exact-string match against the member's own Skills
  // picker (My Profile), same as server/src/match.ts's identical factor.
  // preferred_skills used to be always empty in practice (jobInsertFrom
  // Normalized() never mapped it from NormalizedJob.preferredSkills even
  // though the column existed) -- fixed as part of Part 7 Stage 5, so this
  // is now materially non-empty for any job whose title classified to a
  // known O*NET occupation. No logic change needed here: this already read
  // preferred_skills defensively and picks the newly-populated values up
  // automatically.
  const relevantSkills = [...(job.required_skills ?? []), ...(job.preferred_skills ?? [])];
  const matchedSkills = relevantSkills.filter((skill) => preferences.skills.some((s) => s.toLowerCase() === skill.toLowerCase()));
  factors.push({
    key: "skills",
    match: matchedSkills.length > 0,
    label: matchedSkills.length > 0 ? `${matchedSkills.length} relevant skill${matchedSkills.length === 1 ? "" : "s"}: ${matchedSkills.join(", ")}` : "No relevant skills listed on your profile",
  });
  score += relevantSkills.length > 0 ? (matchedSkills.length / relevantSkills.length) * 15 : 0;

  return { eligible: true, score: Math.round(score), factors };
}

// US-40/41/42/43 -- the real §3.9 weighted formula:
//   Final Score = w1*Relevance + w2*MemberMatch + w3*Freshness
//               + w4*Quality + w5*DeadlineUrgency + w6*UCRelevance
// This used to be a dead, never-imported `rankJobs()` here that both (a)
// nobody called -- pages/Jobs.jsx's "Best match" sort used raw matchScore
// alone, no freshness/deadline/UC-relevance/quality at all -- and (b) used
// a different, simpler ad-hoc blend than server/src/rank.ts's real,
// tested formula even if it had been wired in. This is the actual port,
// now imported by pages/Jobs.jsx's sortJobs(). Operates on the adapted
// card shape (data/realJobAdapter.js's output), not the raw Supabase row,
// since that's what's available where sorting happens; every field this
// reads (deadlineDate, postedDaysAgo, qualityScore, company) already
// exists on that shape or was added alongside this fix (qualityScore).
const DEFAULT_WEIGHTS = {
  relevance: 0.3,
  memberMatch: 0.3,
  ucRelevance: 0.15,
  deadlineUrgency: 0.15,
  freshness: 0.05,
  quality: 0.05,
};

// Same mild decay as server/src/rank.ts's freshnessScore: full score at
// <=7 days, tapering to 0 by 90 days. Reads the already-derived
// postedDaysAgo instead of re-diffing posted_date, since that's what the
// adapted card shape carries.
function freshnessScore(job) {
  if (job.postedDaysAgo == null) return 0.5;
  return Math.max(0, Math.min(1, 1 - job.postedDaysAgo / 90));
}

// Same shape as server/src/rank.ts's deadlineUrgencyScore. `deadlineDate`
// is null exactly when the card's own `rolling` flag is true (data/
// realJobAdapter.js), so this needs no separate rolling check.
function deadlineUrgencyScore(job, now) {
  if (!job.deadlineDate) return 0.3; // no deadline listed -- mildly deprioritized vs. a real one, never 0
  const days = (new Date(job.deadlineDate) - now) / 86400000;
  if (days < 0) return 0;
  return Math.max(0, Math.min(1, 1 - days / 30));
}

// US-42 -- same Stage-1 stand-in server/src/rank.ts uses (§3.6's real CRM-
// backed signal isn't available at the per-job ranking layer yet): reads
// whatever's already on the member's own profile.
function ucRelevanceScore(job, preferences) {
  return preferences.followedCompanies?.includes(job.company) ? 1 : 0.3;
}

// US-38/§3.8 -- when a keyword query is active, score how many of its
// tokens actually appear in the role/company text; neutral (0.5) when
// browsing without one, same as server/src/rank.ts's default. Jobs.jsx's
// own keyword filter already *excludes* non-matching jobs outright (a
// harder guarantee than a soft score), so this only differentiates among
// jobs that already passed that filter -- it's not a substitute for it.
function textRelevanceScore(job, query) {
  const q = query?.trim().toLowerCase();
  if (!q) return 0.5;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0.5;
  const haystack = `${job.role} ${job.company}`.toLowerCase();
  const hits = tokens.filter((t) => haystack.includes(t)).length;
  return hits / tokens.length;
}

// Per-job final score (0-1) for ranking/sort order -- distinct from
// job.matchScore (0-100), which stays the pure preference-fit percentage
// shown on cards/checklists per US-34 and is deliberately left unchanged
// by this. Only sort order should reflect freshness/deadline/quality/UC-
// relevance too; what's *displayed* as "this member's % match" should
// keep meaning exactly what it says.
export function finalScore(job, preferences, query, now = new Date(), weights = DEFAULT_WEIGHTS) {
  return (
    weights.relevance * textRelevanceScore(job, query) +
    weights.memberMatch * (job.matchScore / 100) +
    weights.ucRelevance * ucRelevanceScore(job, preferences) +
    weights.deadlineUrgency * deadlineUrgencyScore(job, now) +
    weights.freshness * freshnessScore(job) +
    weights.quality * (job.qualityScore ?? 0.5)
  );
}
