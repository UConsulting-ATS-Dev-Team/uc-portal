// Stage 3 pilot, per JOB_ENGINE_ARCHITECTURE.md Part 7: the first automated
// job source. Fetches Stripe's public Greenhouse Job Board API
// (developers.greenhouse.io/job-board.html) -- chosen as the pilot over any
// MBB/consulting firm because it's the one source among UC's target
// companies with an officially documented, unauthenticated, explicitly
// third-party-facing API (confirmed against the live docs, not assumed).
// Runs daily via pg_cron (see 20260822140000_schedule_greenhouse_fetch.sql).
//
// Deliberately does NOT request ?content=true or store any full job
// description text -- Greenhouse's API terms cover API *use*, not a
// copyright license from Stripe over the posting text itself (Part 2's
// distinction). Only structured facts (title, location, URL, dates) are
// ever touched, so there's nothing for enforceStorageRestrictions() to need
// to strip here; application_url is the honest way to reach the full
// posting, same as every other source in this app.
//
// Reuses the exact same normalize -> validate -> dedup -> insert pipeline
// approve-submission runs (../_shared/), so a member manually submitting a
// Stripe role that later shows up in this feed correctly merges instead of
// duplicating, and vice versa -- one pipeline, regardless of which source
// governance row a job came through.
//
// Every run writes to source_fetch_log (US-51), success or failure --
// this runs unattended via pg_cron, and a silent failure would otherwise be
// invisible until someone noticed stale data. runFetch() below returns its
// outcome as data rather than calling Response directly, specifically so
// the one logging call in Deno.serve() can sit after every possible exit
// path instead of needing to be duplicated at each one.
//
// Two things found only by running this against the real feed (575 live
// postings), both fixed before this shipped:
// 1. Employment-type coverage: ~90% of Stripe's titles carry no
//    employment-type signal at all (internships/co-ops self-declare in the
//    title by convention; ordinary roles like "Account Executive" don't).
//    normalizeJob()'s "never guess" rule is correct for its original
//    context (ambiguous free-text member submissions) but would drop most
//    of a real external feed if applied unchanged -- this adapter defaults
//    an unclassified title to full_time, documented as this function's own
//    policy, not a change to the shared pipeline.
// 2. Batched I/O: the first version did several DB round-trips per job
//    (job_sources lookup, insert, job_sources insert, job_function lookup)
//    -- fine for a handful of member submissions, but 575 sequential jobs
//    hit Supabase's Edge Function resource limit outright. Rewritten to
//    load every lookup once up front and write in bulk at the end; the
//    O(n^2) in-memory dedup scoring itself (Stage 1's documented, accepted
//    complexity) was never the actual bottleneck.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { normalizeJob } from "../_shared/pipeline/normalize.ts";
import { validateJob, scoreQuality } from "../_shared/pipeline/quality.ts";
import { scoreDuplicate, classifyDuplicateTier } from "../_shared/pipeline/dedupe.ts";
import type { RawJob } from "../_shared/pipeline/types.ts";
import { comparableFromExistingJob, jobInsertFromNormalized } from "../_shared/dedupeHelpers.ts";

const SOURCE_NAME = "Stripe (Greenhouse Job Board API)";
const GREENHOUSE_URL = "https://boards-api.greenhouse.io/v1/boards/stripe/jobs";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  updated_at: string;
  application_deadline: string | null;
  location: { name: string } | null;
}

interface FetchOutcome {
  httpStatus: number;
  body: Record<string, unknown>;
  logStatus: "success" | "failed" | "skipped";
  logSummary: Record<string, unknown>;
}

// deno-lint-ignore no-explicit-any
async function runFetch(adminClient: SupabaseClient, source: any): Promise<FetchOutcome> {
  if (source.authorization_status === "disabled" || source.authorization_status === "not_approved") {
    // §3.7's kill switch -- flip this row and the next scheduled run is a no-op, no code change or redeploy needed.
    const reason = `source is ${source.authorization_status}`;
    return { httpStatus: 200, body: { skipped: true, reason }, logStatus: "skipped", logSummary: { reason } };
  }

  let ghJobs: GreenhouseJob[];
  try {
    const res = await fetch(GREENHOUSE_URL);
    if (!res.ok) throw new Error(`Greenhouse returned HTTP ${res.status}`);
    const body = await res.json();
    ghJobs = body.jobs ?? [];
  } catch (err) {
    // §3.4: never touch existing data on a failed fetch. Report and exit.
    const message = err instanceof Error ? err.message : String(err);
    return { httpStatus: 502, body: { error: `Fetch failed: ${message}` }, logStatus: "failed", logSummary: { error: message } };
  }

  // A near-empty result from a source that normally has hundreds of
  // postings looks like a Greenhouse-side glitch, not "Stripe closed every
  // role" -- still process whatever came back, just skip the expiration
  // sweep below rather than trust a suspicious signal.
  const suspiciouslyEmpty = ghJobs.length < 5;
  const nowIso = new Date().toISOString();

  // ---- Load every lookup once, up front (3 round-trips total) ----
  const [{ data: rawActiveJobs, error: activeJobsError }, { data: existingSources, error: existingSourcesError }, { data: jobFunctions }] = await Promise.all([
    adminClient.from("jobs").select("id, company, title, application_url, remote_type, city, posted_date, salary_min").eq("active", true),
    adminClient.from("job_sources").select("job_id, source_job_id").eq("source_id", source.id),
    adminClient.from("job_functions").select("id, name"),
  ]);
  if (activeJobsError) return failed(`Loading active jobs failed: ${activeJobsError.message}`);
  if (existingSourcesError) return failed(`Loading existing sources failed: ${existingSourcesError.message}`);

  const activeJobs = rawActiveJobs ?? [];
  const jobFunctionIdByName = new Map<string, string>((jobFunctions ?? []).map((f) => [f.name as string, f.id as string]));
  const existingJobIdBySourceJobId = new Map<string, string>((existingSources ?? []).map((r) => [r.source_job_id as string, r.job_id as string]));

  // ---- Score everything in memory -- no DB calls in this loop ----
  const seenSourceJobIds = new Set<string>();
  const refreshJobIds: string[] = []; // already tracked, just seen again
  const mergeAttachments: Array<{ job_id: string; source_id: string; source_job_id: string; source_url: string; is_primary: boolean }> = [];
  const mergeJobIds: string[] = []; // existing jobs to bump last_seen_at on
  const newJobRows: Array<ReturnType<typeof jobInsertFromNormalized> & { id: string }> = [];
  const newJobSources: Array<{ job_id: string; source_id: string; source_job_id: string; source_url: string; is_primary: boolean }> = [];
  const newDuplicateCandidates: Array<{ job_id_a: string; job_id_b: string; score: number; signals: unknown }> = [];
  let skippedInvalid = 0;

  for (const ghJob of ghJobs) {
    const sourceJobId = String(ghJob.id);
    seenSourceJobIds.add(sourceJobId);

    const existingJobId = existingJobIdBySourceJobId.get(sourceJobId);
    if (existingJobId) {
      refreshJobIds.push(existingJobId);
      continue;
    }

    const raw: RawJob = {
      source: { sourceId: source.id, sourceJobId, sourceUrl: ghJob.absolute_url, isPrimary: true },
      company: "Stripe",
      title: ghJob.title.trim(),
      locationText: ghJob.location?.name ?? undefined,
      applicationUrl: ghJob.absolute_url,
      applicationDeadlineText: ghJob.application_deadline ?? undefined,
      updatedDate: ghJob.updated_at ? ghJob.updated_at.slice(0, 10) : undefined,
    };

    let normalized = normalizeJob(raw);
    if (!normalized.employmentType) {
      // Adapter-specific default -- see header comment.
      normalized = { ...normalized, employmentType: "full_time" };
    }

    const issues = validateJob(normalized);
    if (issues.length > 0) {
      skippedInvalid++;
      continue;
    }

    let bestMatch: { jobId: string; score: number; row: Record<string, unknown> } | null = null;
    for (const row of activeJobs) {
      const { score } = scoreDuplicate(normalized, comparableFromExistingJob(row));
      if (!bestMatch || score > bestMatch.score) bestMatch = { jobId: row.id as string, score, row };
    }
    const tier = bestMatch ? classifyDuplicateTier(bestMatch.score) : "distinct";

    if (tier === "auto_merge" && bestMatch) {
      mergeAttachments.push({ job_id: bestMatch.jobId, source_id: source.id, source_job_id: sourceJobId, source_url: ghJob.absolute_url, is_primary: false });
      mergeJobIds.push(bestMatch.jobId);
      continue;
    }

    const qualityScore = scoreQuality(normalized);
    const jobFunctionId = normalized.jobFunction ? jobFunctionIdByName.get(normalized.jobFunction) ?? null : null;
    const newId = crypto.randomUUID();
    newJobRows.push({ id: newId, ...jobInsertFromNormalized(normalized, qualityScore, jobFunctionId) });
    newJobSources.push({ job_id: newId, source_id: source.id, source_job_id: sourceJobId, source_url: ghJob.absolute_url, is_primary: true });

    if (tier === "review" && bestMatch) {
      const { score, signals } = scoreDuplicate(normalized, comparableFromExistingJob(bestMatch.row));
      newDuplicateCandidates.push({ job_id_a: newId, job_id_b: bestMatch.jobId, score, signals });
    }

    // Later jobs in this same run can dedupe against ones scored earlier in
    // this same batch, not only pre-existing rows -- id is pre-generated
    // above so this comparable is real, not a placeholder.
    activeJobs.push({ id: newId, company: normalized.company, title: normalized.title, application_url: normalized.applicationUrl, remote_type: normalized.remoteType, city: normalized.city, posted_date: newJobRows[newJobRows.length - 1].posted_date, salary_min: normalized.salaryMin });
  }

  // ---- Write everything in bulk (bounded number of round-trips, not O(n)) ----
  if (newJobRows.length > 0) {
    const { error } = await adminClient.from("jobs").insert(newJobRows);
    if (error) return failed(`Bulk job insert failed: ${error.message}`);
  }
  const allJobSources = [...newJobSources, ...mergeAttachments];
  if (allJobSources.length > 0) {
    const { error } = await adminClient.from("job_sources").insert(allJobSources);
    if (error) return failed(`Bulk job_sources insert failed: ${error.message}`);
  }
  if (newDuplicateCandidates.length > 0) {
    const { error } = await adminClient.from("duplicate_candidates").insert(newDuplicateCandidates);
    if (error) return failed(`Bulk duplicate_candidates insert failed: ${error.message}`);
  }
  if (mergeJobIds.length > 0) {
    const { error } = await adminClient.from("jobs").update({ last_seen_at: nowIso, updated_at: nowIso }).in("id", [...new Set(mergeJobIds)]);
    if (error) return failed(`Merge freshness update failed: ${error.message}`);
  }
  if (refreshJobIds.length > 0) {
    const { error } = await adminClient
      .from("jobs")
      .update({ last_seen_at: nowIso, last_verified_at: nowIso, status: "active", active: true, updated_at: nowIso })
      .in("id", [...new Set(refreshJobIds)]);
    if (error) return failed(`Refresh update failed: ${error.message}`);
  }

  // Freshness (§3.4): a job previously tracked from this source but absent
  // from today's (successful) fetch is a genuine "this posting is gone"
  // signal -- distinct from the fetch itself failing, already handled above
  // by exiting before touching any data.
  let markedExpired = 0;
  if (!suspiciouslyEmpty) {
    const expiredJobIds = [...existingJobIdBySourceJobId.entries()]
      .filter(([sourceJobId]) => !seenSourceJobIds.has(sourceJobId))
      .map(([, jobId]) => jobId);
    if (expiredJobIds.length > 0) {
      const { data, error } = await adminClient
        .from("jobs")
        .update({ status: "potentially_expired" })
        .in("id", expiredJobIds)
        .eq("active", true)
        .eq("status", "active")
        .select("id");
      if (!error) markedExpired = data?.length ?? 0;
    }
  }

  const summary = {
    fetched: ghJobs.length,
    inserted: newJobRows.length,
    merged: mergeAttachments.length,
    flaggedDuplicate: newDuplicateCandidates.length,
    refreshed: refreshJobIds.length,
    skippedInvalid,
    markedExpired,
    suspiciouslyEmpty,
  };
  return { httpStatus: 200, body: summary, logStatus: "success", logSummary: summary };
}

function failed(message: string): FetchOutcome {
  return { httpStatus: 500, body: { error: message }, logStatus: "failed", logSummary: { error: message } };
}

Deno.serve(async (_req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const startedAt = new Date().toISOString();

  const { data: source, error: sourceError } = await adminClient.from("sources").select("*").eq("name", SOURCE_NAME).single();
  if (sourceError || !source) {
    // No source row to attribute a log entry to -- nothing to record against.
    return jsonResponse({ error: `Source "${SOURCE_NAME}" not found -- has the seed migration been applied?` }, 500);
  }

  const outcome = await runFetch(adminClient, source);

  await adminClient.from("source_fetch_log").insert({
    source_id: source.id,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    status: outcome.logStatus,
    summary: outcome.logSummary,
  });

  return jsonResponse(outcome.body, outcome.httpStatus);
});
