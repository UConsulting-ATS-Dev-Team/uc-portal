import type { DuplicateCandidate, DuplicateSignal, NormalizedJob } from "./types.js";

// US-16/17/18 -- multi-signal duplicate scoring, per §3.3's three-tier
// design: >=90 auto-merge, 70-89 admin review, <70 treated as distinct jobs
// with no action taken. The one hard rule from that section, enforced
// explicitly below rather than left to arithmetic: two records never
// auto-merge on title similarity alone -- that's exactly what would
// incorrectly merge "Marketing Intern at Bain" with "Marketing Intern at BCG."

const STOPWORDS = new Set(["a", "an", "the", "and", "or", "of", "for", "to", "in", "at", "on", "with"]);

// Memoized by exact title string -- found necessary running this against a
// real 820-posting single-company backfill (fetch-greenhouse-companies):
// findDuplicates()/an adapter's own dedup loop calls scoreDuplicate(new,
// existing) once per existing job, and `new`'s title is identical across
// every one of those calls, so re-tokenizing it from scratch every time
// (regex replace + split + Set construction) was pure redundant work at
// O(n) repetitions for what should be O(1). This alone was enough to trip
// Supabase's Edge Function compute limit on a single large company, before
// even considering cross-company volume. Safe to cache indefinitely within
// a process's lifetime -- the input vocabulary (real job titles) is bounded
// in practice, nowhere near large enough to matter memory-wise.
const tokenizeCache = new Map<string, Set<string>>();

function tokenize(text: string): Set<string> {
  const cached = tokenizeCache.get(text);
  if (cached) return cached;
  const tokens = new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t && !STOPWORDS.has(t))
  );
  tokenizeCache.set(text, tokens);
  return tokens;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const intersectionSize = [...a].filter((x) => b.has(x)).length;
  const unionSize = new Set([...a, ...b]).size;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

// Returns null for a URL that doesn't parse -- a malformed URL should never
// register a canonical-URL match against another malformed URL just because
// their raw text happens to collide (e.g. two unrelated invalid records both
// literally reading "not a real url"). Comparing invalid data as if it were
// meaningful is exactly how a false duplicate slips through.
//
// Includes the query string -- found via the Stage 3 Greenhouse pilot
// against real Stripe data: every one of Stripe's 575 postings shares the
// identical path (stripe.com/jobs/search) and is distinguished only by a
// ?gh_jid=<id> query param (their careers site is a client-side router).
// Dropping the query string, as this function originally did, made all 575
// look like the same canonical URL -- 574 of them auto-merged into one job
// on first deploy. Query strings can also be irrelevant tracking params on
// other sites, but that failure mode (two genuine duplicates falling to a
// lower match tier instead of auto-merging) is far safer than this one.
function normalizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}${parsed.search}`.replace(/\/$/, "").toLowerCase();
  } catch {
    return null;
  }
}

function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\b(inc|llc|co|corp|company)\b/g, "")
    .trim();
}

function locationsMatch(a: NormalizedJob, b: NormalizedJob): boolean {
  if (a.remoteType === "remote" && b.remoteType === "remote") return true;
  return !!a.city && !!b.city && a.city.toLowerCase() === b.city.toLowerCase();
}

function postingDateClose(a: NormalizedJob, b: NormalizedJob, withinDays = 3): boolean {
  if (!a.postedDate || !b.postedDate) return false;
  const diffDays = Math.abs(new Date(a.postedDate).getTime() - new Date(b.postedDate).getTime()) / 86400000;
  return diffDays <= withinDays;
}

function salaryMatches(a: NormalizedJob, b: NormalizedJob): boolean {
  if (a.salaryMin == null || b.salaryMin == null) return false;
  return a.salaryMin === b.salaryMin;
}

// Title-similarity thresholds for the two fuzzy (non-URL/ID) tiers below.
// Raised 2026-09-12 from 0.6/0.85 after a live audit of the real review
// queue: 380 pending candidates had accumulated, ALL from one bulk
// scoring event, ALL scoring exactly 75 (the review band), and 0 of the
// 380 had matching titles -- every single one was two genuinely different
// real postings at the same company/location. Plain Jaccard word-overlap
// on short titles is fooled by shared template scaffolding: "Lead
// Analytics Engineer – Enterprise Data & AI" vs "Lead AI Engineer –
// Enterprise Data & AI" scores 0.83 (Zoox, real pair from that queue)
// even though "Analytics" vs "AI" is the entire distinction between two
// different open reqs -- the shared "Lead ___ Engineer – Enterprise Data
// & AI" scaffolding dominates the ratio. Distribution of the real 380:
// 354 scored below 0.80 (median cluster at 0.60/0.67, all sampled were
// false positives), only 26 reached 0.80-0.83 (a genuinely mixed band --
// some still-distinct roles, a few plausible near-duplicates), and NONE
// reached the old 0.85 auto-merge gate. REVIEW_TITLE_SIMILARITY raised to
// 0.8 (data-driven: clears the observed false-positive cluster, keeps the
// genuinely-uncertain band in front of a human, same review-queue purpose
// as before). AUTO_MERGE_TITLE_SIMILARITY raised to 0.92, a real safety
// margin above the highest false-positive score actually observed (0.83)
// -- auto-merge silently discards the losing candidate's own data with no
// human review at all and no way to audit it after the fact (confirmed:
// a merged job's job_sources rows get reassigned, but the discarded
// candidate's own fields are never preserved anywhere), so this tier
// specifically should err toward "send to review" over "silently merge"
// when the same word-overlap weakness could just as easily produce a
// false positive here too.
const REVIEW_TITLE_SIMILARITY = 0.8;
const AUTO_MERGE_TITLE_SIMILARITY = 0.92;

export function scoreDuplicate(a: NormalizedJob, b: NormalizedJob): DuplicateCandidate {
  const signals: DuplicateSignal[] = [];

  const normalizedUrlA = normalizeUrl(a.applicationUrl);
  const normalizedUrlB = normalizeUrl(b.applicationUrl);
  const canonicalUrlMatch = normalizedUrlA !== null && normalizedUrlA === normalizedUrlB;
  signals.push({ name: "canonical_url", matched: canonicalUrlMatch });

  const sourceJobIdMatch = a.sources.some((sa) =>
    b.sources.some((sb) => sa.sourceId === sb.sourceId && !!sa.sourceJobId && sa.sourceJobId === sb.sourceJobId)
  );
  signals.push({ name: "source_job_id", matched: sourceJobIdMatch });

  const companyMatch = normalizeCompanyName(a.company) === normalizeCompanyName(b.company);
  const titleSimilarity = jaccardSimilarity(tokenize(a.title), tokenize(b.title));
  const locationMatch = locationsMatch(a, b);
  signals.push({
    name: "company_title_location",
    matched: companyMatch && titleSimilarity >= REVIEW_TITLE_SIMILARITY && locationMatch,
    detail: `company=${companyMatch}, titleSimilarity=${titleSimilarity.toFixed(2)}, location=${locationMatch}`,
  });

  const dateSalaryMatch = postingDateClose(a, b) && salaryMatches(a, b);
  signals.push({ name: "posting_date_salary", matched: dateSalaryMatch });

  let score: number;
  if (canonicalUrlMatch || sourceJobIdMatch) {
    // Near-certain on its own -- §3.3 signal #1/#2.
    score = 100;
  } else if (companyMatch && titleSimilarity >= AUTO_MERGE_TITLE_SIMILARITY && locationMatch) {
    // The only path into the auto-merge tier that isn't a URL/ID match --
    // always three signals combined, never title similarity in isolation.
    score = 92;
  } else if (companyMatch && titleSimilarity >= REVIEW_TITLE_SIMILARITY && locationMatch) {
    score = 75; // review band
  } else if (companyMatch && titleSimilarity >= 0.5) {
    score = 65; // below review threshold -- treated as distinct
  } else if (dateSalaryMatch) {
    score = 30; // supporting signal only, per §3.3 -- never decisive alone
  } else {
    score = 0;
  }

  return { jobIdA: a.id, jobIdB: b.id, score, signals };
}

export type DuplicateTier = "auto_merge" | "review" | "distinct";

export function classifyDuplicateTier(score: number): DuplicateTier {
  if (score >= 90) return "auto_merge";
  if (score >= 70) return "review";
  return "distinct";
}

// O(n^2) over the candidate set -- fine at Stage 1's synthetic-dataset scale
// (hundreds of jobs). Revisit (e.g. blocking by normalized company first) if
// this becomes a real bottleneck once ingestion runs continuously.
export function findDuplicates(jobs: NormalizedJob[]): DuplicateCandidate[] {
  const candidates: DuplicateCandidate[] = [];
  for (let i = 0; i < jobs.length; i++) {
    for (let j = i + 1; j < jobs.length; j++) {
      const candidate = scoreDuplicate(jobs[i], jobs[j]);
      if (candidate.score > 0) candidates.push(candidate);
    }
  }
  return candidates;
}

// US-19 -- merge two duplicate jobs, keeping the best available field from
// either and retaining BOTH contributing sources (§8.3 fix) rather than
// collapsing to one. `primary` determines whose storage/redistriction
// restrictions govern the merged record -- callers must pass whichever of
// the two sources is more restrictive, never pick arbitrarily (§8.3's
// "merge can't be used to launder a restriction away" rule).
export function mergeJobs(keep: NormalizedJob, duplicate: NormalizedJob, moreRestrictiveSourceId: string): NormalizedJob {
  const mergedSources = [...keep.sources, ...duplicate.sources].map((s) => ({
    ...s,
    isPrimary: s.sourceId === moreRestrictiveSourceId,
  }));

  return {
    ...keep,
    sources: mergedSources,
    // Prefer whichever record has more complete optional data, field by field.
    description: keep.description ?? duplicate.description,
    salaryMin: keep.salaryMin ?? duplicate.salaryMin,
    salaryMax: keep.salaryMax ?? duplicate.salaryMax,
    graduationYears: keep.graduationYears ?? duplicate.graduationYears,
    requiredSkills: keep.requiredSkills ?? duplicate.requiredSkills,
    qualificationsText: keep.qualificationsText ?? duplicate.qualificationsText,
    firstSeenAt: keep.firstSeenAt < duplicate.firstSeenAt ? keep.firstSeenAt : duplicate.firstSeenAt,
    lastSeenAt: keep.lastSeenAt > duplicate.lastSeenAt ? keep.lastSeenAt : duplicate.lastSeenAt,
  };
}
