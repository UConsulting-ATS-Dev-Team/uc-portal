// Generalizes fetch-greenhouse-stripe (Stage 3's pilot) into a single
// adapter that runs every configured Greenhouse company, driven by data
// (sources.config), not one Edge Function per company. Adding company #8
// is a migration (insert into sources with config {"platform":
// "greenhouse", "slug": ..., "company": ...}), not a new deploy.
//
// All 7 companies configured as of this writing (Stripe, Databricks,
// Coinbase, Airbnb, Brex, Figma, Robinhood) go through the exact same
// legal mechanism already vetted for Stripe -- Greenhouse's own documented,
// unauthenticated, explicitly third-party-facing Job Board API
// (developers.greenhouse.io/job-board.html). That's the terms of the
// platform itself, not per-customer, so a new Greenhouse company doesn't
// need the same from-scratch legal research a new *mechanism* (like
// Deloitte's RSS feed) did -- it still gets the same company-identity
// verification every adapter in this app applies (Greenhouse's own
// company_name field on each job, cross-checked against what's configured,
// same spirit as check-company-source.mjs's slug-collision catch that
// caught "Oliver Wyman Labs" masquerading as Oliver Wyman during this
// same round of research).
//
// Scale fix applied from the start (learned the hard way on Stripe, then
// on the Deloitte rewrite): dedup-scoring a new job against every OTHER
// company's active jobs is pure wasted work -- scoreDuplicate()'s signals
// (canonical URL, source_job_id, company+title+location) all require a
// company match to mean anything, so cross-company comparisons can only
// ever score 0. Filtering the comparison set to each company's own
// existing jobs before scoring turns what would have been a single O(n^2)
// pass over ~2,400 combined jobs (all 7 companies, one company alone
// contributing 820) into 7 much smaller independent passes, each bounded
// by that one company's own job count -- correctness-preserving, not an
// approximation.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { normalizeJob } from "../_shared/pipeline/normalize.ts";
import { validateJob, scoreQuality } from "../_shared/pipeline/quality.ts";
import { scoreDuplicate, classifyDuplicateTier } from "../_shared/pipeline/dedupe.ts";
import { isLikelySeniorRole } from "../_shared/pipeline/relevance.ts";
import type { RawJob } from "../_shared/pipeline/types.ts";
import { comparableFromExistingJob, jobInsertFromNormalized, fetchAllRows } from "../_shared/dedupeHelpers.ts";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// fetchAllRows moved to ../_shared/dedupeHelpers.ts -- approve-submission
// and fetch-deloitte-jobs turned out to have the exact same unbounded-
// .select() risk against `jobs`/`job_sources`, so the pagination fix now
// lives in one place instead of three.

// PostgREST encodes .in() filters into the request URL's query string
// regardless of HTTP method, which has a real length limit -- confirmed
// live: a refresh update against ~600 already-tracked Databricks jobs
// failed outright ("Bad Request") once the backfill built up enough
// tracked jobs for one company. Chunking keeps every .in() call well
// under that limit permanently, not just for today's backfill -- this was
// going to fail on every future daily run once any company had a few
// hundred already-tracked jobs, not just during the initial backfill.
const UPDATE_BATCH_SIZE = 200;
async function updateInBatches(adminClient: SupabaseClient, ids: string[], fields: Record<string, unknown>): Promise<string | null> {
  const uniqueIds = [...new Set(ids)];
  for (let i = 0; i < uniqueIds.length; i += UPDATE_BATCH_SIZE) {
    const batch = uniqueIds.slice(i, i + UPDATE_BATCH_SIZE);
    const { error } = await adminClient.from("jobs").update(fields).in("id", batch);
    if (error) return error.message;
  }
  return null;
}

// See the deferral comment in runFetchForCompany's main loop -- this is
// the actual ceiling that keeps a single very large first-run backfill
// (Databricks: 820 postings, zero pre-existing) from tripping Supabase's
// Edge Function compute limit. Steady-state daily runs process far fewer
// than this per company (only that day's genuinely new postings), so it
// never engages once a company's initial backfill is complete.
const MAX_NEW_JOBS_PER_RUN = 150;

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  updated_at: string;
  application_deadline: string | null;
  location: { name: string } | null;
  company_name?: string;
}

interface FetchOutcome {
  logStatus: "success" | "failed" | "skipped";
  logSummary: Record<string, unknown>;
}

function failed(message: string): FetchOutcome {
  return { logStatus: "failed", logSummary: { error: message } };
}

async function runFetchForCompany(
  adminClient: SupabaseClient,
  // deno-lint-ignore no-explicit-any
  source: any,
  activeJobsForCompany: Array<Record<string, unknown>>,
  existingJobIdBySourceJobId: Map<string, string>,
  jobFunctionIdByName: Map<string, string>,
): Promise<FetchOutcome> {
  const slug = source.config?.slug as string | undefined;
  const company = source.config?.company as string | undefined;
  if (!slug || !company) return failed(`Source "${source.name}" is missing config.slug or config.company`);

  if (source.authorization_status === "disabled" || source.authorization_status === "not_approved") {
    // §3.7's kill switch -- flip this row and the next scheduled run skips it, no code change or redeploy needed.
    const reason = `source is ${source.authorization_status}`;
    return { logStatus: "skipped", logSummary: { reason } };
  }

  let ghJobs: GreenhouseJob[];
  try {
    const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`);
    if (!res.ok) throw new Error(`Greenhouse returned HTTP ${res.status}`);
    const body = await res.json();
    ghJobs = body.jobs ?? [];
  } catch (err) {
    // §3.4: never touch existing data on a failed fetch. Report and exit.
    const message = err instanceof Error ? err.message : String(err);
    return failed(`Fetch failed: ${message}`);
  }

  const suspiciouslyEmpty = ghJobs.length < 5;
  const nowIso = new Date().toISOString();
  const activeJobs = [...activeJobsForCompany]; // local copy -- safe to push into during this company's own loop

  const seenSourceJobIds = new Set<string>();
  const refreshJobIds: string[] = [];
  const mergeAttachments: Array<{ job_id: string; source_id: string; source_job_id: string; source_url: string; is_primary: boolean }> = [];
  const mergeJobIds: string[] = [];
  const newJobRows: Array<ReturnType<typeof jobInsertFromNormalized> & { id: string }> = [];
  const newJobSources: Array<{ job_id: string; source_id: string; source_job_id: string; source_url: string; is_primary: boolean }> = [];
  const newDuplicateCandidates: Array<{ job_id_a: string; job_id_b: string; score: number; signals: unknown }> = [];
  let skippedInvalid = 0;
  let skippedCompanyMismatch = 0;
  let skippedNotRelevant = 0;
  let deferred = 0;

  for (const ghJob of ghJobs) {
    const sourceJobId = String(ghJob.id);
    seenSourceJobIds.add(sourceJobId); // present in today's feed either way -- see freshness note below

    const existingJobId = existingJobIdBySourceJobId.get(sourceJobId);
    if (existingJobId) {
      refreshJobIds.push(existingJobId);
      continue;
    }

    // Relevance filter -- see _shared/pipeline/relevance.ts's header comment
    // for the full rationale (Greenhouse returns a company's entire board,
    // not just entry-level roles, so most of what comes back for a large
    // tech employer is senior/management roles no UC undergrad would apply
    // to). Checked before the MAX_NEW_JOBS_PER_RUN deferral below so a
    // company's per-day budget of "new postings actually processed" isn't
    // spent scoring/inserting roles that were never going to be kept
    // anyway. Only gates brand-new postings, not already-tracked ones --
    // this is forward-looking, not a retroactive cleanup of what's already
    // in the table (see JOB_ENGINE_ARCHITECTURE.md's Stage 4 entry for why
    // that's a separate, deliberately-reviewed decision).
    if (isLikelySeniorRole(ghJob.title)) {
      skippedNotRelevant++;
      continue;
    }

    // Bounds the O(n^2) intra-company dedup loop below for a large
    // first-run backfill (confirmed necessary: even with tokenize()
    // memoized, scoring 820 brand-new Databricks postings against a
    // same-company set growing to 820 still tripped Supabase's Edge
    // Function compute limit -- jaccardSimilarity's own per-call set
    // operations are the real O(n^2) cost, not just redundant tokenizing).
    // Deferred jobs are marked "seen" above (they genuinely are present in
    // the feed, just not processed this run) so the freshness sweep never
    // mistakes "haven't gotten to it yet" for "this posting closed", and
    // they're picked up automatically on the next run -- job_sources has
    // no record of them yet, so they'll hit this same branch again, not
    // this deferral one, until they're actually processed.
    if (newJobRows.length + mergeAttachments.length >= MAX_NEW_JOBS_PER_RUN) {
      deferred++;
      continue;
    }

    // Same identity safeguard as check-company-source.mjs and
    // fetch-deloitte-jobs -- a board slug or a future config typo pointing
    // at the wrong company shouldn't silently attribute someone else's
    // posting to this one.
    if (ghJob.company_name && ghJob.company_name.trim().toLowerCase() !== company.toLowerCase()) {
      skippedCompanyMismatch++;
      continue;
    }

    const raw: RawJob = {
      source: { sourceId: source.id, sourceJobId, sourceUrl: ghJob.absolute_url, isPrimary: true },
      company,
      title: ghJob.title.trim(),
      locationText: ghJob.location?.name ?? undefined,
      applicationUrl: ghJob.absolute_url,
      applicationDeadlineText: ghJob.application_deadline ?? undefined,
      updatedDate: ghJob.updated_at ? ghJob.updated_at.slice(0, 10) : undefined,
    };

    let normalized = normalizeJob(raw);
    if (!normalized.employmentType) {
      // Adapter-specific default -- confirmed on Stripe that most external
      // ATS titles carry no employment-type signal at all (internships
      // self-declare in the title by convention; ordinary roles don't).
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
    newJobRows.push({ id: newId, ...jobInsertFromNormalized(normalized, qualityScore, jobFunctionId, source.storage_restrictions) });
    newJobSources.push({ job_id: newId, source_id: source.id, source_job_id: sourceJobId, source_url: ghJob.absolute_url, is_primary: true });

    if (tier === "review" && bestMatch) {
      const { score, signals } = scoreDuplicate(normalized, comparableFromExistingJob(bestMatch.row));
      newDuplicateCandidates.push({ job_id_a: newId, job_id_b: bestMatch.jobId, score, signals });
    }

    activeJobs.push({ id: newId, company: normalized.company, title: normalized.title, application_url: normalized.applicationUrl, remote_type: normalized.remoteType, city: normalized.city, posted_date: newJobRows[newJobRows.length - 1].posted_date, salary_min: normalized.salaryMin });
  }

  if (newJobRows.length > 0) {
    const { error } = await adminClient.from("jobs").insert(newJobRows);
    if (error) return failed(`Bulk job insert failed: ${error.message}`);
  }
  const allJobSources = [...newJobSources, ...mergeAttachments];
  if (allJobSources.length > 0) {
    // Deliberately a plain insert, not an upsert/ignoreDuplicates -- that
    // was tried as a first fix for a real "duplicate key" failure here,
    // but it was masking the actual bug (fetchAllRows' pagination fix
    // above), not handling a legitimate case. A (source_id, source_job_id)
    // collision at this point means existingJobIdBySourceJobId was wrong
    // about this job being new, which should fail loudly -- silently
    // swallowing it risks hiding real data-integrity problems the same
    // way ignoreDuplicates did here.
    const { error } = await adminClient.from("job_sources").insert(allJobSources);
    if (error) return failed(`Bulk job_sources insert failed: ${error.message}`);
  }
  if (newDuplicateCandidates.length > 0) {
    const { error } = await adminClient.from("duplicate_candidates").insert(newDuplicateCandidates);
    if (error) return failed(`Bulk duplicate_candidates insert failed: ${error.message}`);
  }
  if (mergeJobIds.length > 0) {
    const error = await updateInBatches(adminClient, mergeJobIds, { last_seen_at: nowIso, updated_at: nowIso });
    if (error) return failed(`Merge freshness update failed: ${error}`);
  }
  if (refreshJobIds.length > 0) {
    const error = await updateInBatches(adminClient, refreshJobIds, {
      last_seen_at: nowIso,
      last_verified_at: nowIso,
      status: "active",
      active: true,
      updated_at: nowIso,
    });
    if (error) return failed(`Refresh update failed: ${error}`);
  }

  // Freshness (§3.4): each company's Greenhouse board is exhaustive (every
  // current posting, one call), so "tracked before, absent today" is a
  // real "this posting closed" signal here -- unlike Deloitte's capped
  // RSS feed, where the same inference would be dishonest.
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
    skippedCompanyMismatch,
    skippedNotRelevant,
    deferred,
    markedExpired,
    suspiciouslyEmpty,
  };
  return { logStatus: "success", logSummary: summary };
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // Optional { slug } body scopes this run to one company -- exists for
  // controlled backfilling. Confirmed necessary in practice: processing 6
  // brand-new companies' full catalogs at once (a combined ~1,767 postings
  // with zero prior tracking, so none of them take the cheap "already
  // tracked" refresh path) hit Supabase's Edge Function resource limit,
  // the same class of problem fetch-greenhouse-stripe hit once before. The
  // daily cron omits this and processes every configured company -- safe
  // in steady state, since after the one-time backfill each run only does
  // real work for that day's actual new/changed postings, not a full
  // catalog per company.
  let onlySlug: string | undefined;
  try {
    const body = await req.json();
    onlySlug = body?.slug;
  } catch {
    // no body / not JSON -- fine, means "run every configured company"
  }

  const sourcesQuery = adminClient
    .from("sources")
    .select("*")
    .eq("type", "employer_api")
    .eq("config->>platform", "greenhouse");
  const { data: sources, error: sourcesError } = onlySlug
    ? await sourcesQuery.eq("config->>slug", onlySlug)
    : await sourcesQuery;
  if (sourcesError) return jsonResponse({ error: sourcesError.message }, 500);
  if (!sources || sources.length === 0) return jsonResponse({ error: `No Greenhouse sources configured${onlySlug ? ` for slug "${onlySlug}"` : ""}` }, 500);

  // Shared lookups, fetched once and reused across every company -- the
  // per-company scoping happens in memory below, not via N separate
  // queries. Paginated via fetchAllRows() -- confirmed the hard way that a
  // plain .select() silently truncates at PostgREST's default page size
  // (1000 rows) once combined job_sources/active-jobs volume across all 7
  // companies passed that mark, which caused a real, serious bug: jobs
  // that genuinely already had a job_sources row fell outside the
  // truncated result, got miscategorized as "not yet tracked" on every
  // run, and repeatedly created orphaned duplicate jobs rows (masked, not
  // fixed, by job_sources' upsert/ignoreDuplicates silently swallowing the
  // resulting conflict instead of erroring).
  let rawActiveJobs: Record<string, unknown>[], jobFunctions: Record<string, unknown>[], allJobSourceRows: Record<string, unknown>[];
  try {
    [rawActiveJobs, jobFunctions, allJobSourceRows] = await Promise.all([
      fetchAllRows(adminClient, "jobs", "id, company, title, application_url, remote_type, city, posted_date, salary_min", (q) => q.eq("active", true)),
      fetchAllRows(adminClient, "job_functions", "id, name"),
      fetchAllRows(adminClient, "job_sources", "source_id, job_id, source_job_id", (q) => q.in("source_id", sources.map((s) => s.id))),
    ]);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }

  const jobFunctionIdByName = new Map<string, string>((jobFunctions ?? []).map((f) => [f.name as string, f.id as string]));

  const activeJobsByCompany = new Map<string, Array<Record<string, unknown>>>();
  for (const job of rawActiveJobs ?? []) {
    const company = job.company as string;
    if (!activeJobsByCompany.has(company)) activeJobsByCompany.set(company, []);
    activeJobsByCompany.get(company)!.push(job);
  }

  const jobSourcesBySourceId = new Map<string, Array<{ job_id: string; source_job_id: string }>>();
  for (const row of allJobSourceRows ?? []) {
    const sourceId = row.source_id as string;
    if (!jobSourcesBySourceId.has(sourceId)) jobSourcesBySourceId.set(sourceId, []);
    jobSourcesBySourceId.get(sourceId)!.push({ job_id: row.job_id as string, source_job_id: row.source_job_id as string });
  }

  const results = await Promise.all(
    sources.map(async (source) => {
      const startedAt = new Date().toISOString();
      const company = source.config?.company as string | undefined;
      const existingJobIdBySourceJobId = new Map<string, string>(
        (jobSourcesBySourceId.get(source.id) ?? []).map((r) => [r.source_job_id, r.job_id]),
      );
      const outcome = await runFetchForCompany(
        adminClient,
        source,
        company ? activeJobsByCompany.get(company) ?? [] : [],
        existingJobIdBySourceJobId,
        jobFunctionIdByName,
      );

      await adminClient.from("source_fetch_log").insert({
        source_id: source.id,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        status: outcome.logStatus,
        summary: outcome.logSummary,
      });

      return { source: source.name, ...outcome.logSummary, status: outcome.logStatus };
    }),
  );

  return jsonResponse({ results });
});
