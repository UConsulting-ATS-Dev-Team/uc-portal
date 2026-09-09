// Mirror of supabase/functions/_shared/pipeline/companyCap.ts -- keep both
// copies in sync (same discipline as relevance.ts's mirror, see its own
// header comment and JOB_ENGINE_ARCHITECTURE.md's US-56/US-09 writeup on
// two copies of the same pipeline logic drifting apart). Exists so
// server/tests/companyCap.test.ts can exercise the exact tiering/cap logic
// the deployed Edge Functions run.
//
// Part 2 of the 2026-08-27 rescope (see JOB_ENGINE_ARCHITECTURE.md's dated
// entry) -- per-company active-job cap. Part 1 fixed *what kind* of job is
// relevant; this fixes *how many* postings from one employer are allowed to
// crowd out everyone else. The user's explicit direction: "I want to focus
// more on having more companies rather than few companies with tons of
// jobs" -- Stripe (544 active), Carvana, Databricks etc. were each already
// far past any reasonable per-company share of a board meant to represent
// a growing roster of employers, not a handful of very deep ones.
//
// Deactivate (active=false), never delete -- these are valid, real,
// relevant postings that are merely over quota, categorically different
// from Part 1's targets (categorically wrong postings for this product).
// Deactivating preserves the record (provenance, job_sources history,
// dedup/duplicate_candidates references) and makes the decision
// reversible later (e.g. raising the cap, or a company's other postings
// expiring and freeing up room) without re-fetching anything.
//
// ---- Tier design ----
//
// Ranks which postings survive the cut using the real `job_functions`
// taxonomy already seeded in the database (Consulting, Investment
// Banking, Marketing, Operations, Product Management, Software
// Engineering) -- NOT the broader wishlist of categories floated when
// this was scoped (Strategy, Private Equity, Data/Analytics, Sales).
// Those aren't distinct rows in job_functions today, and don't need to
// be: occupationTaxonomy.ts already folds Strategy into the Consulting
// classification (its "consulting" pattern includes /strategy/i) and
// Private Equity into Investment Banking (its "investment banking"
// pattern includes /private equity/i) -- a posting classified via either
// keyword already lands in the tier its literal name would suggest.
// Data Analyst is a relevantRole *under* Software Engineering, not a
// function of its own, and no occupation stub currently maps anything to
// "Sales" -- it's listed in the mid tier below for documentation
// completeness/future-proofing (in case a real O*NET integration or a
// new occupation stub adds it later) but is a no-op today.
//
// Three tiers, matching the user's stated priority order verbatim
// ("consulting, investment banking, tech, finance... marketing/sales/
// operations... unclassified" from lowest to highest priority in their
// own phrasing, inverted here to rank highest-priority first):
//
//   Tier 0 (top) -- Consulting, Investment Banking, Software Engineering,
//     Product Management. The verticals UC Portal exists for: consulting/
//     IB (incl. strategy/PE per the classifier notes above) and tech
//     (software engineering + product management).
//   Tier 1 (mid) -- Marketing, Operations, Sales. Real corporate
//     functions, legitimately white-collar (Part 1 already filters out
//     manual-trade/clinical work), just not what UC members are
//     primarily recruiting for.
//   Tier 2 (bottom) -- unclassified (job_function_id is null). This is
//     the largest tier for nearly every company today -- Part 1's own
//     writeup found O*NET classification coverage is low across the
//     board (Stripe 26%, Databricks 7.5%, Charlie Health 2.8%), and a
//     live query while building this (2026-08-27) confirmed it
//     company-wide: 1,734 of 2,198 active jobs (79%) are unclassified.
//     That's expected, not a bug -- classification coverage is a ranking
//     *signal* here (a proxy for "we could confidently place this in a
//     priority vertical"), never a relevance gate the way Part 1's
//     denylists are. An unclassified posting can absolutely still be a
//     genuinely relevant white-collar role; it just loses ties to a
//     classified one when a company is over quota.
//
// Within a tier: quality_score (US-15's completeness/confidence
// composite) descending, then posted_date descending as the final
// tiebreak -- a more recently posted req is more likely to reflect the
// company's current hiring needs than an old one with an equally thin
// profile. A stable id comparison breaks any remaining tie so the
// ordering (and therefore which ids are "excess") is fully deterministic
// -- required for idempotency: re-running this against an unchanged
// active set must always compute the same excess, not reshuffle it.

export const MAX_ACTIVE_JOBS_PER_COMPANY = 30;

const TOP_TIER_JOB_FUNCTIONS = new Set(["Consulting", "Investment Banking", "Software Engineering", "Product Management"]);
const MID_TIER_JOB_FUNCTIONS = new Set(["Marketing", "Operations", "Sales"]);

export function tierForJobFunction(jobFunctionName: string | null | undefined): number {
  if (jobFunctionName && TOP_TIER_JOB_FUNCTIONS.has(jobFunctionName)) return 0;
  if (jobFunctionName && MID_TIER_JOB_FUNCTIONS.has(jobFunctionName)) return 1;
  return 2;
}

export interface CompanyCapCandidate {
  id: string;
  jobFunctionName: string | null;
  qualityScore: number | null;
  postedDate: string | null; // ISO date (YYYY-MM-DD), or null
}

function compareCapCandidates(a: CompanyCapCandidate, b: CompanyCapCandidate): number {
  const tierDiff = tierForJobFunction(a.jobFunctionName) - tierForJobFunction(b.jobFunctionName);
  if (tierDiff !== 0) return tierDiff;

  const qualityDiff = (b.qualityScore ?? 0) - (a.qualityScore ?? 0);
  if (qualityDiff !== 0) return qualityDiff;

  const aDate = a.postedDate ?? "";
  const bDate = b.postedDate ?? "";
  if (aDate !== bDate) return aDate > bDate ? -1 : 1; // more recent first

  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; // deterministic final tiebreak
}

// Best-to-worst ordering -- survivors are the first `cap` entries.
export function rankForCompanyCap(candidates: CompanyCapCandidate[]): CompanyCapCandidate[] {
  return [...candidates].sort(compareCapCandidates);
}

// The ids to deactivate to bring a company back under `cap` -- empty if
// already at or under it. Pure and deterministic: the same candidate set
// always produces the same excess, which is what makes it safe to call
// on every single fetch run (not just a one-time retroactive cleanup) --
// a company already at/under the cap is a guaranteed no-op, never a
// reshuffle of who's currently active.
export function idsExceedingCompanyCap(
  candidates: CompanyCapCandidate[],
  cap: number = MAX_ACTIVE_JOBS_PER_COMPANY,
): string[] {
  if (candidates.length <= cap) return [];
  return rankForCompanyCap(candidates)
    .slice(cap)
    .map((c) => c.id);
}

// ---- Company-tier cap (2026-09-09 addition) ----
// A second, independent axis on top of everything above. tierForJobFunction
// ranks WHICH postings survive within one company; this decides HOW MANY a
// company is even allowed before that ranking kicks in, based on how
// relevant the company itself is to UC -- direct product direction: "only
// the really relevant consulting/similar companies can get over 10 job
// postings... definitely want to go off name brand relevance," with core
// consulting broken out as its own top tier above other elite name-brand
// companies (a real Bain-vs-Goldman priority order, not just "famous or
// not"). The two axes compose: a tier-0 company's non-consulting postings
// (e.g. a Big 4 firm's audit/tax reqs) still lose the tierForJobFunction
// tiebreak to its own actually-consulting postings if it's ever over its
// (generous) tier cap.
//
// The company -> tier mapping itself lives in the `company_tiers` table,
// not a hardcoded map here, because it has to be read from two runtimes
// with no shared import path -- the Deno Edge Functions (ingestion-side
// enforcement) and the React frontend's own display cap
// (data/jobUtils.js's capPerCompany). See
// supabase/migrations/20260909070000_company_tiers.sql for the seeded list,
// the full tiering rationale, and every individual judgment call.
//
//   Tier 0 -- core consulting (MBB, Big 4 advisory arms, boutique/economic
//     consulting) -- cap 25
//   Tier 1 -- other elite name-brand (bulge-bracket/elite-boutique IB,
//     Citadel-tier quant, marquee big tech/AI, major VC) -- cap 15
//   Tier 2 -- recognizable corporate/finance-adjacent -- cap 10
//   Tier 3 -- everyone else -- cap 3. Also the DEFAULT for any company not
//     present in company_tiers (most likely a newly-sourced one) --
//     capForCompanyTier falls back here rather than erroring or leaving a
//     new company uncapped.
export const DEFAULT_COMPANY_TIER = 3;
export const TIER_CAPS: Record<number, number> = { 0: 25, 1: 15, 2: 10, 3: 3 };

export function capForCompanyTier(tier: number | null | undefined): number {
  return TIER_CAPS[tier ?? DEFAULT_COMPANY_TIER] ?? TIER_CAPS[DEFAULT_COMPANY_TIER];
}
