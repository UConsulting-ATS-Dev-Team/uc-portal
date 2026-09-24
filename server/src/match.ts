import type { MatchFactor, MatchResult, MemberProfile, NormalizedJob } from "./types.js";

// "Strategy consulting" and "Management consulting" are the same
// real-world work, just named differently depending who's describing it
// -- mirrors data/careerOptions.js's canonicalIndustry() on the frontend
// (kept in sync by hand per this file's own header, not a shared import,
// since this package and the frontend don't share a module system).
// Real ingested jobs only ever get tagged "Management consulting" by the
// taxonomy, so without this a profile preferring "Strategy consulting"
// would never match one.
const INDUSTRY_SYNONYMS: Record<string, string> = {
  "Strategy consulting": "Management consulting",
};

function canonicalIndustry(name: string): string {
  return INDUSTRY_SYNONYMS[name] ?? name;
}

// Mirrors data/jobMatch.js's INDUSTRY_TITLE_PATTERNS/industryTitleHit()
// (2026-09-23) -- see that file's own comment for the full rationale.
// Kept in sync by hand, same as everything else in this file.
const INDUSTRY_TITLE_PATTERNS: Record<string, RegExp[]> = {
  "Management consulting": [/consult/i, /\bstrategy analyst\b/i, /\bmanagement analyst\b/i],
  "Technology consulting": [/technology consult/i, /\bit consult/i, /digital consult/i],
  "Human capital consulting": [/human capital/i, /organi[sz]ational consult/i, /talent consult/i],
  "Investment banking": [/investment bank/i, /\bibd\b/i, /\bm&a\b/i, /\bmergers\b/i],
  "Private equity": [/private equity/i, /\bpe\b analyst/i],
  "Venture capital": [/venture capital/i, /\bvc\b analyst/i],
  "Hedge funds / asset management": [/hedge fund/i, /asset management/i, /portfolio (analyst|manager)/i],
  "Corporate finance / FP&A": [/\bfp&a\b/i, /corporate finance/i, /financial planning/i],
  "Commercial & retail banking": [/commercial bank/i, /retail bank/i],
  Fintech: [/fintech/i],
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
  Cybersecurity: [/cybersecurity/i, /security engineer/i, /\binfosec\b/i],
  "Consumer goods & retail": [/consumer goods/i, /\bretail\b/i, /\bcpg\b/i],
  "Media & entertainment": [/\bmedia\b/i, /entertainment/i, /content strategy/i],
  "Energy & sustainability": [/\benergy\b/i, /sustainab/i, /renewable/i],
  Healthcare: [/healthcare/i, /health care/i, /clinical/i, /pharma/i],
  "Real estate": [/real estate/i],
  "Nonprofit / public sector": [/nonprofit/i, /non-profit/i, /public sector/i, /government affairs/i],
};

function industryTitleHit(industryPref: string, title: string): boolean {
  if (!title) return false;
  const patterns = INDUSTRY_TITLE_PATTERNS[canonicalIndustry(industryPref)];
  return patterns?.some((p) => p.test(title)) ?? false;
}

// US-32/33/34 -- job-member matching. Hard constraints filter out entirely
// (§3.9); soft preferences only affect score. Every factor is returned
// alongside the score so it's always explainable (US-34) -- mirrors the
// existing prototype's Job detail match checklist and Odds Model factor
// table, which already do exactly this for the frontend.
export function matchJob(job: NormalizedJob, profile: MemberProfile): MatchResult {
  const factors: MatchFactor[] = [];

  // --- Hard constraints (US-33) ---
  const gradEligible = !job.graduationYears || job.graduationYears.includes(profile.graduationYear);
  factors.push({
    key: "graduationYear",
    label: `Graduation year ${profile.graduationYear}`,
    match: gradEligible,
    detail: job.graduationYears ? `Eligible years: ${job.graduationYears.join(", ")}` : "No graduation-year requirement listed",
  });

  // An unclassified employment type is neither confirmed-eligible nor
  // confirmed-ineligible -- treat it as ineligible for a specific filter
  // (never guess "yes" on missing data) but always eligible for "Both".
  const typeEligible =
    profile.opportunityType === "Both" ||
    (profile.opportunityType === "Internship" && job.employmentType === "internship") ||
    (profile.opportunityType === "Full-time" && job.employmentType === "full_time");

  const eligible = gradEligible && typeEligible;
  if (!eligible) {
    return { eligible: false, score: 0, factors };
  }

  // --- Soft preferences (§3.9) -- graduated + applicability-gated ---
  // Ported from data/jobMatch.js's 2026-09-23 redesign -- see that file's
  // own header comment on matchJob() for the full rationale (member
  // report: every job showed the same 75% match, root-caused to binary
  // pass/fail factors that flatten once a job board is already
  // pre-filtered toward relevant postings). Keep both in sync by hand.
  const FACTOR_WEIGHTS: Record<string, number> = { industry: 30, role: 25, location: 20, compensation: 10, skills: 15 };

  let industryFrac: number | null = null;
  if (profile.industries.length > 0) {
    let bestRank = -1;
    profile.industries.forEach((pref, rank) => {
      const hit =
        job.relevantIndustries.some((i) => canonicalIndustry(i) === canonicalIndustry(pref)) || industryTitleHit(pref, job.title);
      if (hit && (bestRank === -1 || rank < bestRank)) bestRank = rank;
    });
    industryFrac = bestRank === -1 ? 0 : 1 - bestRank / profile.industries.length;
  }
  factors.push({
    key: "industry",
    label: "Target industry",
    match: (industryFrac ?? 0) > 0,
    detail: job.relevantIndustries.join(", ") || "Not classified",
  });

  let roleFrac: number | null = null;
  if (profile.roles.length > 0) {
    const hits = profile.roles.filter(
      (pr) => job.relevantRoles.some((r) => r.toLowerCase().includes(pr.toLowerCase())) || job.title.toLowerCase().includes(pr.toLowerCase())
    );
    roleFrac = hits.length / profile.roles.length;
  }
  factors.push({ key: "role", label: "Target role", match: (roleFrac ?? 0) > 0, detail: job.title });

  let locationFrac: number | null = null;
  if (profile.locations.length > 0 || profile.remoteOrHybridOnly || profile.openToRelocating) {
    locationFrac =
      (!!job.city && profile.locations.includes(job.city)) ||
      (profile.remoteOrHybridOnly && (job.remoteType === "remote" || job.remoteType === "hybrid")) ||
      profile.openToRelocating
        ? 1
        : 0;
  }
  factors.push({
    key: "location",
    label: "Target location",
    match: (locationFrac ?? 0) > 0,
    detail: job.city ?? job.remoteType ?? "Unknown",
  });

  // Applicable when the JOB lists a real salary, not when compTarget
  // "looks unset" -- it never is (profile.compTarget always has a real
  // default value from onboarding), so that can't distinguish a
  // deliberate target from an untouched default.
  let compFrac: number | null = null;
  if (job.salaryMin != null) {
    compFrac = job.salaryMin >= profile.compTarget ? 1 : 0;
  }
  factors.push({
    key: "compensation",
    label: "Compensation target",
    match: (compFrac ?? 0) > 0,
    detail: job.compensationText ?? "Not listed",
  });

  const relevantSkills = [...(job.requiredSkills ?? []), ...(job.preferredSkills ?? [])];
  let skillsFrac: number | null = null;
  let matchedSkills: string[] = [];
  if (profile.skills.length > 0 && relevantSkills.length > 0) {
    matchedSkills = relevantSkills.filter((skill) => profile.skills.some((s) => s.toLowerCase() === skill.toLowerCase()));
    skillsFrac = matchedSkills.length / relevantSkills.length;
  }
  factors.push({
    key: "skills",
    label: `${matchedSkills.length} relevant skill${matchedSkills.length === 1 ? "" : "s"}`,
    match: matchedSkills.length > 0,
    detail: matchedSkills.join(", ") || "None matched",
  });

  const applicable = (
    [
      ["industry", industryFrac],
      ["role", roleFrac],
      ["location", locationFrac],
      ["compensation", compFrac],
      ["skills", skillsFrac],
    ] as [string, number | null][]
  ).filter(([, frac]) => frac !== null) as [string, number][];

  let score: number;
  if (applicable.length === 0) {
    score = 50; // no evidence either way -- neutral, not a false 0 or 100
  } else {
    const totalWeight = applicable.reduce((sum, [key]) => sum + FACTOR_WEIGHTS[key], 0);
    const weightedSum = applicable.reduce((sum, [key, frac]) => sum + FACTOR_WEIGHTS[key] * frac, 0);
    score = Math.round((weightedSum / totalWeight) * 100);
  }

  return { eligible: true, score, factors };
}
