// Ashby ingestion adapter -- same config-driven architecture as fetch-greenhouse-companies and
// fetch-lever-companies (sources.config rows with {platform: "ashby", slug, company}, one Edge Function for every
// configured Ashby company), reusing the same shared pipeline (dedupeHelpers.ts, normalize.ts, relevance.ts,
// companyCap.ts, quality.ts) instead of duplicating any of that logic.
//
// Ashby's public Job Posting API (api.ashbyhq.com/posting-api/job-board/{board}) is Ashby's own documented,
// unauthenticated, third-party-facing job board API -- the same legal category as Greenhouse's Job Board API and
// Lever's Postings API. Its shape and how this adapter maps it (employment types, structured locations,
// compensation, identity check) are in _shared/ashbyAdapter.ts, which is unit-tested
// (server/tests/ashbyAdapter.test.ts).
//
// Added 2026-10-03 because many of the best-known startups (Ramp, Plaid, Notion, OpenAI, ...) post only on Ashby.
// Batched like Greenhouse ({"batch": N}, stalest companies first): anything that scales with company count has to be.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { normalizeJob } from "../_shared/pipeline/normalize.ts";
import { validateJob, scoreQuality } from "../_shared/pipeline/quality.ts";
import { scoreDuplicate, classifyDuplicateTier } from "../_shared/pipeline/dedupe.ts";
import { isLikelySeniorRole, isLikelyNonCorporateRole } from "../_shared/pipeline/relevance.ts";
import type { RawJob } from "../_shared/pipeline/types.ts";
import { comparableFromExistingJob, jobInsertFromNormalized, fetchAllRows, updateInBatches, enforceCompanyCap, backfillJobLocations } from "../_shared/dedupeHelpers.ts";
import { capForCompanyTier, indexCompanyTiers } from "../_shared/pipeline/companyCap.ts";
import { requireCronSecret } from "../_shared/requireCronSecret.ts";
import { claimRunOrSkip } from "../_shared/dedupeRun.ts";
import {
  type AshbyPosting,
  ashbyCompensationText,
  ashbyEmploymentTypeText,
  ashbyPostedDate,
  buildAshbyLocationText,
  isContractOrTemporary,
  jobUrlMatchesSlug,
} from "../_shared/ashbyAdapter.ts";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// Same ceiling as the other ATS adapters: keeps a large first-run backfill from tripping the Edge Function limit.
const MAX_NEW_JOBS_PER_RUN = 150;

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
  jobFunctionNameById: Map<string, string>,
  companyTierByName: Map<string, number>,
): Promise<FetchOutcome> {
  const slug = source.config?.slug as string | undefined;
  const company = source.config?.company as string | undefined;
  if (!slug || !company) return failed(`Source "${source.name}" is missing config.slug or config.company`);

  if (source.authorization_status === "disabled" || source.authorization_status === "not_approved") {
    // §3.7's kill switch, same as every other adapter.
    const reason = `source is ${source.authorization_status}`;
    return { logStatus: "skipped", logSummary: { reason } };
  }

  let ashbyJobs: AshbyPosting[];
  try {
    // includeCompensation adds the structured pay components (read by ashbyCompensationText).
    const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}?includeCompensation=true`);
    if (!res.ok) throw new Error(`Ashby returned HTTP ${res.status}`);
    const body = await res.json();
    // isListed: false postings are not on the public board.
    ashbyJobs = ((body?.jobs ?? []) as AshbyPosting[]).filter((j) => j.isListed !== false);
  } catch (err) {
    // §3.4: never touch existing data on a failed fetch. Report and exit.
    const message = err instanceof Error ? err.message : String(err);
    return failed(`Fetch failed: ${message}`);
  }

  const suspiciouslyEmpty = ashbyJobs.length < 5;
  const nowIso = new Date().toISOString();
  const activeJobs = [...activeJobsForCompany]; // local copy -- safe to push into during this company's own loop

  const seenSourceJobIds = new Set<string>();
  const refreshJobIds: string[] = [];
  const locationBackfill: Array<{ id: string; locationText: string | undefined }> = [];
  const mergeAttachments: Array<{ job_id: string; source_id: string; source_job_id: string; source_url: string; is_primary: boolean }> = [];
  const mergeJobIds: string[] = [];
  const newJobRows: Array<ReturnType<typeof jobInsertFromNormalized> & { id: string }> = [];
  const newJobSources: Array<{ job_id: string; source_id: string; source_job_id: string; source_url: string; is_primary: boolean }> = [];
  const newDuplicateCandidates: Array<{ job_id_a: string; job_id_b: string; score: number; signals: unknown }> = [];
  let skippedInvalid = 0;
  let skippedCompanyMismatch = 0;
  let skippedNotRelevant = 0;
  let skippedContract = 0;
  let deferred = 0;

  for (const ashbyJob of ashbyJobs) {
    const sourceJobId = String(ashbyJob.id);
    seenSourceJobIds.add(sourceJobId); // present in today's feed either way -- see freshness note below

    const existingJobId = existingJobIdBySourceJobId.get(sourceJobId);
    if (existingJobId) {
      refreshJobIds.push(existingJobId);
      locationBackfill.push({ id: existingJobId, locationText: buildAshbyLocationText(ashbyJob) });
      continue;
    }

    // The jobs table has no contract type, so contract/temporary postings are skipped rather than mislabelled.
    if (isContractOrTemporary(ashbyJob)) {
      skippedContract++;
      continue;
    }

    const title = (ashbyJob.title ?? "").trim();

    // Same relevance filter as every other ATS adapter -- see _shared/pipeline/relevance.ts. Checked before the
    // MAX_NEW_JOBS_PER_RUN deferral so a company's per-run budget isn't spent on roles never going to be kept.
    if (isLikelySeniorRole(title) || isLikelyNonCorporateRole(title)) {
      skippedNotRelevant++;
      continue;
    }

    if (newJobRows.length + mergeAttachments.length >= MAX_NEW_JOBS_PER_RUN) {
      deferred++;
      continue;
    }

    // Identity safeguard -- see jobUrlMatchesSlug's comment in _shared/ashbyAdapter.ts for what it does and does
    // not catch (an Ashby posting carries no company name).
    if (!jobUrlMatchesSlug(ashbyJob.jobUrl, slug)) {
      skippedCompanyMismatch++;
      continue;
    }

    const jobUrl = ashbyJob.jobUrl as string; // jobUrlMatchesSlug above confirmed it is present and well-formed
    const raw: RawJob = {
      source: { sourceId: source.id, sourceJobId, sourceUrl: jobUrl, isPrimary: true },
      company,
      title,
      // Ashby's own employmentType (Intern / FullTime / PartTime), as wording the shared normalizer reads.
      employmentTypeText: ashbyEmploymentTypeText(ashbyJob.employmentType),
      locationText: buildAshbyLocationText(ashbyJob),
      applicationUrl: jobUrl,
      postedDate: ashbyPostedDate(ashbyJob.publishedAt),
      compensationText: ashbyCompensationText(ashbyJob),
    };

    let normalized = normalizeJob(raw);
    if (!normalized.employmentType) {
      // Same adapter-level judgment call as Greenhouse's, kept as a safety
      // net -- verified live that categories.commitment covers every real
      // posting on both Wealthfront's and Belvedere Trading's boards, so
      // this is expected to engage far less often than Greenhouse's ~90%
      // fallback rate, not a primary path here.
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
      mergeAttachments.push({ job_id: bestMatch.jobId, source_id: source.id, source_job_id: sourceJobId, source_url: jobUrl, is_primary: false });
      mergeJobIds.push(bestMatch.jobId);
      continue;
    }

    const qualityScore = scoreQuality(normalized);
    const jobFunctionId = normalized.jobFunction ? jobFunctionIdByName.get(normalized.jobFunction) ?? null : null;
    const newId = crypto.randomUUID();
    newJobRows.push({ id: newId, ...jobInsertFromNormalized(normalized, qualityScore, jobFunctionId, source.storage_restrictions) });
    newJobSources.push({ job_id: newId, source_id: source.id, source_job_id: sourceJobId, source_url: jobUrl, is_primary: true });

    if (tier === "review" && bestMatch) {
      const { score, signals } = scoreDuplicate(normalized, comparableFromExistingJob(bestMatch.row));
      newDuplicateCandidates.push({ job_id_a: newId, job_id_b: bestMatch.jobId, score, signals });
    }

    activeJobs.push({ id: newId, company: normalized.company, title: normalized.title, application_url: normalized.applicationUrl, remote_type: normalized.remoteType, city: normalized.city, posted_date: newJobRows[newJobRows.length - 1].posted_date, salary_min: normalized.salaryMin });
  }

  const allJobSources = [...newJobSources, ...mergeAttachments];
  if (newJobRows.length > 0 || allJobSources.length > 0) {
    // One transaction for the new jobs and their job_sources rows -- see
    // fetch-greenhouse-companies for why (a run stopped between two separate
    // inserts left orphaned jobs that never expired or got capped). Still a
    // plain insert: a (source_id, source_job_id) collision means
    // existingJobIdBySourceJobId was wrong, which should fail loudly.
    const { error } = await adminClient.rpc("insert_jobs_with_sources", { p_jobs: newJobRows, p_sources: allJobSources });
    if (error) return failed(`Bulk job + job_sources insert failed: ${error.message}${error.details ? ` -- ${error.details}` : ""}`);
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
      missed_fetches: 0,
      updated_at: nowIso,
    });
    if (error) return failed(`Refresh update failed: ${error}`);
  }
  // Location fix-up for jobs already tracked (see backfillJobLocations). A failure here is reported in the
  // run summary but never fails the run.
  const locationResult = await backfillJobLocations(adminClient, locationBackfill);

  // Freshness (§3.4/US-22/23) -- same reasoning as fetch-greenhouse-companies:
  // each company's Ashby board is exhaustive (every current posting, one
  // call), so "tracked before, absent today" is a real "this posting
  // closed" signal here, not a capped-feed artifact.
  let markedPotentiallyExpired = 0;
  let markedFullyExpired = 0;
  if (!suspiciouslyEmpty) {
    const expiredJobIds = [...existingJobIdBySourceJobId.entries()]
      .filter(([sourceJobId]) => !seenSourceJobIds.has(sourceJobId))
      .map(([, jobId]) => jobId);
    if (expiredJobIds.length > 0) {
      const { data, error } = await adminClient.rpc("mark_jobs_missed", { job_ids: expiredJobIds });
      if (!error) {
        markedPotentiallyExpired = (data ?? []).filter((r: { new_status: string }) => r.new_status === "potentially_expired").length;
        markedFullyExpired = (data ?? []).filter((r: { new_status: string }) => r.new_status === "expired").length;
      }
    }
  }

  // Same per-company cap as every other adapter, enforced last so it sees
  // this company's true post-insert/refresh/expire active set. cap is now
  // resolved per-company from company_tiers (defaulting to tier 3's cap for
  // anything not in that table) rather than one flat number for everyone --
  // see companyCap.ts's "Company-tier cap" section for the full rationale.
  let capDeactivated = 0;
  const cap = capForCompanyTier(companyTierByName.get(company));
  const { deactivatedCount, error: capError } = await enforceCompanyCap(adminClient, company, jobFunctionNameById, cap);
  if (capError) return failed(`Company cap enforcement failed: ${capError}`);
  capDeactivated = deactivatedCount;

  const summary = {
    fetched: ashbyJobs.length,
    inserted: newJobRows.length,
    merged: mergeAttachments.length,
    flaggedDuplicate: newDuplicateCandidates.length,
    refreshed: refreshJobIds.length,
    locationsBackfilled: locationResult.updated,
    ...(locationResult.error ? { locationBackfillError: locationResult.error } : {}),
    skippedInvalid,
    skippedCompanyMismatch,
    skippedNotRelevant,
    skippedContract,
    deferred,
    markedPotentiallyExpired,
    markedFullyExpired,
    capDeactivated,
    suspiciouslyEmpty,
  };
  return { logStatus: "success", logSummary: summary };
}

Deno.serve(async (req) => {
  const authError = requireCronSecret(req);
  if (authError) return authError;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // Optional { slug } body scopes this run to one company -- same
  // controlled-backfill escape hatch as fetch-greenhouse-companies. The
  // daily cron omits this and processes every configured Ashby company.
  //
  // Optional { batch: N } processes only the N least-recently-fetched
  // companies, same as fetch-greenhouse-companies (see its header for why:
  // an all-companies run stopped finishing there at ~160 companies, and a run
  // killed between its jobs insert and its job_sources insert leaves orphaned
  // jobs behind). Scheduled in batches (see the schedule migration), the same way as Greenhouse.
  let onlySlug: string | undefined;
  let batchSize: number | undefined;
  try {
    const body = await req.json();
    onlySlug = body?.slug;
    if (Number.isInteger(body?.batch) && body.batch > 0) batchSize = body.batch;
  } catch {
    // no body / not JSON -- fine, means "run every configured company"
  }

  // Real, confirmed-live pg_net duplicate-delivery mitigation -- see
  // cron_run_locks' migration header. Keyed by slug too (not just
  // "ashby"), so a deliberate manual single-company backfill never
  // collides with, or gets suppressed by, the unrelated daily full run.
  if (!(await claimRunOrSkip(adminClient, `ashby:${onlySlug ?? (batchSize ? "batch" : "*")}`))) {
    return jsonResponse({ skipped: true, reason: "duplicate invocation suppressed" }, 200);
  }

  const sourcesQuery = adminClient
    .from("sources")
    .select("*")
    .eq("type", "employer_api")
    .eq("config->>platform", "ashby");
  const { data: allSources, error: sourcesError } = onlySlug
    ? await sourcesQuery.eq("config->>slug", onlySlug)
    : await sourcesQuery;
  if (sourcesError) return jsonResponse({ error: sourcesError.message }, 500);
  if (!allSources || allSources.length === 0) return jsonResponse({ error: `No Ashby sources configured${onlySlug ? ` for slug "${onlySlug}"` : ""}` }, 500);

  let sources = allSources;
  if (!onlySlug && batchSize) {
    const { data: staleIds, error: staleError } = await adminClient.rpc("oldest_fetched_sources", {
      p_platform: "ashby",
      p_limit: batchSize,
    });
    // If the ordering lookup fails, fall back to the full set rather than
    // skipping the run -- same as a body-less call.
    if (!staleError && Array.isArray(staleIds) && staleIds.length > 0) {
      const keep = new Set<string>(staleIds as string[]);
      sources = allSources.filter((s) => keep.has(s.id as string));
    }
  }
  // A scoped run (one slug, or a batch) only loads its own companies' jobs.
  const scopedCompanies =
    onlySlug || batchSize
      ? sources.map((s) => s.config?.company as string | undefined).filter((c): c is string => !!c)
      : null;

  // Shared lookups, fetched once and reused across every company -- same
  // pagination-safe fetchAllRows() as fetch-greenhouse-companies (a plain
  // .select() silently truncates at PostgREST's 1000-row default page size).
  let rawActiveJobs: Record<string, unknown>[], jobFunctions: Record<string, unknown>[], allJobSourceRows: Record<string, unknown>[], companyTiers: Record<string, unknown>[];
  try {
    [rawActiveJobs, jobFunctions, allJobSourceRows, companyTiers] = await Promise.all([
      fetchAllRows(adminClient, "jobs", "id, company, title, application_url, remote_type, city, posted_date, salary_min", (q) =>
        scopedCompanies ? q.eq("active", true).in("company", scopedCompanies) : q.eq("active", true),
      ),
      fetchAllRows(adminClient, "job_functions", "id, name"),
      fetchAllRows(adminClient, "job_sources", "source_id, job_id, source_job_id", (q) => q.in("source_id", sources.map((s) => s.id))),
      fetchAllRows(adminClient, "company_tiers", "company_name, tier, aliases", undefined, "company_name"),
    ]);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500);
  }

  const jobFunctionIdByName = new Map<string, string>((jobFunctions ?? []).map((f) => [f.name as string, f.id as string]));
  const jobFunctionNameById = new Map<string, string>((jobFunctions ?? []).map((f) => [f.id as string, f.name as string]));
  const companyTierByName = indexCompanyTiers(
    (companyTiers ?? []).map((c) => ({ companyName: c.company_name as string, tier: c.tier as number, aliases: c.aliases as string[] | null })),
  );

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
        jobFunctionNameById,
        companyTierByName,
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
