import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { NormalizedJob } from "./pipeline/types.ts";

// Shared between approve-submission (Stage 2), fetch-deloitte-jobs, and
// fetch-greenhouse-companies (Stage 3/4) -- all run the same normalize ->
// dedup -> insert flow against the same `jobs` table, so the glue between
// the pure pipeline modules (pipeline/) and each function's own Supabase
// calls lives here rather than being copy-pasted per function.

const PAGE_SIZE = 1000;

// PostgREST caps a plain .select() at a default page size (1000 rows) --
// confirmed the hard way in fetch-greenhouse-companies that this silently
// truncates rather than erroring, which caused real data corruption: an
// incomplete `activeJobs`/`existingSources` lookup made already-tracked
// jobs look brand-new on every run, creating a fresh orphaned duplicate
// each time. Moved here (rather than left as a local copy in that one
// function) once it became clear every function doing an unbounded
// .select() against `jobs` or `job_sources` has the same latent bug --
// active jobs alone crossed 1000 rows once the Greenhouse expansion
// landed, so this isn't a hypothetical for the other callers either.
export async function fetchAllRows(
  adminClient: SupabaseClient,
  table: string,
  columns: string,
  // deno-lint-ignore no-explicit-any
  applyFilters?: (query: any) => any,
  // deno-lint-ignore no-explicit-any
): Promise<any[]> {
  const rows: Record<string, unknown>[] = [];
  let from = 0;
  while (true) {
    let query = adminClient.from(table).select(columns).range(from, from + PAGE_SIZE - 1);
    if (applyFilters) query = applyFilters(query);
    const { data, error } = await query;
    if (error) throw new Error(`Fetching ${table} failed: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

// Only the fields dedupe.ts's scoreDuplicate() actually reads are populated
// from the real row; everything else is a type-satisfying placeholder --
// this is a comparison-only object, never written back to the database.
export function comparableFromExistingJob(row: Record<string, unknown>): NormalizedJob {
  return {
    id: row.id as string,
    sources: [],
    company: (row.company as string) ?? "",
    title: (row.title as string) ?? "",
    employmentType: (row.employment_type as NormalizedJob["employmentType"]) ?? null,
    applicationUrl: (row.application_url as string) ?? "",
    description: null,
    department: null,
    jobFunction: null,
    city: (row.city as string | null) ?? null,
    state: null,
    country: null,
    remoteType: (row.remote_type as NormalizedJob["remoteType"]) ?? null,
    salaryMin: (row.salary_min as number | null) ?? null,
    salaryMax: null,
    salaryCurrency: "USD",
    compensationType: "unspecified",
    compensationText: null,
    postedDate: (row.posted_date as string | null) ?? null,
    updatedDate: null,
    applicationDeadline: null,
    graduationYears: null,
    requiredSkills: null,
    preferredSkills: null,
    qualificationsText: null,
    relevantIndustries: [],
    relevantRoles: [],
    ucRecruitingNotes: null,
    firstSeenAt: new Date(0).toISOString(),
    lastSeenAt: new Date(0).toISOString(),
    lastVerifiedAt: null,
    active: true,
    status: "active",
    confidenceScore: null,
    qualityScore: null,
    classificationMethod: "source_stated",
  };
}

// §8.3 / US-56 -- an actual enforcement point, not just a recorded column.
// A source with e.g. "do not store full description text" in its
// storage_restrictions gets that field stripped here, unconditionally --
// no caller can accidentally skip it. Exported on its own (in addition to
// being called inside jobInsertFromNormalized below) only so it stays
// independently testable/inspectable, not as an invitation to call it
// separately -- see that function's own comment for why the enforcement
// itself lives there instead.
export function enforceStorageRestrictions(normalized: NormalizedJob, storageRestrictions: string | null): NormalizedJob {
  if (storageRestrictions && /description/i.test(storageRestrictions)) {
    return { ...normalized, description: null };
  }
  return normalized;
}

// Base field mapping from a NormalizedJob to a `jobs` table insert row --
// the one function every adapter (approve-submission, fetch-greenhouse-
// companies, fetch-deloitte-jobs, and any future one) already calls to
// build its insert row, which is exactly why storage-restriction
// enforcement (US-56/§8.3) lives *inside* it rather than as a separate
// step callers have to remember: fetch-greenhouse-companies and
// fetch-deloitte-jobs never called enforceStorageRestrictions() on their
// own (confirmed live -- neither file even imported it), relying purely
// on each adapter author remembering never to populate `description` in
// the first place. Folding the check in here makes it structurally
// impossible to insert a row that skips it, not just documented
// convention. `storageRestrictions` is required, not optional, so a
// caller can't silently pass nothing either -- pass the source row's own
// `storage_restrictions` (null is a valid, meaningful "no restriction").
// Callers may spread additional overrides on top of the return value
// (approve-submission prefers a human submitter's own industry tags over
// the occupation stub's inferred ones, which the other adapters have no
// equivalent of).
export function jobInsertFromNormalized(
  normalizedInput: NormalizedJob,
  qualityScore: number,
  jobFunctionId: string | null,
  storageRestrictions: string | null
) {
  const normalized = enforceStorageRestrictions(normalizedInput, storageRestrictions);
  return {
    company: normalized.company,
    title: normalized.title,
    employment_type: normalized.employmentType,
    application_url: normalized.applicationUrl,
    description: normalized.description,
    department: normalized.department,
    job_function_id: jobFunctionId,
    city: normalized.city,
    state: normalized.state,
    country: normalized.country,
    remote_type: normalized.remoteType,
    salary_min: normalized.salaryMin,
    salary_max: normalized.salaryMax,
    salary_currency: normalized.salaryCurrency,
    compensation_type: normalized.compensationType,
    compensation_text: normalized.compensationText,
    posted_date: new Date().toISOString().slice(0, 10),
    application_deadline: normalized.applicationDeadline,
    graduation_years: normalized.graduationYears,
    required_skills: normalized.requiredSkills,
    preferred_skills: normalized.preferredSkills,
    qualifications_text: normalized.qualificationsText,
    relevant_industries: normalized.relevantIndustries,
    relevant_roles: normalized.relevantRoles,
    confidence_score: normalized.confidenceScore,
    quality_score: qualityScore,
    classification_method: normalized.classificationMethod,
    active: true,
    status: "active",
  };
}

// deno-lint-ignore no-explicit-any
export async function resolveJobFunctionId(adminClient: any, jobFunctionName: string | null): Promise<string | null> {
  if (!jobFunctionName) return null;
  const { data } = await adminClient.from("job_functions").select("id").eq("name", jobFunctionName).maybeSingle();
  return data?.id ?? null;
}
