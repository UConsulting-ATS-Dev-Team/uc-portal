import type { NormalizedJob } from "./types.ts";

// Ported unchanged from server/src/quality.ts.
// US-14 -- required-field validation. Anything listed here is a hard failure
// (§3.1: "anything needed to display and apply to the job is required").
export interface ValidationIssue {
  field: string;
  issue: string;
}

function isWellFormedUrl(value: string): boolean {
  try {
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

  // Source-reliability history and live application-URL health checks (§3.5)
  // aren't meaningful yet with no real automated source running -- Stage 2+
  // concern, not simulated here with a fake number.
  const score = 0.6 * completeness + 0.4 * confidence;
  return Math.round(score * 100) / 100;
}
