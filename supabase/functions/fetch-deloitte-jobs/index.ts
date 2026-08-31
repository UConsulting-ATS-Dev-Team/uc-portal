// Stage 4's first additional automated source, per JOB_ENGINE_ARCHITECTURE.md
// Part 7. Chosen over BCG (schema.org present but its search-results page is
// a client-rendered SPA with no static links to enumerate from -- confirmed
// during Stage 3's pilot-selection research) and Accenture (a clean Workday
// JSON endpoint, but an internal one their own site's JS calls, not a
// documented public API -- the weakest legal footing of the three).
//
// Deloitte's enumeration mechanism is a real RSS 2.0 feed at
// apply.deloitte.com/en_US/careers/SearchJobs/{keyword}/feed/
// (Content-Type: text/xml, standard <channel>/<item> shape) -- RSS is, by
// decades-old web convention, a format that exists specifically for
// third-party syndication, matching Part 2's "RSS/XML/JSON feeds explicitly
// published for reuse" category. That's a categorically different legal
// posture than scraping the HTML search-results page sitting right next to
// it, which is why this adapter uses the feed and never touches that page.
// Confirmed live: the feed ignores jobRecordsPerPage/jobOffset entirely and
// always returns the same 20 most-relevant items per keyword -- a real,
// hard cap, not a bug to work around. Each linked job detail page separately
// embeds schema.org JobPosting JSON-LD (the same Google-for-Jobs markup
// BCG's page was confirmed to have), used here for the structured facts
// (employmentType, jobLocation, validThrough) the RSS items themselves don't
// carry.
//
// Same conservative default as Stripe: never stores the JobPosting schema's
// own `description` field, even though it's real content Deloitte itself
// publishes as structured data (arguably a stronger reuse signal than
// Greenhouse's raw posting text) -- staying consistent across every source
// in this app is simpler and safer than making a bespoke call per source.
// application_url is the link-out path, same as everywhere else.
//
// IMPORTANT confidence difference from fetch-greenhouse-stripe: Greenhouse's
// feed is exhaustive (every Stripe posting, in one call), so "tracked before
// but absent from today's fetch" is a real "this posting is gone" signal
// (§3.4's freshness sweep). This feed is capped at 20 most-relevant results
// per keyword -- a job can drop out of that window because something more
// relevant appeared, not because it closed. Running the same expiration
// sweep here would incorrectly mark still-open Deloitte roles as
// potentially_expired. Deliberately skipped; freshness for a capped/partial
// feed needs a different signal (e.g., an explicit re-check of each
// previously-seen job's own page) that's out of scope for this pass.
//
// Same shared pipeline as every other source (../_shared/), same batched-
// read-then-bulk-write shape fetch-greenhouse-stripe was rewritten into
// after hitting Supabase's resource limit doing it per-job -- applied here
// from the start rather than relearning that the hard way twice.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { normalizeJob } from "../_shared/pipeline/normalize.ts";
import { validateJob, scoreQuality } from "../_shared/pipeline/quality.ts";
import { scoreDuplicate, classifyDuplicateTier } from "../_shared/pipeline/dedupe.ts";
import { isLikelySeniorRole, isLikelyNonCorporateRole } from "../_shared/pipeline/relevance.ts";
import type { RawJob } from "../_shared/pipeline/types.ts";
import { comparableFromExistingJob, jobInsertFromNormalized, fetchAllRows, enforceCompanyCap } from "../_shared/dedupeHelpers.ts";

const SOURCE_NAME = "Deloitte (Careers RSS Feed)";
const KEYWORDS = ["consultant", "strategy", "analyst"];
const FEED_URL = (keyword: string) => `https://apply.deloitte.com/en_US/careers/SearchJobs/${encodeURIComponent(keyword)}/feed/`;
const FETCH_CONCURRENCY = 5;
const UA = "Mozilla/5.0 (compatible; UCPortalJobEngine/1.0)";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

interface RssItem {
  title: string;
  link: string;
  pubDate: string;
}

function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  for (const [, block] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const title = block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() ?? "";
    const link = block.match(/<link>(.*?)<\/link>/)?.[1]?.trim() ?? "";
    const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() ?? "";
    if (link) items.push({ title, link, pubDate });
  }
  return items;
}

// deno-lint-ignore no-explicit-any
function extractJobPosting(html: string): any | null {
  const candidates: Record<string, unknown>[] = [];
  for (const [, raw] of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const obj = JSON.parse(raw);
      if (obj["@type"] === "JobPosting") candidates.push(obj);
    } catch {
      // malformed JSON-LD on the page -- skip it, not our problem to fix
    }
  }
  // The fuller block (identifier/jobLocation present) was consistently the
  // more complete one when this was checked against real pages -- prefer it.
  return candidates.find((c) => c.identifier) ?? candidates[0] ?? null;
}

function jobIdFromUrl(url: string): string | null {
  return url.match(/\/(\d+)(?:[/?]|$)/)?.[1] ?? null;
}

// Google's JobPosting employmentType enum (FULL_TIME/PART_TIME/INTERN/...)
// mapped onto this app's own enum. Confirmed live that Deloitte often
// leaves this as [""] (empty) -- same real-world gap Stripe's titles had,
// just presented as a blank structured field instead of a missing one.
function mapSchemaEmploymentType(value: unknown): "internship" | "part_time" | "full_time" | null {
  const values = (Array.isArray(value) ? value : [value]).filter(Boolean).map((v) => String(v).toUpperCase());
  if (values.includes("INTERN")) return "internship";
  if (values.includes("PART_TIME")) return "part_time";
  if (values.includes("FULL_TIME")) return "full_time";
  return null;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
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

// deno-lint-ignore no-explicit-any
async function runFetch(adminClient: SupabaseClient, source: any): Promise<FetchOutcome> {
  if (source.authorization_status === "disabled" || source.authorization_status === "not_approved") {
    const reason = `source is ${source.authorization_status}`;
    return { httpStatus: 200, body: { skipped: true, reason }, logStatus: "skipped", logSummary: { reason } };
  }

  // ---- Enumerate via the RSS feed (the legitimate syndication mechanism) ----
  let rssItems: RssItem[];
  try {
    const perKeyword = await Promise.all(
      KEYWORDS.map(async (keyword) => {
        const res = await fetch(FEED_URL(keyword), { headers: { "User-Agent": UA } });
        if (!res.ok) throw new Error(`Feed for "${keyword}" returned HTTP ${res.status}`);
        return parseRssItems(await res.text());
      }),
    );
    const seen = new Set<string>();
    rssItems = perKeyword.flat().filter((item) => (seen.has(item.link) ? false : (seen.add(item.link), true)));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { httpStatus: 502, body: { error: `Feed fetch failed: ${message}` }, logStatus: "failed", logSummary: { error: message } };
  }

  // ---- Load every lookup once, up front ----
  // Paginated via fetchAllRows() -- fetch-greenhouse-companies hit a real
  // silent-truncation bug on these exact two queries (a bare .select() caps
  // at PostgREST's default 1000-row page) once total active jobs across all
  // sources grew past that mark, which the Greenhouse expansion already did.
  // Deloitte's own job_sources slice is small today but has no reason to
  // stay that way, so it gets the same treatment rather than leaving a
  // second copy of the same landmine for later.
  let activeJobs: Array<Record<string, unknown>>;
  let existingSources: Array<Record<string, unknown>>;
  let jobFunctions: Array<Record<string, unknown>>;
  try {
    [activeJobs, existingSources, jobFunctions] = await Promise.all([
      fetchAllRows(adminClient, "jobs", "id, company, title, application_url, remote_type, city, posted_date, salary_min", (q) => q.eq("active", true)),
      fetchAllRows(adminClient, "job_sources", "job_id, source_job_id", (q) => q.eq("source_id", source.id)),
      fetchAllRows(adminClient, "job_functions", "id, name"),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return failed(`Loading lookups failed: ${message}`);
  }

  const jobFunctionIdByName = new Map<string, string>(jobFunctions.map((f) => [f.name as string, f.id as string]));
  // Reverse of the above, for enforceCompanyCap's tiering (job_function_id
  // on a row -> the taxonomy name companyCap.ts's tiers are keyed on) --
  // same pair fetch-greenhouse-companies builds for the same reason.
  const jobFunctionNameById = new Map<string, string>(jobFunctions.map((f) => [f.id as string, f.name as string]));
  const existingJobIdBySourceJobId = new Map<string, string>(existingSources.map((r) => [r.source_job_id as string, r.job_id as string]));

  // ---- Only fetch detail pages for items not already tracked ----
  const toFetch = rssItems.filter((item) => {
    const id = jobIdFromUrl(item.link);
    return id && !existingJobIdBySourceJobId.has(id);
  });

  const detailPages = await mapWithConcurrency(toFetch, FETCH_CONCURRENCY, async (item) => {
    try {
      const res = await fetch(item.link, { headers: { "User-Agent": UA } });
      if (!res.ok) return { item, error: `HTTP ${res.status}` };
      const html = await res.text();
      const posting = extractJobPosting(html);
      if (!posting) return { item, error: "no JobPosting schema found on page" };
      return { item, posting };
    } catch (err) {
      return { item, error: err instanceof Error ? err.message : String(err) };
    }
  });

  // ---- Score everything in memory -- no DB calls in this loop ----
  const refreshJobIds: string[] = [];
  for (const item of rssItems) {
    const id = jobIdFromUrl(item.link);
    const existingJobId = id ? existingJobIdBySourceJobId.get(id) : undefined;
    if (existingJobId) refreshJobIds.push(existingJobId);
  }

  const mergeAttachments: Array<{ job_id: string; source_id: string; source_job_id: string; source_url: string; is_primary: boolean }> = [];
  const mergeJobIds: string[] = [];
  const newJobRows: Array<ReturnType<typeof jobInsertFromNormalized> & { id: string }> = [];
  const newJobSources: Array<{ job_id: string; source_id: string; source_job_id: string; source_url: string; is_primary: boolean }> = [];
  const newDuplicateCandidates: Array<{ job_id_a: string; job_id_b: string; score: number; signals: unknown }> = [];
  let skippedInvalid = 0;
  let skippedNoSchema = 0;
  let skippedCompanyMismatch = 0;
  let skippedNotRelevant = 0;

  for (const result of detailPages) {
    if (result.error || !result.posting) {
      skippedNoSchema++;
      continue;
    }
    const { item, posting } = result;
    const sourceJobId = jobIdFromUrl(item.link);
    if (!sourceJobId) {
      skippedNoSchema++;
      continue;
    }

    // Same spirit as check-company-source.mjs's slug-collision guard: don't
    // trust the URL alone, confirm the page's own data says Deloitte.
    const hiringOrgName = String(posting.hiringOrganization?.name ?? "");
    if (!/deloitte/i.test(hiringOrgName)) {
      skippedCompanyMismatch++;
      continue;
    }

    // Same relevance filters as fetch-greenhouse-companies (see
    // _shared/pipeline/relevance.ts) -- less urgent here since the
    // consultant/strategy/analyst keyword search already scopes the feed
    // reasonably well, but a "Senior Manager, Strategy Consulting" or
    // similar can still surface under those same keywords, and applying
    // this everywhere consistently is simpler than deciding per-adapter
    // whether it's needed. isLikelyNonCorporateRole() is unlikely to ever
    // fire against a consultant/strategy/analyst-keyword feed, but it costs
    // nothing to gate here too rather than special-case this adapter out.
    const rawTitle = (posting.title ?? item.title).trim();
    if (isLikelySeniorRole(rawTitle) || isLikelyNonCorporateRole(rawTitle)) {
      skippedNotRelevant++;
      continue;
    }

    const addr = posting.jobLocation?.address ?? {};
    const locationText = [addr.addressLocality, addr.addressRegion].filter(Boolean).join(", ") || undefined;

    const raw: RawJob = {
      source: { sourceId: source.id, sourceJobId, sourceUrl: item.link, isPrimary: true },
      company: "Deloitte",
      title: rawTitle,
      locationText,
      applicationUrl: item.link,
      applicationDeadlineText: typeof posting.validThrough === "string" ? posting.validThrough.slice(0, 10) : undefined,
      updatedDate: typeof posting.datePosted === "string" ? posting.datePosted.slice(0, 10) : undefined,
    };

    let normalized = normalizeJob(raw);
    const schemaEmploymentType = mapSchemaEmploymentType(posting.employmentType);
    if (schemaEmploymentType) {
      normalized = { ...normalized, employmentType: schemaEmploymentType };
    } else if (!normalized.employmentType) {
      // Same adapter-level default as fetch-greenhouse-stripe, for the same
      // reason: Deloitte's own schema leaves this blank often enough that
      // "never guess" would drop most of the feed, and an unmarked
      // structured-data feed posting is overwhelmingly an ordinary
      // full-time role, not genuine ambiguity.
      normalized = { ...normalized, employmentType: "full_time" };
    }
    // Structured address fields, when present, are more precise than what
    // normalizeLocation()'s free-text parser would derive -- override with
    // them directly rather than relying only on locationText round-tripping
    // through that parser (same override pattern used elsewhere for
    // classYears/etc. when better structured data exists than free text).
    if (addr.addressLocality || addr.addressRegion || addr.addressCountry) {
      normalized = {
        ...normalized,
        city: addr.addressLocality || normalized.city,
        state: addr.addressRegion || normalized.state,
        country: addr.addressCountry || normalized.country,
      };
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
      mergeAttachments.push({ job_id: bestMatch.jobId, source_id: source.id, source_job_id: sourceJobId, source_url: item.link, is_primary: false });
      mergeJobIds.push(bestMatch.jobId);
      continue;
    }

    const qualityScore = scoreQuality(normalized);
    const jobFunctionId = normalized.jobFunction ? jobFunctionIdByName.get(normalized.jobFunction) ?? null : null;
    const newId = crypto.randomUUID();
    newJobRows.push({ id: newId, ...jobInsertFromNormalized(normalized, qualityScore, jobFunctionId, source.storage_restrictions) });
    newJobSources.push({ job_id: newId, source_id: source.id, source_job_id: sourceJobId, source_url: item.link, is_primary: true });

    if (tier === "review" && bestMatch) {
      const { score, signals } = scoreDuplicate(normalized, comparableFromExistingJob(bestMatch.row));
      newDuplicateCandidates.push({ job_id_a: newId, job_id_b: bestMatch.jobId, score, signals });
    }

    activeJobs.push({ id: newId, company: normalized.company, title: normalized.title, application_url: normalized.applicationUrl, remote_type: normalized.remoteType, city: normalized.city, posted_date: newJobRows[newJobRows.length - 1].posted_date, salary_min: normalized.salaryMin });
  }

  // ---- Write everything in bulk ----
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
  const nowIso = new Date().toISOString();
  if (mergeJobIds.length > 0) {
    const { error } = await adminClient.from("jobs").update({ last_seen_at: nowIso, updated_at: nowIso }).in("id", [...new Set(mergeJobIds)]);
    if (error) return failed(`Merge freshness update failed: ${error.message}`);
  }
  if (refreshJobIds.length > 0) {
    const { error } = await adminClient
      .from("jobs")
      .update({ last_seen_at: nowIso, last_verified_at: nowIso })
      .in("id", [...new Set(refreshJobIds)]);
    if (error) return failed(`Refresh update failed: ${error.message}`);
  }

  // Part 2 (2026-08-27) -- per-company cap, enforced last so it sees
  // Deloitte's true post-insert/refresh active set. Same call
  // fetch-greenhouse-companies makes per company; see enforceCompanyCap's
  // own comment (dedupeHelpers.ts) and companyCap.ts for the rationale.
  const { deactivatedCount: capDeactivated, error: capError } = await enforceCompanyCap(adminClient, "Deloitte", jobFunctionNameById);
  if (capError) return failed(`Company cap enforcement failed: ${capError}`);

  const summary = {
    // `fetched` matches the common key SourceManagement.jsx's
    // summarizeFetchLog() reads across every source, so this shows
    // correctly without per-source special-casing on the display side --
    // rssItemsFound would've rendered as "? fetched" there instead.
    fetched: rssItems.length,
    keywordsSearched: KEYWORDS,
    detailPagesFetched: toFetch.length,
    inserted: newJobRows.length,
    merged: mergeAttachments.length,
    flaggedDuplicate: newDuplicateCandidates.length,
    refreshed: refreshJobIds.length,
    skippedInvalid,
    skippedNoSchema,
    skippedCompanyMismatch,
    skippedNotRelevant,
    capDeactivated,
    expirationSweep: "skipped -- capped/partial feed, see header comment",
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
