// Stage 2 gap-fill, per JOB_ENGINE_ARCHITECTURE.md's Stage 2 completion note
// and 20260821130000_profiles_and_rls.sql's own comment on the jobs table:
// "the real write path is an Edge Function (service_role, bypasses RLS
// entirely) promoting an approved opportunity_submissions row into a job,
// not a direct client insert." Until now that write path was
// data/opportunitySubmissionUtils.js's buildJobFromSubmission() -- a plain
// client-side field copy. This function replaces it with the real
// normalize -> validate -> dedup -> enrich pipeline server/src/ already
// proved against synthetic data in Stage 1 (see ../_shared/pipeline/, ported
// with only two changes: explicit .ts import extensions for Deno's resolver,
// and node:crypto's randomUUID swapped for the Web Crypto API -- shared with
// fetch-greenhouse-stripe, Stage 3's automated-source pilot, rather than
// duplicated once a second Edge Function needed the same logic).
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

import { normalizeJob } from "../_shared/pipeline/normalize.ts";
import { validateJob, scoreQuality } from "../_shared/pipeline/quality.ts";
import { scoreDuplicate, classifyDuplicateTier } from "../_shared/pipeline/dedupe.ts";
import {
  comparableFromExistingJob,
  fetchAllRows,
  jobInsertFromNormalized,
  resolveJobFunctionId,
} from "../_shared/dedupeHelpers.ts";
import { applySubmittedGradYears, rawJobFromSubmission, SOURCE_NAME_BY_ROLE, type SubmissionPayload } from "../_shared/submissionMapping.ts";
import { requireAdmin } from "../_shared/requireAdmin.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const adminResult = await requireAdmin(req);
  if (adminResult instanceof Response) return adminResult;
  const { user, adminClient } = adminResult;

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
  const normalized = applySubmittedGradYears(normalizeJob(raw), payload.classYears);

  const issues = validateJob(normalized);
  if (issues.length > 0) {
    // Required-field failure -- per §3.1, never insert a broken record.
    // Submission status is left as "needs_review" so the admin can fix the
    // submission (or reject it) rather than silently losing it.
    return jsonResponse({ error: "Normalized job failed validation", issues }, 422);
  }

  const qualityScore = scoreQuality(normalized);

  // Paginated via fetchAllRows() -- a bare .select() here silently truncates
  // at PostgREST's default 1000-row page (the exact bug fetch-greenhouse-
  // companies hit), which by this point in the app's growth is a real risk,
  // not hypothetical: total active jobs across the Greenhouse sources alone
  // already exceed 1000. An admin approving a submission deserves a dedup
  // check against every active job, not just whichever ~1000 happened to
  // come back first.
  let activeJobs: Array<Record<string, unknown>>;
  try {
    activeJobs = await fetchAllRows(adminClient, "jobs", "id, company, title, application_url, remote_type, city, posted_date, salary_min", (q) => q.eq("active", true));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }

  let bestMatch: { jobId: string; score: number } | null = null;
  for (const row of activeJobs) {
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

  const jobFunctionId = await resolveJobFunctionId(adminClient, normalized.jobFunction);

  // Submitter-chosen industry tags are a source-stated fact and take
  // priority over the occupation stub's inferred industries; fall back to
  // the inferred list only when the submitter didn't tag any.
  const submitterIndustries = payload.industries ?? [];
  const insertRow = {
    ...jobInsertFromNormalized(normalized, qualityScore, jobFunctionId, source.storage_restrictions),
    relevant_industries: submitterIndustries.length > 0 ? submitterIndustries : normalized.relevantIndustries,
  };

  const { data: newJob, error: jobInsertError } = await adminClient
    .from("jobs")
    .insert(insertRow)
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
