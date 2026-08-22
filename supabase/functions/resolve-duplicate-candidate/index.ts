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
//   deactivated. This deliberately stops short of US-19's full field-level
//   merge reconciliation (same scope line approve-submission's auto-merge
//   already draws) -- it's enough to stop a redundant listing from being
//   visible on the Jobs board, which is what actually matters to a member
//   browsing it; reconciling which record's individual fields "win" is a
//   real but separate follow-on.
//
// Same auth model as approve-submission: service_role (bypasses RLS,
// required to write job_sources/jobs, which grant no client-side writes to
// non-admins), admin status re-derived server-side via requireAdmin().

import { requireAdmin } from "../_shared/requireAdmin.ts";

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

  const { data: candidate, error: candidateError } = await adminClient
    .from("duplicate_candidates")
    .select("*")
    .eq("id", body.candidateId)
    .single();
  if (candidateError || !candidate) return jsonResponse({ error: "Duplicate candidate not found" }, 404);
  // Idempotency guard -- a candidate already resolved can't be re-resolved
  // by a duplicate/retried request.
  if (candidate.status !== "pending") {
    return jsonResponse({ error: `Candidate is already "${candidate.status}", not pending` }, 409);
  }

  const nowIso = new Date().toISOString();

  if (body.resolution === "not_duplicate") {
    const { error } = await adminClient
      .from("duplicate_candidates")
      .update({ status: "not_duplicate", reviewed_by: user.id, reviewed_at: nowIso })
      .eq("id", candidate.id);
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ outcome: "not_duplicate" });
  }

  if (body.keepJobId !== candidate.job_id_a && body.keepJobId !== candidate.job_id_b) {
    return jsonResponse({ error: "keepJobId must match this candidate's job_id_a or job_id_b" }, 400);
  }
  const keepId = body.keepJobId;
  const removeId = keepId === candidate.job_id_a ? candidate.job_id_b : candidate.job_id_a;

  const { error: reassignError } = await adminClient
    .from("job_sources")
    .update({ job_id: keepId, is_primary: false })
    .eq("job_id", removeId);
  if (reassignError) return jsonResponse({ error: `Reassigning sources failed: ${reassignError.message}` }, 500);

  const { error: deactivateError } = await adminClient
    .from("jobs")
    .update({ active: false, status: "removed", updated_at: nowIso })
    .eq("id", removeId);
  if (deactivateError) return jsonResponse({ error: `Deactivating the duplicate failed: ${deactivateError.message}` }, 500);

  await adminClient.from("jobs").update({ last_seen_at: nowIso, updated_at: nowIso }).eq("id", keepId);

  const { error: updateCandidateError } = await adminClient
    .from("duplicate_candidates")
    .update({ status: "confirmed_duplicate", reviewed_by: user.id, reviewed_at: nowIso })
    .eq("id", candidate.id);
  if (updateCandidateError) return jsonResponse({ error: updateCandidateError.message }, 500);

  return jsonResponse({ outcome: "confirmed_duplicate", keptJobId: keepId, removedJobId: removeId });
});
