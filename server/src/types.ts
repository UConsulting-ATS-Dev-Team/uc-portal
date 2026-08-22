// Mirrors supabase/migrations/20260821120000_init_schema.sql. Kept as plain types (not
// generated from the DB yet) since Stage 1 has no live database connection --
// see JOB_ENGINE_ARCHITECTURE.md Part 7. Field names/shapes should stay in
// sync with the SQL by hand until Stage 2 wires this to a real Supabase
// project, at which point `supabase gen types typescript` can take over.

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

// Member profile fields the matching/ranking pipeline reads. Mirrors the
// existing prototype's `preferences` object in data/store.jsx, with `skills`
// added per Part 10 (didn't exist in the prototype before).
export interface MemberProfile {
  graduationYear: number; // hard constraint (US-31/US-33)
  opportunityType: "Internship" | "Full-time" | "Both";
  industries: string[]; // ranked, soft preference
  roles: string[]; // soft preference
  locations: string[]; // soft preference
  openToRelocating: boolean;
  remoteOrHybridOnly: boolean;
  followedCompanies: string[];
  compTarget: number | null; // $/hr, soft preference
  skills: string[]; // Part 10 addition
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

export interface MatchFactor {
  key: "industry" | "role" | "location" | "compensation" | "graduationYear" | "skills";
  label: string;
  match: boolean;
  detail: string;
}

export interface MatchResult {
  eligible: boolean; // false if any hard constraint fails -- job should be filtered out entirely, per US-33
  score: number; // 0-100, only meaningful when eligible
  factors: MatchFactor[]; // US-34 -- every factor shown, so the score is always explainable
}
