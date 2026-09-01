-- Eleventh addition: seventeen more Greenhouse companies. Same standing
-- direction as the Sixth-through-Tenth additions: prioritize finding new
-- companies over adding volume to existing ones, weighted toward
-- consulting/investment banking/tech/finance.
--
-- (1) Read every prior dated entry in JOB_ENGINE_ARCHITECTURE.md Part 7
--     before starting, to avoid re-checking any of the 150+ companies
--     already added or rejected across ten prior passes.
--
-- (2) Re-queried the live `people` table directly (`npx supabase db query
--     --linked`, every non-null/non-empty `company` value across Alumni
--     and current-member rows -- 94 distinct values after today's
--     real data-quality pass on that table). Every value came back
--     already checked in a prior pass except one: "Savant Care" (a
--     telepsychiatry/therapy provider) -- checked via
--     scripts/check-company-source.mjs, no usable board on either
--     platform. No new alumni-backed hits this pass.
--
-- (3) Branched into the same productive verticals, checking ~90 fresh
--     candidates via a batch Greenhouse/Lever probe:
--
--     Quant/prop-trading: Balyasny Asset Management, Man Group, Verition
--     Fund Management, Trexquant Investment, Tudor Investment Corporation,
--     Renaissance Technologies, Eisler Capital, Hehmeyer Trading,
--     G-Research, Millennium, Belvedere (bare-word guess -- the real one
--     is "belvederetrading", already live), Cubist Systematic Strategies
--     had no usable signal. Citadel (the hedge fund itself, distinct from
--     the already-live Citadel Securities entry in industryBaseRates.js)
--     had no usable signal either. Voleon's Lever slug and Stax's Lever
--     slug resolve but report 0 postings -- real-but-empty, same class as
--     Plaid/Narmi/Optiver/Marshall Wace/etc. One identity rejection:
--     "Anchorage Capital Group" (the multi-strategy hedge fund) was the
--     search target, but its Lever slug "anchorage" resolves to postings
--     unambiguously for Anchorage Digital instead (titles like "APAC
--     Regional Lead, Stablecoin Solutions" and "Credit Trader - Prime
--     Finance", offices in Cayman Islands/Singapore) -- a different real
--     company sharing the short name "Anchorage," the same slug-collision
--     pattern already caught for "bcg"/Disney/Capital One/Aura/Wise/
--     Current/General Catalyst's bare-word guess. Excluded, not added.
--     Four real hits: AQR Capital Management, PDT Partners, Engineers
--     Gate, Voloridge Investment Management (see below).
--
--     Fintech: Kraken (Lever, 0 postings -- real-but-empty), Nubank
--     (Greenhouse, 0 postings, null company_name -- real-but-empty),
--     Circle, Dave, Varo Bank, Airwallex, Remitly, Bilt Rewards, Brigit,
--     Petal, Zip Co, Afterpay, Flywire, Synctera, Unit, Column, Modern
--     Treasury, Increase (Lever, 0 postings) had no usable signal or were
--     real-but-empty. Four real hits: Gemini, Adyen, Cross River Bank,
--     Alloy, plus Tala on Lever (see below).
--
--     Consulting/advisory: GLG, Mosaic, Putnam Associates, PA Consulting,
--     Roland Berger, Cambridge Associates, Mercer, Willis Towers Watson,
--     Marsh McLennan, Actualize Consulting, Delphi Advisors, Ferrazzi
--     Greenlight had no usable signal. One real board found and NOT
--     added: "Coleman Research" -- Greenhouse slug "colemanresearch"
--     resolves, 11 postings, company_name "VISASQ/COLEMAN" (plausibly the
--     real expert-network Coleman Research Group, acquired by VisasQ in
--     2020 -- titles/offices are consistent: Raleigh NC, Reading UK, Hong
--     Kong, Bogota, multi-language "Associate (English and Japanese/
--     Korean/Mandarin)" roles). Identity could not be independently
--     confirmed, though: colemanresearch.com 301-redirects to
--     colemaninsights.com, an unrelated NC-based media-research firm, and
--     no working alternate domain (colemanresearchgroup.com,
--     colemanresearch.net) served confirming content. Excluded per this
--     project's established rigor bar for unconfirmable identity (same
--     class as Aura) -- a real board, deliberately not added, not a
--     rejection of the real company's existence.
--
--     Investment banking (a sub-vertical not deeply searched before this
--     pass, since MBB/bulge-bracket-style firms have consistently shown
--     no usable board): Houlihan Lokey, Perella Weinberg Partners,
--     Jefferies, Rothschild & Co, Piper Sandler, Raymond James, Stifel,
--     Robert W. Baird, Guggenheim Partners, PJT Partners, Centerview
--     Partners, Qatalyst Partners, Greenhill, Solomon Partners, Duff &
--     Phelps, Kroll Bond Rating, S&P Global, Moody's had no usable
--     signal. One real hit: William Blair (see below) -- confirms the
--     pattern extends to most mid-market IBs too, not just the largest
--     ones, but isn't universal.
--
--     Private equity/asset management/VC: Andreessen Horowitz, Kleiner
--     Perkins, Accel, Lightspeed Venture Partners, NEA, Tiger Global,
--     Coatue Management, IVP, Greylock Partners, Khosla Ventures,
--     Redpoint Ventures, Benchmark, Union Square Ventures, Vanguard,
--     Fidelity Investments, T. Rowe Price, Wellington Management, Angelo
--     Gordon, Sixth Street Partners, GoldenTree Asset Management,
--     Bridgewater Associates, Elliott Management, Baupost Group, York
--     Capital, Marathon Asset Management, Farallon Capital, Cerberus
--     Capital Management, TA Associates, Bain Capital Ventures, Lightyear
--     Capital had no usable signal. Index Ventures' Lever slug and
--     Fortress Investment Group's Lever slug and HPS Investment Partners'
--     Greenhouse slug all resolve but report 0 postings -- real-but-empty,
--     same class as Permira/Battery Ventures/Apollo/American Securities.
--     Two identity rejections, same "bare-word slug squat" pattern as
--     General Catalyst's own earlier catch: Founders Fund's "founders"
--     slug resolves to company_name "Founders Green Animal Hospital" (an
--     unrelated veterinary practice), and Thrive Capital's "thrive" slug
--     resolves to company_name "THRIVE" with only 3 postings (one titled
--     "Join Our Talent Community!", the same talent-pipeline-not-a-real-
--     board pattern as Hudson River Trading's earlier exclusion) based in
--     Atlanta -- doesn't match the NYC-based VC firm. Both excluded. No
--     real hits in this vertical this pass (General Atlantic/Bessemer
--     Venture Partners/General Catalyst from the Ninth addition remain
--     this app's only PE/VC sources).
--
--     Established tech companies with real public boards (the category
--     the task brief flagged as "not yet deeply searched," continuing
--     the Tenth addition's approach): OpenAI, Snowflake, Confluent, Zoom,
--     DocuSign, Atlassian, Salesforce, Snap, Uber, Canva, Miro, Zapier,
--     Grammarly, HubSpot (Greenhouse, 0 postings, null company_name --
--     real-but-empty) had no usable signal or were empty. Eight real
--     hits: Scale AI, Anthropic, Twilio, Cloudflare, Lyft, Airtable,
--     Webflow, Klaviyo (see below).
--
-- Eighteen real hits total this pass (seventeen Greenhouse below; Tala on
-- Lever is a separate migration), each verified the same way as every
-- prior addition -- company_name checked for an exact match, plus at
-- least one sampled application URL, page embed, or office footprint
-- cross-checked against the real company, never trusting a slug guess
-- alone:
--
-- AQR Capital Management: real quant investment firm. Greenhouse slug
-- "aqr", 54 postings, company_name "AQR" (short form, verified via the
-- sampled application URL resolving to careers.aqr.com -- own domain).
-- Offices (Greenwich CT, Dubai, Bengaluru, Hong Kong) match the real firm.
--
-- PDT Partners: real quant/systematic trading firm. Greenhouse slug
-- "pdtpartners", 10 postings, company_name "PDT Partners" (exact).
-- pdtpartners.com's own page source directly embeds this exact board
-- (greenhouse.io/pdtpartners/jobs/... links present).
--
-- Engineers Gate: real quant trading firm. Greenhouse slug
-- "engineersgate", 7 postings, company_name "Engineers Gate" (exact).
-- Offices (New York, Hong Kong, London) and titles (Quantitative
-- Researcher, Trading Operations Associate) match the real firm.
--
-- Voloridge Investment Management: real quant investment firm.
-- Greenhouse slug "voloridgeinvestmentmanagement", 8 postings,
-- company_name "Voloridge Investment Management" (exact, full legal
-- name). All postings located in Jupiter, FL -- the real firm's actual
-- headquarters.
--
-- Gemini: real cryptocurrency exchange (Winklevoss twins' company).
-- Greenhouse slug "gemini", 40 postings, company_name "Gemini" (exact).
-- One posting is titled "Head of Compliance, Gemini Galactic Markets,
-- LLC" -- a real Gemini subsidiary -- and locations are heavily
-- NYC/Miami-weighted, matching the real exchange, not a name-collision
-- with the unrelated "Gemini" AI product.
--
-- Adyen: real publicly-traded payments company (AMS: ADYEN). Greenhouse
-- slug "adyen", 220 postings, company_name "Adyen" (exact).
--
-- Cross River Bank: real fintech-infrastructure bank. Greenhouse slug
-- "crossriverbank", 38 postings, company_name "Cross River" (short form,
-- verified via the sampled application URL resolving to
-- www.crossriver.com/greenhouse -- own domain).
--
-- Alloy: real identity-verification/fraud-prevention fintech. Greenhouse
-- slug "alloy", 22 postings, company_name "Alloy" (exact, verified via
-- the sampled application URL resolving to www.alloy.com/about/jobs --
-- own domain). Note: a separate Lever slug "alloy" also resolves (7
-- postings) -- deliberately not added alongside this one, since Alloy is
-- a common enough name that a second platform hosting a same-named board
-- can't be assumed to be the same company without further identity work;
-- the Greenhouse board alone is independently domain-confirmed and
-- sufficient.
--
-- William Blair: real mid-market investment bank/asset manager.
-- Greenhouse slug "williamblair", 50 postings, company_name "William
-- Blair" (exact, verified via the sampled application URL resolving to
-- www.williamblair.com/Careers -- own domain). The only IB-vertical hit
-- found across ~18 mid-market/boutique banks checked this pass.
--
-- Scale AI: real AI data-labeling/infrastructure company. Greenhouse slug
-- "scaleai", 211 postings, company_name "Scale AI" (exact).
--
-- Anthropic: real AI research/product company. Greenhouse slug
-- "anthropic", 571 postings, company_name "Anthropic" (exact).
--
-- Twilio: real publicly-traded cloud-communications company (NYSE:
-- TWLO). Greenhouse slug "twilio", 135 postings, company_name "Twilio"
-- (exact).
--
-- Cloudflare: real publicly-traded network/security company (NYSE:
-- NET). Greenhouse slug "cloudflare", 319 postings, company_name
-- "Cloudflare" (exact).
--
-- Lyft: real publicly-traded rideshare company (NASDAQ: LYFT).
-- Greenhouse slug "lyft", 164 postings, company_name "Lyft" (exact),
-- sampled application URL resolves to app.careerpuck.com/job-board/lyft
-- (Lyft's own careers-page vendor).
--
-- Airtable: real no-code database/app-building company. Greenhouse slug
-- "airtable", 16 postings, company_name "Airtable" (exact).
--
-- Webflow: real no-code website-building company. Greenhouse slug
-- "webflow", 31 postings, company_name "Webflow" (exact).
--
-- Klaviyo: real publicly-traded marketing-automation company (NYSE:
-- KVYO). Greenhouse slug "klaviyo", 140 postings, company_name "Klaviyo"
-- (exact, verified via the sampled application URL resolving to
-- www.klaviyo.com/careers -- own domain).
--
-- None of these seventeen match a NAMED_COMPANY_RATES entry in
-- data/industryBaseRates.js (MBB / bulge-bracket IB / elite quant trading
-- / elite big tech) -- all fall through to that module's broader
-- industry-tier fallback, same as most of this app's real sources.
--
-- All seventeen inherit Part 1's white-collar relevance filter
-- (isLikelySeniorRole/isLikelyNonCorporateRole) and Part 2's
-- MAX_ACTIVE_JOBS_PER_COMPANY=30 cap automatically -- no adapter code
-- changes, config-only, same as every Greenhouse addition since the
-- second. Verified live rather than assumed (see this doc's dated entry
-- for the actual post-fetch counts and title spot-checks).
insert into sources (name, type, authorization_status, api_available, rate_limits, attribution_required, storage_restrictions, redistribution_restricted, notes, config)
values
  (
    'AQR Capital Management (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/aqr/jobs. company_name reports the short form "AQR" -- verified via the sampled application URL resolving to careers.aqr.com (own domain) and offices (Greenwich CT, Dubai, Bengaluru, Hong Kong) matching the real quant investment firm.',
    '{"platform": "greenhouse", "slug": "aqr", "company": "AQR"}'::jsonb
  ),
  (
    'PDT Partners (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/pdtpartners/jobs. company_name verified to say "PDT Partners" on every posting; pdtpartners.com''s own page source directly embeds this exact board. Real quant/systematic trading firm.',
    '{"platform": "greenhouse", "slug": "pdtpartners", "company": "PDT Partners"}'::jsonb
  ),
  (
    'Engineers Gate (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/engineersgate/jobs. company_name verified to say "Engineers Gate" on every posting; offices (New York, Hong Kong, London) and titles (Quantitative Researcher, Trading Operations Associate) match the real quant trading firm.',
    '{"platform": "greenhouse", "slug": "engineersgate", "company": "Engineers Gate"}'::jsonb
  ),
  (
    'Voloridge Investment Management (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/voloridgeinvestmentmanagement/jobs. company_name verified to say "Voloridge Investment Management" (exact, full legal name) on every posting; all postings located in Jupiter, FL -- the real firm''s actual headquarters.',
    '{"platform": "greenhouse", "slug": "voloridgeinvestmentmanagement", "company": "Voloridge Investment Management"}'::jsonb
  ),
  (
    'Gemini (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/gemini/jobs. company_name verified to say "Gemini" on every posting; one posting is titled "Head of Compliance, Gemini Galactic Markets, LLC" (a real Gemini subsidiary), and locations are heavily NYC/Miami-weighted, matching the real cryptocurrency exchange (Winklevoss twins'' company), not a name-collision with the unrelated "Gemini" AI product.',
    '{"platform": "greenhouse", "slug": "gemini", "company": "Gemini"}'::jsonb
  ),
  (
    'Adyen (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/adyen/jobs. company_name verified to say "Adyen" on every posting. Real publicly-traded payments company (AMS: ADYEN).',
    '{"platform": "greenhouse", "slug": "adyen", "company": "Adyen"}'::jsonb
  ),
  (
    'Cross River Bank (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/crossriverbank/jobs. company_name reports the short form "Cross River" -- verified via the sampled application URL resolving to www.crossriver.com/greenhouse (own domain). Real fintech-infrastructure bank.',
    '{"platform": "greenhouse", "slug": "crossriverbank", "company": "Cross River"}'::jsonb
  ),
  (
    'Alloy (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/alloy/jobs. company_name verified to say "Alloy" on every posting; sampled application URL resolves to www.alloy.com/about/jobs (own domain). Real identity-verification/fraud-prevention fintech. Note: a separate Lever slug "alloy" also resolves -- deliberately not added, since a common company name on a second platform can''t be assumed to be the same entity without further identity work; this Greenhouse board is independently domain-confirmed and sufficient on its own.',
    '{"platform": "greenhouse", "slug": "alloy", "company": "Alloy"}'::jsonb
  ),
  (
    'William Blair (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/williamblair/jobs. company_name verified to say "William Blair" on every posting; sampled application URL resolves to www.williamblair.com/Careers (own domain). Real mid-market investment bank/asset manager -- the only IB-vertical hit found across ~18 mid-market/boutique banks checked this pass.',
    '{"platform": "greenhouse", "slug": "williamblair", "company": "William Blair"}'::jsonb
  ),
  (
    'Scale AI (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/scaleai/jobs. company_name verified to say "Scale AI" on every posting. Real AI data-labeling/infrastructure company.',
    '{"platform": "greenhouse", "slug": "scaleai", "company": "Scale AI"}'::jsonb
  ),
  (
    'Anthropic (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/anthropic/jobs. company_name verified to say "Anthropic" on every posting. Real AI research/product company.',
    '{"platform": "greenhouse", "slug": "anthropic", "company": "Anthropic"}'::jsonb
  ),
  (
    'Twilio (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/twilio/jobs. company_name verified to say "Twilio" on every posting. Real publicly-traded cloud-communications company (NYSE: TWLO).',
    '{"platform": "greenhouse", "slug": "twilio", "company": "Twilio"}'::jsonb
  ),
  (
    'Cloudflare (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/cloudflare/jobs. company_name verified to say "Cloudflare" on every posting. Real publicly-traded network/security company (NYSE: NET).',
    '{"platform": "greenhouse", "slug": "cloudflare", "company": "Cloudflare"}'::jsonb
  ),
  (
    'Lyft (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/lyft/jobs. company_name verified to say "Lyft" on every posting; sampled application URL resolves to app.careerpuck.com/job-board/lyft (Lyft''s own careers-page vendor). Real publicly-traded rideshare company (NASDAQ: LYFT).',
    '{"platform": "greenhouse", "slug": "lyft", "company": "Lyft"}'::jsonb
  ),
  (
    'Airtable (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/airtable/jobs. company_name verified to say "Airtable" on every posting. Real no-code database/app-building company.',
    '{"platform": "greenhouse", "slug": "airtable", "company": "Airtable"}'::jsonb
  ),
  (
    'Webflow (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/webflow/jobs. company_name verified to say "Webflow" on every posting. Real no-code website-building company.',
    '{"platform": "greenhouse", "slug": "webflow", "company": "Webflow"}'::jsonb
  ),
  (
    'Klaviyo (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/klaviyo/jobs. company_name verified to say "Klaviyo" on every posting; sampled application URL resolves to www.klaviyo.com/careers (own domain). Real publicly-traded marketing-automation company (NYSE: KVYO).',
    '{"platform": "greenhouse", "slug": "klaviyo", "company": "Klaviyo"}'::jsonb
  );
