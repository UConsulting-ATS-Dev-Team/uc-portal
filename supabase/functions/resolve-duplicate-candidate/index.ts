// Gives an admin a real way to act on the duplicate_candidates review queue
// (US-18) -- until now, dedup scoring (approve-submission,
// fetch-greenhouse-stripe) could flag a pending row, but nothing could
// resolve one. The Stage 3 Greenhouse pilot populated this queue with real
// data (18 pending rows from one fetch of Stripe's feed) with no UI or
// endpoint to clear it, which is the gap this closes.
//
// Two resolutions:
// - not_duplicate: no data changes, just records the review.
// - confirmed_duplicate: one job survives (admin's choice via keepJobId),
//   the other's job_sources rows are reassigned onto it and it's
//   deactivated. Real US-19 field-level merge as of this version --
//   previously this just kept the chosen job's fields as-is and discarded
//   the other record's data entirely (same scope line approve-submission's
//   auto-merge still draws, since that path never has a second row's
//   fields to reconcile against -- it's attaching a brand-new submission
//   to an existing job, not resolving two already-distinct rows).
//
// Merge policy (mergeJobFields below), deliberately simple and hard to get
// wrong rather than a scored "which value is more accurate" system: for
// plain fields, only fill a gap -- the kept job's own non-null value is
// never overwritten by the removed job's, only a genuinely missing field
// gets backfilled. For array fields (skills, industries, roles, grad
// years), union the two lists instead -- these are naturally additive
// facts, not competing claims, so keeping both sides' classifications
// widens relevance rather than risking losing one. Identity fields
// (company/title/employment_type/application_url) and computed/meta
// fields (quality_score, classification_method) are deliberately left
// alone -- the admin's keepJobId choice already picked which record's
// identity and classification method the merged listing keeps; provenance
// for both contributing sources is already fully retained via the
// existing job_sources reassignment below, unchanged.
//
// Same auth model as approve-submission: service_role (bypasses RLS,
// required to write job_sources/jobs, which grant no client-side writes to
// non-admins), admin status re-derived server-side via requireAdmin().

import { requireAdmin } from "../_shared/requireAdmin.ts";

// Plain fields: back-fill only, never overwrite the kept job's own value.
const FILL_GAP_FIELDS = [
  "description",
  "department",
  "job_function_id",
  "city",
  "state",
  "country",
  "remote_type",
  "salary_min",
  "salary_max",
  "compensation_type",
  "compensation_text",
  "application_deadline",
  "qualifications_text",
];
// Array fields: union + dedupe rather than fill-gap, since a nonempty
// value on both sides is two real, non-conflicting facts, not a
// disagreement to resolve.
const UNION_ARRAY_FIELDS = ["graduation_years", "required_skills", "preferred_skills", "relevant_industries", "relevant_roles"];

// deno-lint-ignore no-explicit-any
function mergeJobFields(keepJob: Record<string, any>, removeJob: Record<string, any>) {
  const merged: Record<string, unknown> = {};
  for (const field of FILL_GAP_FIELDS) {
    const keepVal = keepJob[field];
    const removeVal = removeJob[field];
    const keepIsEmpty = keepVal == null || keepVal === "";
    const removeIsEmpty = removeVal == null || removeVal === "";
    if (keepIsEmpty && !removeIsEmpty) merged[field] = removeVal;
  }
  for (const field of UNION_ARRAY_FIELDS) {
    const keepArr: unknown[] = keepJob[field] ?? [];
    const union = [...new Set([...keepArr, ...(removeJob[field] ?? [])])];
    // Only report/write this field if the union actually adds something --
    // an unconditional write of every array field on every merge would
    // make the returned `mergedFields` list (surfaced to the admin as
    // confirmation of what changed) misleading.
    if (union.length !== keepArr.length) merged[field] = union;
  }
  return merged;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

interface ResolveBody {
  candidateId?: string;
  resolution?: "confirmed_duplicate" | "not_duplicate";
  keepJobId?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const adminResult = await requireAdmin(req);
  if (adminResult instanceof Response) return adminResult;
  const { user, adminClient } = adminResult;

  let body: ResolveBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }
  if (!body.candidateId || !body.resolution) return jsonResponse({ error: "candidateId and resolution are required" }, 400);
  if (body.resolution !== "confirmed_duplicate" && body.resolution !== "not_duplicate") {
    return jsonResponse({ error: 'resolution must be "confirmed_duplicate" or "not_duplicate"' }, 400);
  }

  // Idempotency guard, made atomic (2026-09-25) -- same fix, same reasoning
  // as approve-submission's identical claim pattern: the original
  // SELECT-then-check-in-application-code version had a real TOCTOU race
  // under true concurrent double-submission (two requests both reading
  // status = "pending" before either writes). This UPDATE ... WHERE
  // status = 'pending' AND reviewed_by IS NULL RETURNING * is the actual
  // atomic claim -- only one concurrent request's WHERE clause can still
  // match once it holds the row lock; the loser affects zero rows and gets
  // a clean 409 instead of racing ahead to double-process a merge.
  const nowIso = new Date().toISOString();
  const { data: claimedRows, error: claimError } = await adminClient
    .from("duplicate_candidates")
    .update({ reviewed_by: user.id, reviewed_at: nowIso })
    .eq("id", body.candidateId)
    .eq("status", "pending")
    .is("reviewed_by", null)
    .select();
  if (claimError) return jsonResponse({ error: claimError.message }, 500);
  if (!claimedRows || claimedRows.length === 0) {
    return jsonResponse({ error: "Duplicate candidate not found, or already claimed/resolved" }, 409);
  }
  const candidate = claimedRows[0];

  // Same reasoning as approve-submission's identical fail() helper: every
  // early-return error path below releases the claim first, so a
  // candidate that fails partway through (e.g. the merge's job-loading
  // step) doesn't stay permanently "claimed" -- an admin can retry it.
  async function fail(errorBody: Record<string, unknown>, status: number) {
    await adminClient.from("duplicate_candidates").update({ reviewed_by: null, reviewed_at: null }).eq("id", candidate.id);
    return jsonResponse(errorBody, status);
  }

  if (body.resolution === "not_duplicate") {
    const { error } = await adminClient
      .from("duplicate_candidates")
      .update({ status: "not_duplicate", reviewed_by: user.id, reviewed_at: nowIso })
      .eq("id", candidate.id);
    if (error) return await fail({ error: error.message }, 500);
    return jsonResponse({ outcome: "not_duplicate" });
  }

  if (body.keepJobId !== candidate.job_id_a && body.keepJobId !== candidate.job_id_b) {
    return await fail({ error: "keepJobId must match this candidate's job_id_a or job_id_b" }, 400);
  }
  const keepId = body.keepJobId;
  const removeId = keepId === candidate.job_id_a ? candidate.job_id_b : candidate.job_id_a;

  // US-19 -- need both full rows to compute the merge, not just the ids
  // the rest of this handler already had.
  const { data: bothJobs, error: bothJobsError } = await adminClient.from("jobs").select("*").in("id", [keepId, removeId]);
  if (bothJobsError || !bothJobs || bothJobs.length !== 2) {
    return await fail({ error: bothJobsError?.message ?? "Could not load both jobs to merge" }, 500);
  }
  const keepJob = bothJobs.find((j) => j.id === keepId)!;
  const removeJob = bothJobs.find((j) => j.id === removeId)!;
  const mergedFields = mergeJobFields(keepJob, removeJob);

  const { error: reassignError } = await adminClient
    .from("job_sources")
    .update({ job_id: keepId, is_primary: false })
    .eq("job_id", removeId);
  if (reassignError) return await fail({ error: `Reassigning sources failed: ${reassignError.message}` }, 500);

  const { error: deactivateError } = await adminClient
    .from("jobs")
    .update({ active: false, status: "removed", updated_at: nowIso })
    .eq("id", removeId);
  if (deactivateError) return await fail({ error: `Deactivating the duplicate failed: ${deactivateError.message}` }, 500);

  const { error: mergeUpdateError } = await adminClient
    .from("jobs")
    .update({ ...mergedFields, last_seen_at: nowIso, updated_at: nowIso })
    .eq("id", keepId);
  if (mergeUpdateError) return await fail({ error: `Applying merged fields failed: ${mergeUpdateError.message}` }, 500);

  const { error: updateCandidateError } = await adminClient
    .from("duplicate_candidates")
    .update({ status: "confirmed_duplicate", reviewed_by: user.id, reviewed_at: nowIso })
    .eq("id", candidate.id);
  if (updateCandidateError) return await fail({ error: updateCandidateError.message }, 500);

  return jsonResponse({ outcome: "confirmed_duplicate", keptJobId: keepId, removedJobId: removeId, mergedFields: Object.keys(mergedFields) });
});
