import type { DuplicateCandidate, DuplicateSignal, NormalizedJob } from "./types.ts";

// Ported unchanged from server/src/dedupe.ts (US-19's mergeJobs() omitted --
// this Edge Function doesn't do full field-level merging yet, see index.ts's
// header comment for why that's an intentionally deferred follow-on, not an
// oversight). §3.3's three-tier design: >=90 auto-merge, 70-89 admin review,
// <70 treated as distinct jobs with no action taken. The one hard rule from
// that section, enforced explicitly below rather than left to arithmetic:
// two records never auto-merge on title similarity alone -- that's exactly
// what would incorrectly merge "Marketing Intern at Bain" with "Marketing
// Intern at BCG."

const STOPWORDS = new Set(["a", "an", "the", "and", "or", "of", "for", "to", "in", "at", "on", "with"]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t && !STOPWORDS.has(t))
  );
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
    matched: companyMatch && titleSimilarity >= 0.6 && locationMatch,
    detail: `company=${companyMatch}, titleSimilarity=${titleSimilarity.toFixed(2)}, location=${locationMatch}`,
  });

  const dateSalaryMatch = postingDateClose(a, b) && salaryMatches(a, b);
  signals.push({ name: "posting_date_salary", matched: dateSalaryMatch });

  let score: number;
  if (canonicalUrlMatch || sourceJobIdMatch) {
    // Near-certain on its own -- §3.3 signal #1/#2.
    score = 100;
  } else if (companyMatch && titleSimilarity >= 0.85 && locationMatch) {
    // The only path into the auto-merge tier that isn't a URL/ID match --
    // always three signals combined, never title similarity in isolation.
    score = 92;
  } else if (companyMatch && titleSimilarity >= 0.6 && locationMatch) {
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
