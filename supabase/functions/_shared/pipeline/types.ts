// Ported from server/src/types.ts (Stage 1) for the Stage 2 Edge Function --
// see that file's header for the original rationale. Kept in sync by hand;
// if the two ever diverge, server/src/types.ts is the source of truth since
// it's what the vitest suite (npm run test:server) actually exercises.

export type EmploymentType = "internship" | "full_time" | "part_time" | "fellowship" | "co_op" | "apprenticeship";
export type RemoteType = "remote" | "hybrid" | "in_person";
export type JobStatus = "active" | "expiring_soon" | "potentially_expired" | "expired" | "removed";
export type CompensationType = "hourly" | "salary" | "unspecified";

// 'source_stated' = the source itself provided this value (a fact).
// Everything else is the system's own inference and must be presented in the
// UI as such -- US-28.
export type ClassificationMethod = "source_stated" | "rule" | "onet_occupation" | "llm" | "human";

export type SourceType = "admin" | "member" | "employer_api" | "feed" | "licensed_provider";
export type AuthorizationStatus =
  | "approved"
  | "approved_with_restrictions"
  | "requires_review"
  | "not_approved"
  | "disabled";

export interface Source {
  id: string;
  name: string;
  type: SourceType;
  authorizationStatus: AuthorizationStatus;
  apiAvailable: boolean;
  rateLimits: string | null;
  attributionRequired: boolean;
  storageRestrictions: string | null; // e.g. "do not store full description text" -- enforced, see enforceStorageRestrictions()
  redistributionRestricted: boolean;
  retentionRequirement: string | null;
  enabled: boolean;
}

// A single as-fetched job record, before it's merged with any duplicates.
// One JobSource per contributing source (§8.3 -- a merged Job can have more
// than one of these, which is why RawJob doesn't carry a single sourceId).
export interface JobSource {
  sourceId: string;
  sourceJobId: string | null;
  sourceUrl: string;
  isPrimary: boolean;
}

// What an adapter/submission hands the pipeline, before normalization.
// Free-text throughout -- normalize() is responsible for turning this into a
// NormalizedJob.
export interface RawJob {
  source: JobSource;
  company: string;
  title: string;
  employmentTypeText?: string; // e.g. "Internship", "intern", "Summer Internship"
  description?: string;
  department?: string;
  locationText?: string; // e.g. "NYC / Hybrid", "Chicago, IL", "Remote"
  compensationText?: string; // e.g. "$35-45/hour", "$85k/yr"
  postedDate?: string;
  updatedDate?: string;
  applicationDeadlineText?: string;
  applicationUrl: string;
  qualificationsText?: string;
}

// After normalization (§3.2) / before dedup+enrichment.
export interface NormalizedJob {
  id: string;
  sources: JobSource[]; // always >=1; >1 only after a merge
  company: string;
  title: string;
  // Nullable even though this is logically "required" (§3.1) -- when
  // normalization can't confidently classify it, the honest result is
  // "unknown," caught by validateJob() (US-14), not a guessed default that
  // could misrepresent an internship as full-time or vice versa.
  employmentType: EmploymentType | null;
  applicationUrl: string;

  description: string | null;
  department: string | null;
  jobFunction: string | null; // taxonomy name, resolved later by enrichment

  city: string | null;
  state: string | null;
  country: string | null;
  remoteType: RemoteType | null;

  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  compensationType: CompensationType;
  compensationText: string | null;

  postedDate: string | null;
  updatedDate: string | null;
  applicationDeadline: string | null;

  graduationYears: number[] | null;
  requiredSkills: string[] | null;
  preferredSkills: string[] | null;
  qualificationsText: string | null;

  // Mirrors jobs.link_health (20260825110000_link_health_schema.sql). Always
  // "unchecked"/absent on a freshly-normalized job at insert time -- nothing
  // in the pipeline sets this before scoreQuality() runs on a brand-new
  // record, since check-job-links only ever examines already-inserted rows.
  // Present so scoreQuality() can factor in a real health result for the
  // retroactive-recompute path (server/scripts/recomputeLinkHealthQuality.ts),
  // which reads the real column off an existing row. See quality.ts (US-15/
  // US-52) for how it's used.
  linkHealth?: "unchecked" | "ok" | "broken" | null;

  relevantIndustries: string[];
  relevantRoles: string[];
  ucRecruitingNotes: string | null;

  firstSeenAt: string;
  lastSeenAt: string;
  lastVerifiedAt: string | null;
  active: boolean;
  status: JobStatus;
  confidenceScore: number | null;
  qualityScore: number | null;
  classificationMethod: ClassificationMethod;
}

export interface DuplicateSignal {
  name: "canonical_url" | "source_job_id" | "company_title_location" | "posting_date_salary";
  matched: boolean;
  detail?: string;
}

export interface DuplicateCandidate {
  jobIdA: string;
  jobIdB: string;
  score: number;
  signals: DuplicateSignal[];
}
