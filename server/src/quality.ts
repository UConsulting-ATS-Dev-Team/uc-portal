import type { NormalizedJob } from "./types.js";

// US-14 -- required-field validation. Anything listed here is a hard failure
// (§3.1: "anything needed to display and apply to the job is required").
export interface ValidationIssue {
  field: string;
  issue: string;
}

function isWellFormedUrl(value: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function validateJob(job: NormalizedJob): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!job.company.trim()) issues.push({ field: "company", issue: "missing" });
  if (!job.title.trim()) issues.push({ field: "title", issue: "missing" });
  if (!job.employmentType) issues.push({ field: "employmentType", issue: "could not be classified" });
  if (!isWellFormedUrl(job.applicationUrl)) issues.push({ field: "applicationUrl", issue: "not a well-formed URL" });
  if (job.sources.length === 0) issues.push({ field: "sources", issue: "no known source" });
  return issues;
}

// US-15 -- composite quality score, used as a tie-breaker/floor in ranking
// (§3.5), never a primary relevance factor. A required-field failure floors
// the score at 0 -- a broken record should never outrank a complete one
// regardless of how well it'd otherwise score.
const OPTIONAL_FIELDS: Array<keyof NormalizedJob> = [
  "city",
  "remoteType",
  "salaryMin",
  "postedDate",
  "applicationDeadline",
  "graduationYears",
  "requiredSkills",
  "qualificationsText",
  "jobFunction",
];

// US-52 -- live application-URL health (`jobs.link_health`, populated by the
// real `check-job-links` Edge Function) folded into the score as a
// multiplier on the completeness/confidence base, not a third weighted
// term. Reasoning:
//
// - "unchecked" (the default, and still the majority state today -- the
//   checker rotates through the active set gradually) must NOT move the
//   score at all, so a job that simply hasn't been checked yet never scores
//   worse than one that has -- multiplier 1, i.e. this branch is a no-op.
//   A reweighted three-factor average couldn't do this cleanly (any fixed
//   "neutral" value for the third term still shifts the other two terms'
//   effective weights for the common case), which is why this is a
//   post-hoc multiplier on the existing 0.6/0.4 formula instead of a
//   reweighting of it.
// - "broken" gets a real, meaningfully harsh penalty (x0.5 -- halves the
//   score) since a dead application link is nearly useless to a member,
//   but deliberately stops short of validateJob()'s floor-to-0 treatment:
//   floor-to-0 means "structurally unusable, can't even be displayed";
//   a broken link is a live-health signal about an otherwise well-formed
//   record that might come back "ok" on a later check (see
//   check-job-links' own `recovered` counter -- this does happen). Halving
//   (rather than a flat subtraction) keeps the penalty proportional, so a
//   broken link on an otherwise-complete listing still outranks a broken
//   link on a sparse one, and -- since the completeness/confidence base
//   can never be exactly 0 for a job that passed validateJob() (confidence
//   alone has a 0.5 floor, see normalize.ts) -- a halved score can never
//   land on the exact 0 validateJob() uses, keeping that floor a distinct,
//   unambiguous signal ("can't be shown at all") from this one ("shown,
//   but currently unreachable").
// - "ok" is rewarded with a small positive multiplier (x1.1, capped at 1)
//   -- a verified-working listing should score a little better than an
//   otherwise-identical unverified one, but this is a minor tie-breaking
//   nudge, not a dominant factor (§3.5: quality is a tie-breaker/floor,
//   never a primary ranking signal).
const LINK_HEALTH_OK_MULTIPLIER = 1.1;
const LINK_HEALTH_BROKEN_MULTIPLIER = 0.5;

export function scoreQuality(job: NormalizedJob): number {
  if (validateJob(job).length > 0) return 0;

  const completeness =
    OPTIONAL_FIELDS.filter((field) => {
      const value = job[field];
      if (value == null) return false;
      if (Array.isArray(value)) return value.length > 0;
      return true;
    }).length / OPTIONAL_FIELDS.length;

  const confidence = job.confidenceScore ?? 0.7;

  let score = 0.6 * completeness + 0.4 * confidence;
  if (job.linkHealth === "ok") score *= LINK_HEALTH_OK_MULTIPLIER;
  else if (job.linkHealth === "broken") score *= LINK_HEALTH_BROKEN_MULTIPLIER;
  score = Math.min(1, Math.max(0, score));

  return Math.round(score * 100) / 100;
}
