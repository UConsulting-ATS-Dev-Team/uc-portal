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
import { DEFAULT_COMPANY_TIER } from "./companyTiers.js";

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

// Each soft-preference factor's max weight -- unchanged from the original
// flat version, kept as a named map now that scoring is graduated/
// applicability-gated rather than "matched ? weight : 0" per factor.
const FACTOR_WEIGHTS = { industry: 30, role: 25, location: 20, compensation: 10, skills: 15 };

// 2026-09-23 follow-up to the graduated-scoring redesign above: live
// verification found the redesign was correct but couldn't fully solve
// the reported flatness on its own, because ~76% of real active jobs
// have empty relevant_industries/relevant_roles entirely (confirmed
// directly against the database: 2,159 of 9,237). Those come from
// server/src/taxonomy/occupationTaxonomy.ts, a deliberately small,
// hand-curated stub covering only a handful of occupations -- most real
// titles just don't match any of its patterns, so most jobs get no
// structured tag at all, and even the ones that do often collapse to a
// handful of shared, generic tag combinations (a sample of 30 classified
// jobs had only 6 unique combinations).
//
// This adds a second, title-text-based signal that reads the job's own
// title directly rather than relying solely on that structured tag --
// gives real per-job differentiation even for unclassified postings,
// since two different job titles almost never read identically even
// when the taxonomy stub would've tagged them the same (or not at all).
// Deliberately NOT a duplicate of the real taxonomy (that's Deno-only,
// ingestion-time, and covers far more per-occupation detail -- skills,
// knowledge domains, O*NET codes -- than a fallback relevance signal
// needs); this is a small, purpose-built keyword map loosely informed by
// that same taxonomy's category groupings. Role needs no such map --
// preferences.roles is already title-like text ("Consultant", "Product
// Manager"), so a direct substring check against job.title works as-is.
// Only job.title is used, not description -- JOB_LIST_COLUMNS (data/
// realJobAdapter.js) doesn't fetch description on the list view, and
// matchJob() has to score identically regardless of which page called it.
const INDUSTRY_TITLE_PATTERNS = {
  "Management consulting": [/consult/i, /\bstrategy analyst\b/i, /\bmanagement analyst\b/i],
  "Technology consulting": [/technology consult/i, /\bit consult/i, /digital consult/i],
  "Human capital consulting": [/human capital/i, /organi[sz]ational consult/i, /talent consult/i],
  "Investment banking": [/investment bank/i, /\bibd\b/i, /\bm&a\b/i, /\bmergers\b/i],
  "Private equity": [/private equity/i, /\bpe\b analyst/i],
  "Venture capital": [/venture capital/i, /\bvc\b analyst/i],
  "Hedge funds / asset management": [/hedge fund/i, /asset management/i, /portfolio (analyst|manager)/i],
  "Corporate finance / FP&A": [/\bfp&a\b/i, /corporate finance/i, /financial planning/i],
  "Commercial & retail banking": [/commercial bank/i, /retail bank/i],
  "Fintech": [/fintech/i],
  "Insurance & actuarial": [/actuar/i, /insurance/i],
  "Marketing & brand strategy": [/marketing/i, /brand (strategy|manager)/i],
  "Corporate strategy & business development": [/corporate strategy/i, /business development/i, /\bbiz dev\b/i],
  "Product management": [/product (manager|management)/i, /\btpm\b/i],
  "Operations & supply chain": [/\boperations\b/i, /supply chain/i, /logistics/i],
  "Sales & business development": [/\bsales\b/i, /account executive/i, /business development/i],
  "Human resources / people operations": [/human resources/i, /people operations/i, /\bhr\b/i, /talent acquisition/i],
  "Tech / product strategy": [/product strategy/i, /technology strategy/i],
  "Data & analytics": [/data analy/i, /data scien/i, /\banalytics\b/i],
  "Software engineering": [/software engineer/i, /software develop/i, /\bswe\b/i],
  "Cybersecurity": [/cybersecurity/i, /security engineer/i, /\binfosec\b/i],
  "Consumer goods & retail": [/consumer goods/i, /\bretail\b/i, /\bcpg\b/i],
  "Media & entertainment": [/\bmedia\b/i, /entertainment/i, /content strategy/i],
  "Energy & sustainability": [/\benergy\b/i, /sustainab/i, /renewable/i],
  "Healthcare": [/healthcare/i, /health care/i, /clinical/i, /pharma/i],
  "Real estate": [/real estate/i],
  "Nonprofit / public sector": [/nonprofit/i, /non-profit/i, /public sector/i, /government affairs/i],
};

function industryTitleHit(industryPref, title) {
  if (!title) return false;
  const patterns = INDUSTRY_TITLE_PATTERNS[canonicalIndustry(industryPref)];
  return patterns?.some((p) => p.test(title)) ?? false;
}

// --- Soft preferences (US-33/34): affect score only, always explainable ---
//
// Redesigned 2026-09-23 (direct report: "the match percentages are all
// 75%, how can we differentiate these even when people haven't filled
// out the things weighted in the algorithm"). Root cause, confirmed by
// reading the formula rather than guessing: industry/role/location were
// all binary pass/fail, and the job board is already pre-filtered toward
// UC-relevant companies -- so once a member's onboarding answers are
// broad enough to satisfy those three checks (common: most members pick
// "Management consulting", a lenient substring role match, and either a
// few big-city locations or "open to relocating"), every job lands on
// the exact same 30+25+20=75, with compensation/skills both usually
// contributing their own constant (0 for most jobs, which don't list a
// salary or get matched against a member's -- rarely filled -- Skills
// picker). Two real fixes, not one:
//
// 1. Industry/role are now graduated, not binary. Industry is a *ranked*
//    preference (up to 3, from onboarding) -- matching a member's #1
//    pick counts more than matching their #3. Role scores by what
//    fraction of the member's selected role chips the job actually
//    satisfies, not just "at least one."
// 2. Every factor is now "applicable" or not, based on whether there's
//    real data to check on the relevant side -- a missing MEMBER
//    preference (empty industries/roles/locations/skills) excludes that
//    factor from the score entirely (renormalized among whichever
//    factors *do* apply) instead of silently contributing 0 and
//    dragging every sparse profile toward the same floor. Compensation
//    is the one exception: compTarget always has a real value (defaults
//    to $35/hr, never null), so applicability there is gated on the JOB
//    listing a real salary_min instead -- otherwise there's nothing to
//    check regardless of what the member's target is.
//
// If literally nothing is applicable (an entirely empty profile against
// a job with no classified data at all), the score is a neutral 50 --
// not a false 0 (which would read as "bad fit" with zero evidence
// either way) and not the old false-100-style inflation.
export function matchJob(job, preferences, classYear) {
  const factors = [];
  const eligible = isEligible(job, preferences, classYear);

  factors.push({
    key: "graduationYear",
    match: !job.graduation_years?.length || job.graduation_years.includes(classYear),
    label: job.graduation_years?.length ? `Eligible years: ${job.graduation_years.join(", ")}` : "No graduation-year requirement listed",
  });

  if (!eligible) return { eligible: false, score: 0, factors };

  // canonicalIndustry(), not raw string equality -- "Strategy consulting"
  // and "Management consulting" are the same real-world work (see that
  // function's comment in data/careerOptions.js), and real jobs only
  // ever get tagged "Management consulting" by the ingestion taxonomy.
  // A preference counts as hit by EITHER the structured tag or the
  // title-text keyword signal (industryTitleHit(), see its own comment
  // above) -- most real jobs have no structured tag at all, so relying
  // on that alone left most of the board undifferentiated.
  let industryFrac = null;
  if (preferences.industries.length > 0) {
    let bestRank = -1;
    preferences.industries.forEach((pref, rank) => {
      const hit =
        (job.relevant_industries ?? []).some((i) => canonicalIndustry(i) === canonicalIndustry(pref)) ||
        industryTitleHit(pref, job.title);
      if (hit && (bestRank === -1 || rank < bestRank)) bestRank = rank;
    });
    industryFrac = bestRank === -1 ? 0 : 1 - bestRank / preferences.industries.length;
  }
  factors.push({
    key: "industry",
    match: (industryFrac ?? 0) > 0,
    label: job.relevant_industries?.join(", ") || "Not classified",
  });

  // Same EITHER-signal approach for role -- preferences.roles is already
  // title-like text ("Consultant", "Product Manager"), so a direct
  // substring check against the job's own title needs no keyword map.
  let roleFrac = null;
  if (preferences.roles.length > 0) {
    const hits = preferences.roles.filter(
      (pr) =>
        (job.relevant_roles ?? []).some((r) => r.toLowerCase().includes(pr.toLowerCase())) ||
        (job.title ?? "").toLowerCase().includes(pr.toLowerCase())
    );
    roleFrac = hits.length / preferences.roles.length;
  }
  factors.push({ key: "role", match: (roleFrac ?? 0) > 0, label: job.title });

  let locationFrac = null;
  if (preferences.locations.length > 0 || preferences.remoteOrHybridOnly || preferences.openToRelocating) {
    locationFrac =
      (!!job.city && preferences.locations.includes(job.city)) ||
      (preferences.remoteOrHybridOnly && (job.remote_type === "remote" || job.remote_type === "hybrid")) ||
      preferences.openToRelocating
        ? 1
        : 0;
  }
  factors.push({ key: "location", match: (locationFrac ?? 0) > 0, label: job.city ?? job.remote_type ?? "Unknown" });

  // Applicability gated on the JOB listing a real number, not on whether
  // the member's compTarget "looks unset" -- it never is (defaults to
  // $35/hr from onboarding, see data/store.jsx's DEFAULT_STATE), so that
  // can't distinguish a deliberate target from an untouched default.
  let compFrac = null;
  if (job.salary_min != null) {
    compFrac = job.salary_min >= preferences.compTarget ? 1 : 0;
  }
  factors.push({ key: "compensation", match: (compFrac ?? 0) > 0, label: job.compensation_text ?? "Not listed" });

  // Part 10/US-26 -- exact-string match against the member's own Skills
  // picker (My Profile). preferred_skills used to be always empty in
  // practice (jobInsertFromNormalized() never mapped it from
  // NormalizedJob.preferredSkills even though the column existed) --
  // fixed as part of Part 7 Stage 5, so this is now materially non-empty
  // for any job whose title classified to a known O*NET occupation.
  const relevantSkills = [...(job.required_skills ?? []), ...(job.preferred_skills ?? [])];
  let skillsFrac = null;
  let matchedSkills = [];
  if (preferences.skills.length > 0 && relevantSkills.length > 0) {
    matchedSkills = relevantSkills.filter((skill) => preferences.skills.some((s) => s.toLowerCase() === skill.toLowerCase()));
    skillsFrac = matchedSkills.length / relevantSkills.length;
  }
  factors.push({
    key: "skills",
    match: matchedSkills.length > 0,
    label: matchedSkills.length > 0 ? `${matchedSkills.length} relevant skill${matchedSkills.length === 1 ? "" : "s"}: ${matchedSkills.join(", ")}` : "No relevant skills listed on your profile",
  });

  const applicable = [
    ["industry", industryFrac],
    ["role", roleFrac],
    ["location", locationFrac],
    ["compensation", compFrac],
    ["skills", skillsFrac],
  ].filter(([, frac]) => frac !== null);

  let score;
  if (applicable.length === 0) {
    score = 50; // no evidence either way -- neutral, not a false 0 or 100
  } else {
    const totalWeight = applicable.reduce((sum, [key]) => sum + FACTOR_WEIGHTS[key], 0);
    const weightedSum = applicable.reduce((sum, [key, frac]) => sum + FACTOR_WEIGHTS[key] * frac, 0);
    score = Math.round((weightedSum / totalWeight) * 100);
  }

  return { eligible: true, score, factors };
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

// Direct ask: "Best match" should lean on recency differently by company
// tier -- a T0/T1 posting (core consulting, other elite name-brand) is
// worth applying to even if it's a few days old (a 5-day-old McKinsey
// posting should still usually beat a just-posted role at an
// unclassified company), while T2/T3 postings should favor recency more,
// since there's no scarcity value in an old posting there the way there
// is at a name-brand firm.
//
// First attempt at this varied only *freshness's weight* per tier and
// was wrong: it meant two jobs being compared used entirely different
// weight vectors, and a company's own tier score never entered the
// formula on its own -- freshness had to do double duty as both "how new
// is this" and "how much does this company's prestige matter," and a
// verification script (the user's own exact example: 5-day-old McKinsey
// vs. a same-instant-fresh random company, equal match score) showed the
// random company winning, backwards from the stated intent. Fixed with
// two separate signals instead: a direct companyTierScore (a real, flat
// preference for a better tier, independent of age) plus a *tier-varying
// decay rate* for freshness (not weight -- every job's freshness
// contribution uses the same shared weight, so comparisons stay
// apples-to-apples; only how fast a posting "goes stale" differs by
// tier). Re-verified against the same script before committing to these
// numbers: T0 5-day-old beats T3 same-instant-fresh at equal match, a
// genuinely stale T0 (60d) does eventually cede to a fresh T3 (leeway,
// not immunity), and freshness swings far more sharply within T2/T3
// (fast decay) than within T0/T1 (slow decay).
const TIER_SCORE_BY_TIER = {
  0: 1.0, // core consulting
  1: 0.8, // other elite name-brand
  2: 0.5, // recognizable corporate
  3: 0.25, // everyone else -- also the fallback for an unclassified company
};
const FRESHNESS_DECAY_DAYS_BY_TIER = {
  0: 90, // takes ~3 months to fully "go stale" -- real leeway
  1: 75,
  2: 30, // decays much faster -- recency starts to matter more
  3: 14, // decays fastest -- freshness is the dominant real signal here
};
const TIER_WEIGHT = 0.1;
const FRESHNESS_WEIGHT = 0.12;

function weightsForTier() {
  // A single shared vector, not tier-dependent -- only the two new
  // factors' own *values* (not weights) vary by tier, via
  // TIER_SCORE_BY_TIER / FRESHNESS_DECAY_DAYS_BY_TIER above. Every other
  // factor is scaled proportionally into the remaining budget once,
  // keeping the same relative balance DEFAULT_WEIGHTS already has to
  // itself.
  const scale = (1 - TIER_WEIGHT - FRESHNESS_WEIGHT) / (1 - DEFAULT_WEIGHTS.freshness);
  return {
    relevance: DEFAULT_WEIGHTS.relevance * scale,
    memberMatch: DEFAULT_WEIGHTS.memberMatch * scale,
    ucRelevance: DEFAULT_WEIGHTS.ucRelevance * scale,
    deadlineUrgency: DEFAULT_WEIGHTS.deadlineUrgency * scale,
    quality: DEFAULT_WEIGHTS.quality * scale,
    companyTier: TIER_WEIGHT,
    freshness: FRESHNESS_WEIGHT,
  };
}

function companyTierScore(tier) {
  return TIER_SCORE_BY_TIER[tier] ?? TIER_SCORE_BY_TIER[DEFAULT_COMPANY_TIER];
}

// Same mild-decay shape as server/src/rank.ts's freshnessScore, but the
// decay window itself now depends on the company's tier (see above)
// instead of a flat 90 days for everyone. Reads the already-derived
// postedDaysAgo instead of re-diffing posted_date, since that's what the
// adapted card shape carries.
function freshnessScore(job, tier) {
  if (job.postedDaysAgo == null) return 0.5;
  const decayDays = FRESHNESS_DECAY_DAYS_BY_TIER[tier] ?? FRESHNESS_DECAY_DAYS_BY_TIER[DEFAULT_COMPANY_TIER];
  return Math.max(0, Math.min(1, 1 - job.postedDaysAgo / decayDays));
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
//
// tierByCompany (data/companyTiers.js's fetchCompanyTiers() result) is
// optional -- omitting it (or a company that isn't in the map) falls
// back to DEFAULT_COMPANY_TIER's own weights, same "cap conservatively
// rather than crash" fallback pages/Jobs.jsx's capPerCompany already
// uses for the identical lookup.
export function finalScore(job, preferences, query, now = new Date(), tierByCompany = null) {
  const tier = tierByCompany?.get(job.company) ?? DEFAULT_COMPANY_TIER;
  const weights = weightsForTier();
  return (
    weights.relevance * textRelevanceScore(job, query) +
    weights.memberMatch * (job.matchScore / 100) +
    weights.ucRelevance * ucRelevanceScore(job, preferences) +
    weights.deadlineUrgency * deadlineUrgencyScore(job, now) +
    weights.quality * (job.qualityScore ?? 0.5) +
    weights.companyTier * companyTierScore(tier) +
    weights.freshness * freshnessScore(job, tier)
  );
}
