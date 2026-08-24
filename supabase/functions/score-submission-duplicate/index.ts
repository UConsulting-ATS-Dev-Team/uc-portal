// US-09/§8.2 -- "run the dedup pipeline on every submission before it
// reaches the review queue." Previously this only happened inside
// approve-submission, at Approve time -- an admin looking at the queue had
// no signal that a submission was a likely duplicate until after clicking
// Approve, which is the review decision the dedup score was supposed to
// inform. This function scores a submission the moment it's created
// (called by PostOpportunityModal.jsx right after its insert) and writes
// the verdict onto the submission row so pages/AdminDashboard.jsx's queue
// table can show it.
//
// Deliberately informational, not authoritative: approve-submission still
// runs its own fresh dedup check at approval time and does not read these
// columns -- the active-jobs set can change in the time between a
// submission and an admin reviewing it, so re-scoring at approval remains
// the actual gate that decides auto-merge/live/live-flagged. This only
// fixes the queue-visibility gap, not a stand-in for that check.
//
// Auth: any authenticated member may call this, but only for their own
// submission (`submitted_by = auth.uid()`) -- re-derived server-side from
// the row itself, not trusted from the request body, same principle
// requireAdmin.ts's own callers already follow.

import { normalizeJob } from "../_shared/pipeline/normalize.ts";
import { scoreDuplicate, classifyDuplicateTier } from "../_shared/pipeline/dedupe.ts";
import { comparableFromExistingJob, fetchAllRows } from "../_shared/dedupeHelpers.ts";
import { applySubmittedGradYears, rawJobFromSubmission, SOURCE_NAME_BY_ROLE, type SubmissionPayload } from "../_shared/submissionMapping.ts";
import { requireAuthenticated } from "../_shared/requireAuthenticated.ts";

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

  const authResult = await requireAuthenticated(req);
  if (authResult instanceof Response) return authResult;
  const { user, adminClient } = authResult;

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
  if (submission.submitted_by !== user.id) {
    return jsonResponse({ error: "Can only score your own submission" }, 403);
  }
  // A submission already resolved has no queue row left needing a duplicate
  // hint -- silently a no-op rather than an error, since this is called
  // automatically right after submit, not from a user-facing action.
  if (submission.status !== "needs_review") {
    return jsonResponse({ outcome: "skipped", reason: `submission is already "${submission.status}"` });
  }

  const { data: submitterProfile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", submission.submitted_by)
    .single();
  const sourceName = SOURCE_NAME_BY_ROLE[submitterProfile?.role as string] ?? SOURCE_NAME_BY_ROLE.member;

  const { data: source } = await adminClient.from("sources").select("id").eq("name", sourceName).single();
  if (!source) return jsonResponse({ error: `Source "${sourceName}" not found` }, 500);

  const payload = submission.raw_payload as SubmissionPayload;
  const raw = rawJobFromSubmission(payload, source.id, submission.id);
  const normalized = applySubmittedGradYears(normalizeJob(raw), payload.classYears);

  let activeJobs: Array<Record<string, unknown>>;
  try {
    activeJobs = await fetchAllRows(adminClient, "jobs", "id, company, title, application_url, remote_type, city, posted_date, salary_min", (q) => q.eq("active", true));
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }

  let bestMatch: { jobId: string; score: number } | null = null;
  for (const row of activeJobs) {
    const { score } = scoreDuplicate(normalized, comparableFromExistingJob(row));
    if (!bestMatch || score > bestMatch.score) bestMatch = { jobId: row.id as string, score };
  }
  const tier = bestMatch ? classifyDuplicateTier(bestMatch.score) : "distinct";

  const { error: updateError } = await adminClient
    .from("opportunity_submissions")
    .update({
      duplicate_tier: tier,
      duplicate_best_job_id: tier === "distinct" ? null : bestMatch?.jobId ?? null,
      duplicate_best_score: tier === "distinct" ? null : bestMatch?.score ?? null,
    })
    .eq("id", submission.id);
  if (updateError) return jsonResponse({ error: updateError.message }, 500);

  return jsonResponse({ tier, ...(bestMatch && tier !== "distinct" ? { bestMatchJobId: bestMatch.jobId, bestMatchScore: bestMatch.score } : {}) });
});
