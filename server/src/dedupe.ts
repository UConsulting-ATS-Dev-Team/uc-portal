import type { DuplicateCandidate, DuplicateSignal, NormalizedJob } from "./types.js";

// US-16/17/18 -- multi-signal duplicate scoring, per §3.3's three-tier
// design: >=90 auto-merge, 70-89 admin review, <70 treated as distinct jobs
// with no action taken. The one hard rule from that section, enforced
// explicitly below rather than left to arithmetic: two records never
// auto-merge on title similarity alone -- that's exactly what would
// incorrectly merge "Marketing Intern at Bain" with "Marketing Intern at BCG."

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
function normalizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`.replace(/\/$/, "").toLowerCase();
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
