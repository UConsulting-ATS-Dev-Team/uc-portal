// Closes the real gap JOB_ENGINE_ARCHITECTURE.md §3.5/Part 7 named and
// deliberately deferred: "application-URL health (periodic HEAD-request
// check)" was cut from the Job quality admin panel because "live
// application-URL health checks aren't meaningful yet with no real
// automated source running." That's no longer true -- 12 real automated
// sources are live (Stripe, Databricks, Coinbase, Airbnb, Brex, Figma,
// Robinhood, Deloitte, IMC, Charlie Health, Carvana, Guild) with ~3,300
// real active postings as of this function's first deploy. This is that
// scheduled check: HEAD (falling back to GET) every active job's
// application_url and record whether it still resolves.
//
// Same shared batched-read/bulk-write shape every other scheduled fetcher
// in this app already uses (fetch-deloitte-jobs, fetch-greenhouse-companies)
// -- one bounded read, all checks run in memory/network concurrently, one
// RPC call to write every result back, never a per-row round trip.
//
// ---- Why HEAD, when it falls back to GET, and why status code alone
// isn't sufficient -- all confirmed against a real sample of live
// application_urls (one per company) before writing any of this, not
// assumed ----
//
// 1. HEAD works cleanly for most sources tested (Stripe, Databricks,
//    Airbnb, Brex, Figma, Robinhood, IMC, Guild, Charlie Health) -- same
//    status HEAD and GET would both return. But Coinbase's site rejects
//    HEAD specifically (403) while GET on the identical URL returns 200 --
//    confirmed live, not a hypothetical. So a non-ok HEAD is not trusted
//    as evidence on its own; every non-ok HEAD gets a GET fallback before
//    anything is recorded as a failure.
//
// 2. Carvana's site (Cloudflare bot-challenge, "Just a moment...") returns
//    403 to *every* automated request -- HEAD and GET alike -- for a real,
//    currently-open posting. There's no way to tell that apart from a
//    genuinely dead/blocked link from the HTTP response alone. Rather than
//    mass-flag Carvana's ~1,470 real active postings as broken every
//    single day (a false positive at real scale, not an edge case),
//    persistent-403 is treated as INCONCLUSIVE: logged, but link_health is
//    left untouched for that job this run. This is a known, deliberate
//    detection gap -- a genuinely dead Carvana-style bot-protected link
//    would never get flagged by this function -- documented here rather
//    than silently guessed at, same spirit as this codebase's other
//    honestly-scoped gaps (e.g. fetch-deloitte-jobs' capped-feed
//    expiration-sweep skip).
//
// 3. The more surprising real finding: a deliberately-invalid Greenhouse
//    job id (boards.greenhouse.io/figma/jobs/0000000000) returns HTTP 200,
//    not 404 -- Greenhouse silently redirects an unknown job id to the
//    company's generic careers page instead of erroring. Status code alone
//    would never catch this. Fixed with redirectedToGenericPage(): compare
//    the long numeric id token(s) present in the original application_url
//    (the gh_jid / path-segment job id) against the ones present in the
//    final URL after following redirects -- if none of the original job's
//    id tokens survive, the response is treated as a failure even though
//    the HTTP status was 2xx. Confirmed live: a real job id's URL keeps its
//    own id token through a real cross-subdomain redirect
//    (boards.greenhouse.io -> job-boards.greenhouse.io); the fabricated id
//    lands on a URL with no matching token at all.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const SOURCE_NAME = "Link Health Checker";

// Active jobs (~3,300 as of this function's first deploy) is already too
// many to check exhaustively in one Edge Function invocation without
// risking the same compute/time limit this codebase has hit before at
// scale (see fetch-greenhouse-companies' MAX_NEW_JOBS_PER_RUN history).
// Each run instead checks the MAX_LINKS_PER_RUN jobs least recently
// checked (oldest last_link_checked_at first, nulls -- never checked --
// first), so the whole active set rotates through over several days
// rather than one run trying to do everything. Worst case (every single
// checked URL times out, which real data never came close to) is
// MAX_LINKS_PER_RUN / CONCURRENCY * TIMEOUT_MS =~ 120s, comfortably under
// Supabase's Edge Function limit.
const MAX_LINKS_PER_RUN = 300;
const CONCURRENCY = 20;
const TIMEOUT_MS = 8000;

// Must match mark_link_check_results' own threshold (20260825110000) --
// duplicated here only so this file's own summary math (newly-flagged vs
// still-broken, for the run log) can be computed without a second round
// trip back to the DB to ask what changed. The actual state transition is
// owned entirely by the SQL function, not this constant.
const BROKEN_THRESHOLD = 3;

const UA = "Mozilla/5.0 (compatible; UCPortalJobEngine/1.0; +link-health-check)";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function idTokens(url: string): Set<string> {
  return new Set(url.match(/\d{4,}/g) ?? []);
}

// See header comment (3) -- true only when the original URL actually had
// an id token to check AND none of them survived the redirect. A URL with
// no long digit sequence at all (e.g. a slug-only careers page) skips this
// check entirely and relies on status code alone, rather than producing a
// meaningless comparison.
function redirectedToGenericPage(originalUrl: string, finalUrl: string): boolean {
  const original = idTokens(originalUrl);
  if (original.size === 0) return false;
  const final = idTokens(finalUrl);
  for (const token of original) if (final.has(token)) return false;
  return true;
}

interface Attempt {
  ok: boolean;
  status?: number;
  networkError?: string;
}

async function attempt(method: "HEAD" | "GET", url: string): Promise<Attempt> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { method, redirect: "follow", headers: { "User-Agent": UA }, signal: controller.signal });
    return { ok: res.ok && !redirectedToGenericPage(url, res.url), status: res.status };
  } catch (err) {
    return { ok: false, networkError: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

type CheckResult = "ok" | "broken" | "inconclusive";

// HEAD first; only falls back to GET when HEAD didn't come back clean --
// most real sources never need the fallback (see header comment (1)), so
// this keeps the common case cheap (no response body downloaded) while
// still confirming a non-ok HEAD against GET before trusting it, since a
// non-ok HEAD is sometimes the server's own quirk (Coinbase), not the
// posting's real state. See header comment (2) for the persistent-403 ->
// "inconclusive" call.
// Statuses that mean "the server had a problem," not "this posting is
// gone" -- 429 (rate limited) and any 5xx. Added after a real false-
// positive burst caught during this function's own repeated manual
// verification: invoking it ~15 times within about 10 minutes (far more
// aggressive than the once-daily production cadence) triggered what all
// evidence points to as transient rate-limiting from Stripe's side --
// three consecutive runs recorded a failure for the same ~95 Stripe URLs,
// crossing BROKEN_THRESHOLD, and every one of those URLs was manually
// re-verified immediately after (real 200, correct listing page, correct
// job id) to be completely healthy. A rate-limited/overloaded response is
// exactly as ambiguous as persistent-403 bot-blocking (see the 403 case
// below) -- there's no way to tell "this server is temporarily struggling"
// apart from "this specific posting is gone" from the status code alone,
// so both get the same inconclusive treatment rather than risking another
// mass false-positive under real-world traffic spikes on a source's side.
function isTransientServerStatus(status: number | undefined): boolean {
  return status === 429 || (status !== undefined && status >= 500);
}

async function checkOne(url: string): Promise<CheckResult> {
  const head = await attempt("HEAD", url);
  if (head.ok) return "ok";
  if (head.networkError) return "broken";

  const get = await attempt("GET", url);
  if (get.ok) return "ok";
  if (get.status === 403 || head.status === 403) return "inconclusive";
  if (isTransientServerStatus(get.status) || isTransientServerStatus(head.status)) return "inconclusive";
  return "broken";
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

interface JobCandidate {
  id: string;
  application_url: string;
  link_health: "unchecked" | "ok" | "broken";
  link_check_failures: number;
}

// deno-lint-ignore no-explicit-any
async function runLinkCheck(adminClient: SupabaseClient, source: any): Promise<FetchOutcome> {
  if (source.authorization_status === "disabled" || source.authorization_status === "not_approved") {
    // Same §3.7 kill switch every other scheduled fetcher already honors --
    // flip this row on SourceManagement.jsx and the next scheduled run
    // skips it, no redeploy needed.
    const reason = `source is ${source.authorization_status}`;
    return { httpStatus: 200, body: { skipped: true, reason }, logStatus: "skipped", logSummary: { reason } };
  }

  // Deliberately a plain bounded query, not fetchAllRows() -- fetchAllRows
  // exists to load an *entire* table for an in-memory lookup (dedup's
  // activeJobs, existingSources), which is exactly what this function does
  // NOT want to do: it needs a bounded slice of candidate rows, not every
  // active job, so a single .limit() query is both correct and simpler
  // than forcing this into the "load everything" helper.
  //
  // Ordering is two-tiered, not a flat "oldest-checked-first" rotation --
  // that flat version was tried first and caught as wrong by this
  // function's own live verification: with ~3,300 active jobs and
  // MAX_LINKS_PER_RUN=300, a job that fails today wouldn't be reselected
  // for ~11 days under pure oldest-first ordering (it'd be behind the
  // ~3,000 rows that have never been checked at all), so it could take
  // over a month of daily runs to reach the 3-consecutive-failure
  // threshold -- BROKEN_THRESHOLD would be true in name only. Prioritizing
  // link_check_failures > 0 first means a job that just failed gets
  // rechecked on the very next run (and the run after, if it fails again),
  // so 3 *actually consecutive* daily checks is what the counter ends up
  // measuring, matching mark_link_check_results' own doc comment. Healthy/
  // never-checked jobs (the overwhelming majority) fall back to oldest-
  // checked-first rotation among themselves once the currently-failing
  // ones are accounted for.
  const { data: candidates, error: candidatesError } = await adminClient
    .from("jobs")
    .select("id, application_url, link_health, link_check_failures")
    .eq("active", true)
    .order("link_check_failures", { ascending: false })
    .order("last_link_checked_at", { ascending: true, nullsFirst: true })
    .limit(MAX_LINKS_PER_RUN);

  if (candidatesError) return failed(`Loading candidate jobs failed: ${candidatesError.message}`);

  const jobs = (candidates ?? []) as JobCandidate[];
  if (jobs.length === 0) {
    const summary = { checked: 0, note: "no active jobs to check" };
    return { httpStatus: 200, body: summary, logStatus: "success", logSummary: summary };
  }

  const results = await mapWithConcurrency(jobs, CONCURRENCY, async (job) => ({
    job,
    result: await checkOne(job.application_url),
  }));

  const okIds: string[] = [];
  const failedIds: string[] = [];
  const inconclusiveIds: string[] = [];
  let newlyFlaggedBroken = 0;
  let stillBroken = 0;
  let recovered = 0;

  for (const { job, result } of results) {
    if (result === "inconclusive") {
      // Still counts as "checked this run" for scheduling purposes (see
      // mark_link_check_results' own header comment, 20260825170000) --
      // otherwise a persistently-403'd source (Carvana, confirmed live)
      // never rotates out of the priority queue and crowds out every
      // other job that's waiting for its first-ever check.
      inconclusiveIds.push(job.id);
      continue;
    }
    if (result === "ok") {
      okIds.push(job.id);
      if (job.link_health === "broken") recovered++;
      continue;
    }
    failedIds.push(job.id);
    const newCount = job.link_check_failures + 1;
    if (newCount >= BROKEN_THRESHOLD) {
      if (job.link_health === "broken") stillBroken++;
      else newlyFlaggedBroken++;
    }
  }

  if (okIds.length > 0 || failedIds.length > 0 || inconclusiveIds.length > 0) {
    const { error: rpcError } = await adminClient.rpc("mark_link_check_results", {
      ok_ids: okIds,
      failed_ids: failedIds,
      inconclusive_ids: inconclusiveIds,
    });
    if (rpcError) return failed(`mark_link_check_results failed: ${rpcError.message}`);
  }

  const summary = {
    checked: jobs.length,
    ok: okIds.length,
    failed: failedIds.length,
    inconclusiveBlocked: inconclusiveIds.length,
    newlyFlaggedBroken,
    stillBroken,
    recovered,
    brokenThreshold: BROKEN_THRESHOLD,
    maxPerRun: MAX_LINKS_PER_RUN,
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

  const outcome = await runLinkCheck(adminClient, source);

  await adminClient.from("source_fetch_log").insert({
    source_id: source.id,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    status: outcome.logStatus,
    summary: outcome.logSummary,
  });

  return jsonResponse(outcome.body, outcome.httpStatus);
});
