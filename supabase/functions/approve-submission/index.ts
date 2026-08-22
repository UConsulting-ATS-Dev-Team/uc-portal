// Stage 2 gap-fill, per JOB_ENGINE_ARCHITECTURE.md's Stage 2 completion note
// and 20260821130000_profiles_and_rls.sql's own comment on the jobs table:
// "the real write path is an Edge Function (service_role, bypasses RLS
// entirely) promoting an approved opportunity_submissions row into a job,
// not a direct client insert." Until now that write path was
// data/opportunitySubmissionUtils.js's buildJobFromSubmission() -- a plain
// client-side field copy. This function replaces it with the real
// normalize -> validate -> dedup -> enrich pipeline server/src/ already
// proved against synthetic data in Stage 1 (see pipeline/ in this folder,
// ported with only two changes: explicit .ts import extensions for Deno's
// resolver, and node:crypto's randomUUID swapped for the Web Crypto API).
//
// Scope, matching JOB_ENGINE_ARCHITECTURE.md Part 8.5 step 2's build order:
// normalize (US-10/11/12/13), validate (US-14), dedup-score (US-16/17),
// duplicate review queue (US-18), quality score (US-15), occupation
// enrichment (US-24/25/26/27/28). Deliberately NOT included, per that same
// list's exclusions: full field-level merge reconciliation (US-19 --
// auto-merge here just attaches a new job_sources row to the existing job
// rather than reconciling which record's fields "win"), source-health
// retry bookkeeping (US-22/23, no automated source exists yet to need it),
// and real O*NET/LLM classification (still the Stage 1 stub / not reached).
//
// Auth model: this function must run with the service role (bypasses RLS)
// because it writes to jobs/job_sources/duplicate_candidates, none of which
// grant client-side inserts to non-admins. It re-derives and checks the
// caller's admin status itself before doing anything, rather than trusting
// the client -- the client-side "Approve" button being admin-only is a UX
// nicety, not the actual security boundary.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { normalizeJob } from "./pipeline/normalize.ts";
import { validateJob, scoreQuality } from "./pipeline/quality.ts";
import { scoreDuplicate, classifyDuplicateTier } from "./pipeline/dedupe.ts";
import type { NormalizedJob, RawJob } from "./pipeline/types.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// The two sources jobs can currently come from -- seeded by
// 20260822100000_seed_pipeline_sources.sql. Attribution is by the
// submitter's own role (profiles.role), not by which UI screen they used to
// open the modal, since PostOpportunityModal.jsx is shared between Jobs'
// "Post a job" and Admin's "+ Post opportunity" and doesn't itself record
// which one was clicked.
const SOURCE_NAME_BY_ROLE: Record<string, string> = {
  admin: "UC Admin Submission",
  member: "UC Member Submission",
};

interface SubmissionPayload {
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

function rawJobFromSubmission(payload: SubmissionPayload, sourceId: string, submissionId: string): RawJob {
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
    // chip selection where present, see the override right after
    // normalizeJob() is called below.
    qualificationsText: payload.description || undefined,
  };
}

// §8.3 / US-56 -- an actual enforcement point, not just a recorded column.
// No currently-seeded source restricts description storage (submissions are
// the submitter's own words, never auto-scraped, per Part 2's compliance
// note), but this keeps the gate real for any future source that does.
function enforceStorageRestrictions(normalized: NormalizedJob, storageRestrictions: string | null): NormalizedJob {
  if (storageRestrictions && /description/i.test(storageRestrictions)) {
    return { ...normalized, description: null };
  }
  return normalized;
}

// Only the fields dedupe.ts's scoreDuplicate() actually reads are populated
// from the real row; everything else is a type-satisfying placeholder --
// this is a comparison-only object, never written back to the database.
function comparableFromExistingJob(row: Record<string, unknown>): NormalizedJob {
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

function jobInsertFromNormalized(
  normalized: NormalizedJob,
  qualityScore: number,
  jobFunctionId: string | null,
  submitterIndustries: string[]
) {
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
    qualifications_text: normalized.qualificationsText,
    // Submitter-chosen industry tags are a source-stated fact and take
    // priority over the occupation stub's inferred industries; fall back to
    // the inferred list only when the submitter didn't tag any.
    relevant_industries: submitterIndustries.length > 0 ? submitterIndustries : normalized.relevantIndustries,
    relevant_roles: normalized.relevantRoles,
    confidence_score: normalized.confidenceScore,
    quality_score: qualityScore,
    classification_method: normalized.classificationMethod,
    active: true,
    status: "active",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "Missing Authorization header" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Identifies the caller under their own JWT (respects RLS) -- used only to
  // establish who's calling, never to write anything.
  const callerClient: SupabaseClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  // Every actual read/write below uses this -- bypasses RLS by design (see
  // header comment), so every access decision has to be made explicitly in
  // this function's own code, not delegated to a policy.
  const adminClient: SupabaseClient = createClient(supabaseUrl, serviceRoleKey);

  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser();
  if (userError || !user) return jsonResponse({ error: "Not authenticated" }, 401);

  const { data: callerProfile, error: callerProfileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (callerProfileError || callerProfile?.role !== "admin") {
    return jsonResponse({ error: "Admin access required" }, 403);
  }

  let body: { submissionId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }
  if (!body.submissionId) return jsonResponse({ error: "submissionId is required" }, 400);

  const { data: submission, error: submissionError } = await adminClient
    .from("opportunity_submissions")
    .select("*")
    .eq("id", body.submissionId)
    .single();
  if (submissionError || !submission) return jsonResponse({ error: "Submission not found" }, 404);
  // Idempotency guard -- a submission already resolved (approved, rejected,
  // or expired) can't be re-approved by a duplicate/retried request.
  if (submission.status !== "needs_review") {
    return jsonResponse({ error: `Submission is already "${submission.status}", not needs_review` }, 409);
  }

  const { data: submitterProfile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", submission.submitted_by)
    .single();
  const sourceName = SOURCE_NAME_BY_ROLE[submitterProfile?.role as string] ?? SOURCE_NAME_BY_ROLE.member;

  const { data: source, error: sourceError } = await adminClient
    .from("sources")
    .select("*")
    .eq("name", sourceName)
    .single();
  if (sourceError || !source) {
    return jsonResponse({ error: `Source "${sourceName}" not found -- has the seed migration been applied?` }, 500);
  }
  if (source.authorization_status === "disabled" || source.authorization_status === "not_approved") {
    // §3.7's actual enforcement point: a disabled/unapproved source cannot
    // reach the database, full stop, regardless of what an admin clicks.
    return jsonResponse({ error: `Source "${sourceName}" is not currently authorized to contribute jobs` }, 403);
  }

  const payload = submission.raw_payload as SubmissionPayload;
  const raw = rawJobFromSubmission(payload, source.id, submission.id);
  let normalized = normalizeJob(raw);

  // classYears is a structured, submitter-entered fact (chip selection), not
  // free text -- it takes priority over normalizeJob()'s text-based
  // extractGraduationYears() fallback (which only ran against the
  // description and may have found nothing, or found something looser).
  const submittedGradYears = (payload.classYears ?? [])
    .map((y) => parseInt(y, 10))
    .filter((y) => !Number.isNaN(y))
    .sort((a, b) => a - b);
  if (submittedGradYears.length > 0) {
    normalized = { ...normalized, graduationYears: submittedGradYears };
  }

  const issues = validateJob(normalized);
  if (issues.length > 0) {
    // Required-field failure -- per §3.1, never insert a broken record.
    // Submission status is left as "needs_review" so the admin can fix the
    // submission (or reject it) rather than silently losing it.
    return jsonResponse({ error: "Normalized job failed validation", issues }, 422);
  }

  normalized = enforceStorageRestrictions(normalized, source.storage_restrictions);
  const qualityScore = scoreQuality(normalized);

  const { data: activeJobs, error: activeJobsError } = await adminClient
    .from("jobs")
    .select("id, company, title, application_url, remote_type, city, posted_date, salary_min")
    .eq("active", true);
  if (activeJobsError) return jsonResponse({ error: activeJobsError.message }, 500);

  let bestMatch: { jobId: string; score: number } | null = null;
  for (const row of activeJobs ?? []) {
    const { score } = scoreDuplicate(normalized, comparableFromExistingJob(row));
    if (!bestMatch || score > bestMatch.score) bestMatch = { jobId: row.id as string, score };
  }
  const tier = bestMatch ? classifyDuplicateTier(bestMatch.score) : "distinct";

  const nowIso = new Date().toISOString();

  // Auto-merge (>=90): don't create a second job record -- attach this
  // submission as an additional source on the job that's already there.
  // Full field-level reconciliation (US-19's mergeJobs()) is out of scope
  // here (see header comment); this still correctly avoids a visible
  // duplicate listing, which is the part that actually matters to a member
  // browsing the Jobs board.
  if (tier === "auto_merge" && bestMatch) {
    const { error: jobSourceError } = await adminClient.from("job_sources").insert({
      job_id: bestMatch.jobId,
      source_id: source.id,
      source_job_id: submission.id,
      source_url: payload.link,
      is_primary: false,
    });
    if (jobSourceError) return jsonResponse({ error: jobSourceError.message }, 500);

    await adminClient.from("jobs").update({ last_seen_at: nowIso, updated_at: nowIso }).eq("id", bestMatch.jobId);

    const { error: updateSubmissionError } = await adminClient
      .from("opportunity_submissions")
      .update({ job_id: bestMatch.jobId, status: "live", reviewed_by: user.id, reviewed_at: nowIso })
      .eq("id", submission.id);
    if (updateSubmissionError) return jsonResponse({ error: updateSubmissionError.message }, 500);

    return jsonResponse({ outcome: "merged", jobId: bestMatch.jobId, matchedScore: bestMatch.score });
  }

  let jobFunctionId: string | null = null;
  if (normalized.jobFunction) {
    const { data: jobFunctionRow } = await adminClient
      .from("job_functions")
      .select("id")
      .eq("name", normalized.jobFunction)
      .maybeSingle();
    jobFunctionId = jobFunctionRow?.id ?? null;
  }

  const { data: newJob, error: jobInsertError } = await adminClient
    .from("jobs")
    .insert(jobInsertFromNormalized(normalized, qualityScore, jobFunctionId, payload.industries ?? []))
    .select()
    .single();
  if (jobInsertError) return jsonResponse({ error: jobInsertError.message }, 500);

  const { error: jobSourceInsertError } = await adminClient.from("job_sources").insert({
    job_id: newJob.id,
    source_id: source.id,
    source_job_id: submission.id,
    source_url: payload.link,
    is_primary: true,
  });
  if (jobSourceInsertError) return jsonResponse({ error: jobSourceInsertError.message }, 500);

  // Review band (70-89): the submission still goes live -- the admin already
  // approved it -- but flagged in the same duplicate_candidates queue an
  // automated source's near-duplicates would land in (US-18), so a human
  // resolves whether it's genuinely a second listing or should be merged.
  if (tier === "review" && bestMatch) {
    const { score, signals } = scoreDuplicate(normalized, comparableFromExistingJob(
      (activeJobs ?? []).find((j) => j.id === bestMatch!.jobId)!
    ));
    const { error: duplicateInsertError } = await adminClient.from("duplicate_candidates").insert({
      job_id_a: newJob.id,
      job_id_b: bestMatch.jobId,
      score,
      signals,
    });
    if (duplicateInsertError) return jsonResponse({ error: duplicateInsertError.message }, 500);
  }

  const { error: updateSubmissionError } = await adminClient
    .from("opportunity_submissions")
    .update({ job_id: newJob.id, status: "live", reviewed_by: user.id, reviewed_at: nowIso })
    .eq("id", submission.id);
  if (updateSubmissionError) return jsonResponse({ error: updateSubmissionError.message }, 500);

  return jsonResponse({
    outcome: tier === "review" ? "live_flagged_duplicate" : "live",
    jobId: newJob.id,
    ...(tier === "review" && bestMatch ? { duplicateOf: bestMatch.jobId, duplicateScore: bestMatch.score } : {}),
  });
});
