// US-61 (P2, job-trend insights over time) data-collection foundation --
// see JOB_ENGINE_ARCHITECTURE.md's dated entry for this function and its
// migration for the full rationale. This function does NOT build the
// trend-insights feature itself; it only starts recording the daily
// point-in-time board summary that feature will eventually read from.
//
// Scheduled daily via pg_cron + pg_net, same mechanism every other
// scheduled function in this app already uses. Deliberately the simplest
// of the scheduled functions: the actual aggregation is real SQL
// (compute_job_board_snapshot(), migration 20260831240000) run once --
// no unbounded client-side .select() over `jobs` at all, so there's no
// PostgREST pagination boundary to trip over (the exact bug class Part 7
// Stage 4 already hit twice at real scale). This function's own job is
// just: call that one RPC, upsert the resulting row keyed by today's date,
// and log the run -- same success/failed/skipped shape check-job-links
// established, reused here rather than inventing a fourth log shape.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const SOURCE_NAME = "Job Board Snapshot";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

interface FetchOutcome {
  httpStatus: number;
  body: Record<string, unknown>;
  logStatus: "success" | "failed" | "skipped";
  logSummary: Record<string, unknown>;
}

function failed(message: string): FetchOutcome {
  return { httpStatus: 500, body: { error: message }, logStatus: "failed", logSummary: { error: message } };
}

interface SnapshotRow {
  total_active_jobs: number;
  distinct_companies: number;
  avg_quality_score: number | null;
  jobs_by_company: Record<string, number>;
  jobs_by_job_function: Record<string, number>;
  jobs_by_employment_type: Record<string, number>;
  jobs_by_link_health: Record<string, number>;
}

// deno-lint-ignore no-explicit-any
async function runSnapshot(adminClient: SupabaseClient, source: any): Promise<FetchOutcome> {
  if (source.authorization_status === "disabled" || source.authorization_status === "not_approved") {
    // Same §3.7 kill switch every other scheduled function honors -- flip
    // this row on SourceManagement.jsx and the next scheduled run skips
    // it, no redeploy needed.
    const reason = `source is ${source.authorization_status}`;
    return { httpStatus: 200, body: { skipped: true, reason }, logStatus: "skipped", logSummary: { reason } };
  }

  const { data, error } = await adminClient.rpc("compute_job_board_snapshot");
  if (error) return failed(`compute_job_board_snapshot failed: ${error.message}`);
  if (!data || data.length === 0) return failed("compute_job_board_snapshot returned no row");

  const row = data[0] as SnapshotRow;
  // A plain UTC calendar date, not a timestamp -- one row is meant to
  // represent "the board as of this day," and pg_cron always invokes this
  // at the same UTC instant, so this is stable run-to-run.
  const snapshotDate = new Date().toISOString().slice(0, 10);

  // Upsert on snapshot_date rather than a plain insert: today's manual
  // first-run (per the task brief -- "run it once manually right now") and
  // tonight's/tomorrow's cron run should never collide into a unique-
  // constraint error just because both happen to land on the same UTC
  // date. A same-day re-run overwriting with the latest count is the
  // correct behavior for a point-in-time summary, same idempotency
  // expectation every other scheduled function here already verifies
  // ("re-invoked, correctly recognized as already-tracked").
  const { error: upsertError } = await adminClient
    .from("job_board_snapshots")
    .upsert(
      {
        snapshot_date: snapshotDate,
        total_active_jobs: row.total_active_jobs,
        distinct_companies: row.distinct_companies,
        avg_quality_score: row.avg_quality_score,
        jobs_by_company: row.jobs_by_company,
        jobs_by_job_function: row.jobs_by_job_function,
        jobs_by_employment_type: row.jobs_by_employment_type,
        jobs_by_link_health: row.jobs_by_link_health,
      },
      { onConflict: "snapshot_date" },
    );
  if (upsertError) return failed(`Writing job_board_snapshots failed: ${upsertError.message}`);

  const summary = {
    snapshotDate,
    totalActiveJobs: row.total_active_jobs,
    distinctCompanies: row.distinct_companies,
    avgQualityScore: row.avg_quality_score,
  };
  return { httpStatus: 200, body: summary, logStatus: "success", logSummary: summary };
}

Deno.serve(async (_req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const startedAt = new Date().toISOString();

  const { data: source, error: sourceError } = await adminClient.from("sources").select("*").eq("name", SOURCE_NAME).single();
  if (sourceError || !source) {
    return jsonResponse({ error: `Source "${SOURCE_NAME}" not found -- has the seed migration been applied?` }, 500);
  }

  const outcome = await runSnapshot(adminClient, source);

  await adminClient.from("source_fetch_log").insert({
    source_id: source.id,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    status: outcome.logStatus,
    summary: outcome.logSummary,
  });

  return jsonResponse(outcome.body, outcome.httpStatus);
});
