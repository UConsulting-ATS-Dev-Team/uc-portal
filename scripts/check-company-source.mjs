#!/usr/bin/env node
// Lightweight source-discovery triage, per JOB_ENGINE_ARCHITECTURE.md Part
// 7's Stage 4 ("additional ATS adapters for other UC-target companies").
// Automates the *technical* half of the research this repo did by hand for
// all 8 mock companies before building the Stripe/Greenhouse pilot (Stage
// 3): does this company have a Greenhouse or Lever board, or does its
// careers page embed schema.org JobPosting markup / hint at Workday.
//
// IMPORTANT -- this answers "is there a technically reachable structured
// pattern," never "are we authorized to use it." Part 2's hard rule still
// applies unchanged: a hit here is the start of the individual review
// (reading that company's own terms, confirming the data's actually meant
// for reuse), not the end of it. Nothing this script finds should be
// flipped to `approved` in the `sources` registry without that review --
// see how deliberately Stripe/Greenhouse was verified against Greenhouse's
// own developer docs before Stage 3 shipped, not just "the API responded."
//
// Usage:
//   node scripts/check-company-source.mjs "Company Name" [domain.com]
//
// The domain is optional but unlocks the schema.org/Workday checks, which
// need a real careers-page URL to fetch -- Greenhouse/Lever are checked
// from the company name alone, since those are hosted on the ATS vendor's
// own domain, not the company's.

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) UCPortalSourceDiscovery/1.0";
const FETCH_TIMEOUT_MS = 12000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal, headers: { "User-Agent": UA, ...options.headers } });
  } finally {
    clearTimeout(timeout);
  }
}

// A handful of plausible slugs from the company's own name -- real ATS
// slugs are usually the short/brand name, not the full legal name, so
// "Bain & Company" tries "bain" before "baincompany".
function slugCandidates(name) {
  const stripped = name
    .replace(/\b(inc|llc|corp|corporation|co|company|group|ltd|plc)\b\.?/gi, "")
    .trim();
  const words = stripped.split(/[\s&,.-]+/).filter(Boolean);
  const noSeparators = stripped.toLowerCase().replace(/[^a-z0-9]/g, "");
  const hyphenated = stripped
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const firstWord = (words[0] ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return [...new Set([noSeparators, hyphenated, firstWord].filter((s) => s.length > 1))];
}

// Greenhouse board tokens aren't reserved by company identity -- anyone can
// register a short slug, and it can collide with an unrelated org's
// abbreviation. Caught for real while building this: slug "bcg" is not
// Boston Consulting Group, it's an unrelated "Bohen Consulting Group" with
// placeholder test postings. Every job's own company_name field is the
// actual ground truth, so it's surfaced here for a human to compare against
// the company being checked -- a slug match alone is not a company match.
async function checkGreenhouse(slug) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return { slug, url, found: false, status: res.status };
    const body = await res.json();
    if (!Array.isArray(body.jobs)) return { slug, url, found: false, status: res.status, note: "200 but no jobs array" };
    const companyName = body.jobs[0]?.company_name?.trim() || null;
    return { slug, url, found: true, status: res.status, jobCount: body.jobs.length, companyName };
  } catch (err) {
    return { slug, url, found: false, error: err.message };
  }
}

// Lever's postings don't self-report a company name (no equivalent to
// Greenhouse's company_name field) -- a sample hostedUrl is surfaced
// instead so a human can open it and visually confirm, same reason as
// above: a slug match alone is not a company match.
async function checkLever(slug) {
  const url = `https://api.lever.co/v0/postings/${slug}?mode=json`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return { slug, url, found: false, status: res.status };
    const body = await res.json();
    if (!Array.isArray(body)) return { slug, url, found: false, status: res.status, note: "200 but not an array" };
    const sampleUrl = body[0]?.hostedUrl ?? null;
    return { slug, url, found: true, status: res.status, jobCount: body.length, sampleUrl };
  } catch (err) {
    return { slug, url, found: false, error: err.message };
  }
}

// Checks one page's HTML for schema.org JobPosting JSON-LD and a Workday
// hint. Doesn't try to enumerate all postings -- just answers "does this
// company's site do this at all," same as the manual spot-checks this repo
// already did for BCG/Deloitte/EY-Parthenon.
async function checkPageSignals(url) {
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return { url, reachable: false, status: res.status };
    const html = await res.text();
    const ldJsonBlocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
    let hasJobPosting = false;
    for (const [, block] of ldJsonBlocks) {
      try {
        const parsed = JSON.parse(block);
        const types = Array.isArray(parsed) ? parsed.map((p) => p["@type"]) : [parsed["@type"]];
        if (types.includes("JobPosting")) hasJobPosting = true;
      } catch {
        // malformed JSON-LD on the page -- not our problem, just skip it
      }
    }
    const workdayHint = /myworkdayjobs\.com/i.test(html);
    const greenhouseHint = /(boards-api\.greenhouse\.io|boards\.greenhouse\.io)/i.test(html);
    const leverHint = /jobs\.lever\.co/i.test(html);
    return { url, reachable: true, status: res.status, hasJobPosting, workdayHint, greenhouseHint, leverHint };
  } catch (err) {
    return { url, reachable: false, error: err.message };
  }
}

// Crude but useful: flags a likely slug-collision (see the "bcg" ==
// "Bohen Consulting Group" catch above) without pretending to be a real
// entity-resolution check. A human confirms either way -- this just
// decides whether to print a warning telling them to look closer.
function namesLookRelated(inputName, foundName) {
  if (!foundName) return null;
  const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const a = normalize(inputName);
  const b = normalize(foundName);
  return a.includes(b) || b.includes(a);
}

async function main() {
  const [name, domain] = process.argv.slice(2);
  if (!name) {
    console.error('Usage: node scripts/check-company-source.mjs "Company Name" [domain.com]');
    process.exit(1);
  }

  console.log(`\nSource discovery triage: "${name}"${domain ? ` (${domain})` : ""}\n`);

  const slugs = slugCandidates(name);
  console.log(`Trying slugs: ${slugs.join(", ")}\n`);

  console.log("-- Greenhouse (boards-api.greenhouse.io) --");
  const ghResults = await Promise.all(slugs.map(checkGreenhouse));
  for (const r of ghResults) {
    if (!r.found) {
      console.log(`  ✗ ${r.slug} -- ${r.status ?? r.error}`);
      continue;
    }
    const related = namesLookRelated(name, r.companyName);
    const warn = related === false ? "  ⚠ COMPANY NAME MISMATCH -- likely a different org that happens to share this slug" : "";
    console.log(`  ✓ ${r.slug} -- ${r.jobCount} postings, company_name: "${r.companyName ?? "(none reported)"}"${warn}`);
  }
  const ghHit = ghResults.find((r) => r.found && namesLookRelated(name, r.companyName) !== false);

  console.log("\n-- Lever (api.lever.co) --");
  const leverResults = await Promise.all(slugs.map(checkLever));
  const leverHit = leverResults.find((r) => r.found);
  for (const r of leverResults) {
    console.log(r.found ? `  ✓ ${r.slug} -- ${r.jobCount} postings, sample: ${r.sampleUrl ?? "(no sample url)"} -- open this to visually confirm the company` : `  ✗ ${r.slug} -- ${r.status ?? r.error}`);
  }

  let pageSignals = [];
  if (domain) {
    // Handles being handed either a bare domain ("bcg.com") or one that
    // already includes a careers subdomain ("careers.bcg.com") -- without
    // this, the latter produced a nonsensical "careers.careers.bcg.com".
    const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const alreadyHasCareersSubdomain = /^careers\./i.test(cleanDomain);
    const candidateUrls = [...new Set([
      `https://${cleanDomain}/careers`,
      alreadyHasCareersSubdomain ? `https://${cleanDomain}` : `https://careers.${cleanDomain}`,
      `https://${cleanDomain}/jobs`,
    ])];
    console.log("\n-- Careers page signals (schema.org JobPosting / Workday hint) --");
    console.log("   Note: schema.org JobPosting markup usually lives on individual job DETAIL pages, not");
    console.log("   generic /careers or /jobs listing pages (which are often client-rendered anyway) --");
    console.log("   a miss here doesn't rule it out, it just means you need a real job URL to check by hand.");
    pageSignals = await Promise.all(candidateUrls.map(checkPageSignals));
    for (const r of pageSignals) {
      if (!r.reachable) {
        console.log(`  ✗ ${r.url} -- ${r.status ?? r.error}`);
        continue;
      }
      const flags = [
        r.hasJobPosting && "JobPosting schema.org",
        r.workdayHint && "Workday hint",
        r.greenhouseHint && "Greenhouse hint",
        r.leverHint && "Lever hint",
      ].filter(Boolean);
      console.log(`  ${flags.length ? "✓" : "·"} ${r.url} (HTTP ${r.status})${flags.length ? " -- " + flags.join(", ") : " -- no signals found"}`);
    }
  } else {
    console.log("\n(no domain given -- skipping schema.org/Workday page checks; re-run with a domain to include them)");
  }

  console.log("\n== Verdict ==");
  if (ghHit) console.log(`Greenhouse: real board found at slug "${ghHit.slug}" (${ghHit.jobCount} postings, company_name "${ghHit.companyName}"). Next step: confirm this against Greenhouse's own developer docs, same as Stripe's Stage 3 pilot -- not just "the API responded."`);
  if (leverHit) console.log(`Lever: real board found at slug "${leverHit.slug}" (${leverHit.jobCount} postings) -- open ${leverHit.sampleUrl} to confirm it's actually this company (Lever doesn't self-report a company name the way Greenhouse does). Then confirm Lever's terms before treating this as authorized.`);
  const schemaHit = pageSignals.find((r) => r.hasJobPosting);
  if (schemaHit) console.log(`schema.org JobPosting found on ${schemaHit.url}. This is a weaker signal than a documented API (see BCG/Deloitte's writeup in JOB_ENGINE_ARCHITECTURE.md) -- still needs individual review, and an enumeration mechanism (a listing page that actually links to postings) hasn't been checked by this script.`);
  const workdayHit = pageSignals.find((r) => r.workdayHint);
  if (workdayHit) console.log(`Workday hint on ${workdayHit.url} -- this only means the page references myworkdayjobs.com, not a confirmed tenant/endpoint. Needs manual lookup (see Accenture's writeup) before anything's buildable.`);
  if (!ghHit && !leverHit && !schemaHit && !workdayHit) console.log("No usable signal found. Either this company isn't on a checkable platform, the slug guesses missed it, or (if no domain was given) try again with one.");
}

main();
