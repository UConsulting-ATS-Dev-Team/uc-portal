// Lever ingestion adapter -- same config-driven architecture as
// fetch-greenhouse-companies (sources.config rows with {platform, slug,
// company}, one Edge Function for every configured Lever company rather
// than one per company), reusing the exact same shared pipeline
// (_shared/dedupeHelpers.ts, _shared/pipeline/normalize.ts, relevance.ts,
// companyCap.ts, quality.ts) instead of duplicating any of that logic.
// First two sources: Wealthfront and Belvedere Trading, both real, already
// identity-verified boards flagged in JOB_ENGINE_ARCHITECTURE.md's Eighth
// addition entry as "found and deliberately not added -- this codebase has
// no Lever adapter at all" -- this function closes that gap.
//
// Lever's public Postings API (api.lever.co/v0/postings/{slug}?mode=json)
// is Lever's own documented, unauthenticated, explicitly third-party-facing
// job board API -- same legal category as Greenhouse's Job Board API
// already vetted throughout this doc, not per-customer terms.
//
// Verified against the real live API before writing this (2026-08-31, both
// Wealthfront's and Belvedere Trading's actual boards) -- see
// server/src/leverAdapter.ts's header and JOB_ENGINE_ARCHITECTURE.md's
// dated entry for exactly what was confirmed. Two real shape differences
// from Greenhouse this adapter has to account for that Greenhouse's
// doesn't:
//
// 1. The endpoint returns a JSON array directly, not `{ jobs: [...] }`.
// 2. Lever postings carry no self-reported company name at all (no
//    equivalent of Greenhouse's `company_name` field) -- confirmed by
//    inspecting the real response's full key set. Greenhouse's identity
//    safeguard (compare each posting's own company_name against the
//    configured company) cannot work here. See the identity-check comment
//    below and server/src/leverAdapter.ts's hostedUrlMatchesSlug() for the
//    honest replacement and its real limitation.
//
// Everything else -- fetchAllRows/updateInBatches pagination-safety, the
// MAX_NEW_JOBS_PER_RUN backfill deferral, per-company dedup scoring scoped
// to that company's own active jobs, the white-collar relevance filter, the
// 30-active-jobs-per-company cap, freshness/expiration via mark_jobs_missed,
// storage-restriction enforcement -- is identical to
// fetch-greenhouse-companies and inherited by calling the exact same shared
// functions, not re-implemented.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { normalizeJob } from "../_shared/pipeline/normalize.ts";
import { validateJob, scoreQuality } from "../_shared/pipeline/quality.ts";
import { scoreDuplicate, classifyDuplicateTier } from "../_shared/pipeline/dedupe.ts";
import { isLikelySeniorRole, isLikelyNonCorporateRole } from "../_shared/pipeline/relevance.ts";
import type { RawJob } from "../_shared/pipeline/types.ts";
import { comparableFromExistingJob, jobInsertFromNormalized, fetchAllRows, updateInBatches, enforceCompanyCap } from "../_shared/dedupeHelpers.ts";
import { capForCompanyTier, indexCompanyTiers } from "../_shared/pipeline/companyCap.ts";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// Same ceiling as fetch-greenhouse-companies, same reason (keeps a large
// first-run backfill from tripping Supabase's Edge Function compute limit).
// Neither Wealthfront (23 postings) nor Belvedere Trading (14 postings)
// comes close to this in practice -- kept at the same value as Greenhouse
// for consistency and so it's already in place for whatever company gets
// added to this adapter next.
const MAX_NEW_JOBS_PER_RUN = 150;

// Verified 2026-08-31 against the real live API for both Wealthfront and
// Belvedere Trading -- see server/src/leverAdapter.ts's LeverPosting for the
// full verification note. Only the fields this adapter reads are typed;
// `description`/`descriptionPlain`/`lists`/`additional` (Lever's full
// posting body, always present inline in this same response -- there is no
// separate description-fetch call to skip the way some ATSs allow)
// deliberately have no field here at all, so there's no `raw.description`
// assignment below for enforceStorageRestrictions() to have to strip --
// stronger than relying on that gate alone, though it also runs (via
// jobInsertFromNormalized) as defense in depth.
interface LeverPosting {
  id: string;
  text: string;
  categories?: {
    commitment?: string;
    location?: string;
  };
  workplaceType?: string;
  createdAt?: number;
  hostedUrl?: string;
}

interface FetchOutcome {
  logStatus: "success" | "failed" | "skipped";
  logSummary: Record<string, unknown>;
}

function failed(message: string): FetchOutcome {
  return { logStatus: "failed", logSummary: { error: message } };
}

// Hand-kept-in-sync port of server/src/leverAdapter.ts's buildLeverLocationText --
// see that file for the full rationale and its own unit tests. Inlined
// rather than imported since this Deno Edge Function and the Node/vitest
// server/src tree are different runtimes with no shared import path, same
// constraint normalize.ts's own header comment already documents for the
// wider pipeline port.
function buildLeverLocationText(posting: LeverPosting): string | undefined {
  const place = posting.categories?.location?.trim();
  const mode = posting.workplaceType;
  if (mode === "remote") return place ? `${place} (Remote)` : "Remote";
  if (mode === "hybrid" && place) return `${place} (Hybrid)`;
  return place || undefined;
}

// Hand-kept-in-sync port of server/src/leverAdapter.ts's hostedUrlMatchesSlug.
// See that function's own comment for the full honest limitation: this
// catches a posting whose hostedUrl doesn't match the slug this source is
// configured for (a config typo, or Lever-side data leaking across a
// misconfigured request), but it does NOT catch a genuine future slug
// reassignment to an unrelated org, since a new tenant of the same slug
// would legitimately produce matching URLs too. Lever gives this adapter no
// automated signal that could catch that case the way Greenhouse's
// self-reported company_name field lets fetch-greenhouse-companies catch a
// squatted/reassigned slug outright.
function hostedUrlMatchesSlug(hostedUrl: string | undefined, slug: string): boolean {
  if (!hostedUrl || !slug) return false;
  const expectedPrefix = `https://jobs.lever.co/${slug}/`.toLowerCase();
  return hostedUrl.toLowerCase().startsWith(expectedPrefix);
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

  let leverJobs: LeverPosting[];
  try {
    const res = await fetch(`https://api.lever.co/v0/postings/${slug}?mode=json`);
    if (!res.ok) throw new Error(`Lever returned HTTP ${res.status}`);
    const body = await res.json();
    // Verified live: Lever's Postings API returns a JSON array directly,
    // unlike Greenhouse's `{ jobs: [...] }` wrapper. Defensively also accept
    // an unexpected `{ postings: [...] }`/`{ jobs: [...] }` wrapper shape in
    // case Lever ever changes this for a given board, rather than crashing.
    leverJobs = Array.isArray(body) ? body : (body?.postings ?? body?.jobs ?? []);
  } catch (err) {
    // §3.4: never touch existing data on a failed fetch. Report and exit.
    const message = err instanceof Error ? err.message : String(err);
    return failed(`Fetch failed: ${message}`);
  }

  const suspiciouslyEmpty = leverJobs.length < 5;
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

  for (const leverJob of leverJobs) {
    const sourceJobId = String(leverJob.id);
    seenSourceJobIds.add(sourceJobId); // present in today's feed either way -- see freshness note below

    const existingJobId = existingJobIdBySourceJobId.get(sourceJobId);
    if (existingJobId) {
      refreshJobIds.push(existingJobId);
      continue;
    }

    // Same relevance filter as every other ATS adapter -- see
    // _shared/pipeline/relevance.ts's header comment. Checked before the
    // MAX_NEW_JOBS_PER_RUN deferral so a company's per-day processing budget
    // isn't spent on roles that were never going to be kept anyway.
    if (isLikelySeniorRole(leverJob.text) || isLikelyNonCorporateRole(leverJob.text)) {
      skippedNotRelevant++;
      continue;
    }

    // Same backfill-scale bound as fetch-greenhouse-companies. Neither of
    // this adapter's first two companies is anywhere near this size, but
    // it's here from the start for whatever's added next.
    if (newJobRows.length + mergeAttachments.length >= MAX_NEW_JOBS_PER_RUN) {
      deferred++;
      continue;
    }

    // Identity safeguard -- see hostedUrlMatchesSlug's own comment above for
    // exactly what this does and does not catch (no self-reported company
    // name exists on a Lever posting to check against, unlike Greenhouse).
    if (!hostedUrlMatchesSlug(leverJob.hostedUrl, slug)) {
      skippedCompanyMismatch++;
      continue;
    }

    const hostedUrl = leverJob.hostedUrl as string; // hostedUrlMatchesSlug above already confirmed this is present and well-formed
    const raw: RawJob = {
      source: { sourceId: source.id, sourceJobId, sourceUrl: hostedUrl, isPrimary: true },
      company,
      title: leverJob.text.trim(),
      // Lever's own `categories.commitment` field is well-structured and
      // present on every posting verified live ("Full-time"/"Full-Time"/
      // "Intern") -- unlike Greenhouse, where ~90% of titles carried no
      // employment-type signal at all and the adapter had to default to
      // full_time. Passed as employmentTypeText so normalizeEmploymentType
      // reads Lever's own structured field first; the null-check fallback
      // below is defense in depth for the rare posting where it's blank or
      // an unrecognized value, not the primary path here.
      employmentTypeText: leverJob.categories?.commitment,
      // Lever reports remote/hybrid as a separate structured `workplaceType`
      // field rather than baking it into the location text the way
      // Greenhouse sometimes does -- see buildLeverLocationText's comment.
      locationText: buildLeverLocationText(leverJob),
      // The canonical public posting page, same role as Greenhouse's
      // absolute_url -- not leverJob.applyUrl, which is an apply-form-
      // specific deep link (hostedUrl + "/apply") rather than the page a
      // member would land on to read the posting.
      applicationUrl: hostedUrl,
      // Lever's postings list has no separate "last updated" timestamp at
      // all (confirmed by inspecting the real response's full key set) --
      // only createdAt (first-posted date). Used here for postedDate (which
      // scoreQuality's completeness check reads), left updatedDate unset
      // rather than implying a precision Lever doesn't actually provide.
      postedDate: typeof leverJob.createdAt === "number" && Number.isFinite(leverJob.createdAt)
        ? new Date(leverJob.createdAt).toISOString().slice(0, 10)
        : undefined,
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
      mergeAttachments.push({ job_id: bestMatch.jobId, source_id: source.id, source_job_id: sourceJobId, source_url: hostedUrl, is_primary: false });
      mergeJobIds.push(bestMatch.jobId);
      continue;
    }

    const qualityScore = scoreQuality(normalized);
    const jobFunctionId = normalized.jobFunction ? jobFunctionIdByName.get(normalized.jobFunction) ?? null : null;
    const newId = crypto.randomUUID();
    newJobRows.push({ id: newId, ...jobInsertFromNormalized(normalized, qualityScore, jobFunctionId, source.storage_restrictions) });
    newJobSources.push({ job_id: newId, source_id: source.id, source_job_id: sourceJobId, source_url: hostedUrl, is_primary: true });

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
    // Deliberately a plain insert, not an upsert -- same reasoning as
    // fetch-greenhouse-companies: a (source_id, source_job_id) collision here
    // means existingJobIdBySourceJobId was wrong about this job being new,
    // which should fail loudly, not be silently swallowed.
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
      missed_fetches: 0,
      updated_at: nowIso,
    });
    if (error) return failed(`Refresh update failed: ${error}`);
  }

  // Freshness (§3.4/US-22/23) -- same reasoning as fetch-greenhouse-companies:
  // each company's Lever board is exhaustive (every current posting, one
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
    fetched: leverJobs.length,
    inserted: newJobRows.length,
    merged: mergeAttachments.length,
    flaggedDuplicate: newDuplicateCandidates.length,
    refreshed: refreshJobIds.length,
    skippedInvalid,
    skippedCompanyMismatch,
    skippedNotRelevant,
    deferred,
    markedPotentiallyExpired,
    markedFullyExpired,
    capDeactivated,
    suspiciouslyEmpty,
  };
  return { logStatus: "success", logSummary: summary };
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // Optional { slug } body scopes this run to one company -- same
  // controlled-backfill escape hatch as fetch-greenhouse-companies. The
  // daily cron omits this and processes every configured Lever company.
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
    .eq("config->>platform", "lever");
  const { data: sources, error: sourcesError } = onlySlug
    ? await sourcesQuery.eq("config->>slug", onlySlug)
    : await sourcesQuery;
  if (sourcesError) return jsonResponse({ error: sourcesError.message }, 500);
  if (!sources || sources.length === 0) return jsonResponse({ error: `No Lever sources configured${onlySlug ? ` for slug "${onlySlug}"` : ""}` }, 500);

  // Shared lookups, fetched once and reused across every company -- same
  // pagination-safe fetchAllRows() as fetch-greenhouse-companies (a plain
  // .select() silently truncates at PostgREST's 1000-row default page size).
  let rawActiveJobs: Record<string, unknown>[], jobFunctions: Record<string, unknown>[], allJobSourceRows: Record<string, unknown>[], companyTiers: Record<string, unknown>[];
  try {
    [rawActiveJobs, jobFunctions, allJobSourceRows, companyTiers] = await Promise.all([
      fetchAllRows(adminClient, "jobs", "id, company, title, application_url, remote_type, city, posted_date, salary_min", (q) => q.eq("active", true)),
      fetchAllRows(adminClient, "job_functions", "id, name"),
      fetchAllRows(adminClient, "job_sources", "source_id, job_id, source_job_id", (q) => q.in("source_id", sources.map((s) => s.id))),
      fetchAllRows(adminClient, "company_tiers", "company_name, tier, aliases"),
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
