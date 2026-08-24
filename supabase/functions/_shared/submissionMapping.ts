import type { RawJob } from "./pipeline/types.ts";

// Shared between approve-submission and score-submission-duplicate -- both
// need to turn the exact same opportunity_submissions row into a RawJob to
// run through normalizeJob()/scoreDuplicate(), and they need to agree on
// which `sources` row a submission attributes to. Extracted here rather
// than left as approve-submission's own private copy once a second
// function needed the identical mapping (same reasoning dedupeHelpers.ts's
// own header comment gives for why it's shared, not duplicated).

// The two sources jobs can currently come from -- seeded by
// 20260822100000_seed_pipeline_sources.sql. Attribution is by the
// submitter's own role (profiles.role), not by which UI screen they used to
// open the modal, since PostOpportunityModal.jsx is shared between Jobs'
// "Post a job" and Admin's "+ Post opportunity" and doesn't itself record
// which one was clicked.
export const SOURCE_NAME_BY_ROLE: Record<string, string> = {
  admin: "UC Admin Submission",
  member: "UC Member Submission",
};

export interface SubmissionPayload {
  company: string;
  role: string;
  type: string; // "Internship" | "Full-time"
  classYears: string[]; // e.g. ["2027", "2028"]
  location: string;
  workMode: string; // "Remote" | "Hybrid" | "In-person"
  comp: string;
  deadline: string; // "" or "YYYY-MM-DD"
  link: string;
  description: string;
  industries: string[];
}

export function rawJobFromSubmission(payload: SubmissionPayload, sourceId: string, submissionId: string): RawJob {
  // workMode is a separate structured field on the submission form, but
  // normalizeLocation() (ported unchanged from Stage 1) only reads the
  // remote/hybrid signal out of free text -- folding it into locationText
  // here reuses that existing rule instead of adding a second code path.
  const locationText = payload.workMode && payload.workMode !== "In-person"
    ? `${payload.location} (${payload.workMode})`
    : payload.location;

  return {
    source: { sourceId, sourceJobId: submissionId, sourceUrl: payload.link, isPrimary: true },
    company: payload.company,
    title: payload.role,
    employmentTypeText: payload.type,
    description: payload.description || undefined,
    locationText: locationText || undefined,
    compensationText: payload.comp || undefined,
    applicationDeadlineText: payload.deadline || undefined,
    applicationUrl: payload.link,
    // description doubles as qualificationsText so extractGraduationYears()
    // has something to try -- overridden by the submitter's own classYears
    // chip selection where present, same override each caller applies
    // right after normalizeJob() runs.
    qualificationsText: payload.description || undefined,
  };
}

// classYears is a structured, submitter-entered fact (chip selection), not
// free text -- it takes priority over normalizeJob()'s text-based
// extractGraduationYears() fallback (which only ran against the
// description and may have found nothing, or found something looser).
export function applySubmittedGradYears<T extends { graduationYears: number[] | null }>(
  normalized: T,
  classYears: string[]
): T {
  const submittedGradYears = (classYears ?? [])
    .map((y) => parseInt(y, 10))
    .filter((y) => !Number.isNaN(y))
    .sort((a, b) => a - b);
  return submittedGradYears.length > 0 ? { ...normalized, graduationYears: submittedGradYears } : normalized;
}
