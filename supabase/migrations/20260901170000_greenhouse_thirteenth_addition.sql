-- Thirteenth addition: twenty more Greenhouse companies (Coupa, this
-- pass's one Lever hit, is a separate migration). Continuing the same
-- direction the (uncommitted-until-now) Twelfth addition started per
-- direct user request: "I want to get big name companies first. I've
-- never heard of Marqeta." -- prioritize companies a typical UCLA
-- business student would actually recognize (large tech, well-known
-- banks/financial firms, famous consumer brands, recognizable unicorns)
-- over smaller-but-legitimate niche firms.
--
-- Housekeeping note: this session found `supabase/migrations/
-- 20260901130000_greenhouse_twelfth_addition.sql` and
-- `20260901140000_lever_spotify.sql` already present on disk, untracked
-- by git, and already applied to the live database (`supabase migration
-- list` showed local==remote for both) -- real completed work from an
-- interrupted prior session (SpaceX, Discord, Epic Games, Twitch,
-- Peloton, Squarespace, Glossier, Lucid Motors, Waymo, Medium, Coursera,
-- Udemy, Spotify) that never got committed or documented. Verified live
-- (all 13 present in `sources`, 11 of 13 already carrying real active
-- job counts; Medium's single posting is genuinely senior-titled and
-- correctly filtered to 0, not a bug; Spotify's fetch hadn't run yet --
-- invoked `fetch-lever-companies` directly, which picked it up cleanly:
-- 30 active/39 total, capDeactivated 9). Committed alongside this
-- migration rather than re-done from scratch, and documented together
-- in this doc's dated entry.
--
-- Read every prior dated entry in JOB_ENGINE_ARCHITECTURE.md Part 7 plus
-- the Twelfth addition's own migration comments first, compiling the
-- full running list of 160+ companies already added or checked-and-
-- rejected across twelve prior passes (verified directly against the
-- live `sources` table via `npx supabase db query --linked` rather than
-- trusting the doc's prose alone), to avoid re-checking or re-adding any
-- of it.
--
-- Checked ~140 additional big/recognizable candidates not yet tried in
-- any prior pass, across large-cap tech, major banks/insurers, consumer
-- brands, and consumer-tech unicorns, via a batch Greenhouse/Lever probe
-- then full identity verification (company_name/sample application
-- URL/office footprint/content) on every hit:
--
-- No usable signal on any platform (confirms the Fortune-500/legacy-
-- enterprise pattern already established -- these companies overwhelmingly
-- run Workday/SuccessFactors/iCIMS/Taleo, not Greenhouse/Lever): Oracle,
-- SAP, IBM, Adobe, Intuit, ServiceNow, Nvidia, Netflix, Shopify, eBay,
-- Etsy, Expedia, Booking Holdings, Palo Alto Networks, CrowdStrike,
-- Workday, Splunk, Autodesk, VMware, Dell, HP Inc, Zillow, Redfin,
-- Opendoor, Chewy, Wells Fargo, Citigroup, Bank of America, PNC
-- Financial, Wayfair, American Express, Discover Financial, Synchrony
-- Financial, Truist, State Street, Ally Financial, BNY Mellon, HSBC,
-- Northern Trust, UBS, Cigna, Humana, Elevance Health, UnitedHealth
-- Group, Prudential Financial, AIG, Allstate, Nike, Coca-Cola, PepsiCo,
-- Procter & Gamble, Target, Johnson & Johnson, Walmart, Costco, Home
-- Depot, Starbucks, Chipotle, Lululemon, Ford, Tesla, Delta Air Lines,
-- Southwest Airlines, Yelp, Warner Bros Discovery, Comcast, Live Nation,
-- Ticketmaster, Anduril, Turo, Compass Real Estate, CarMax, Enterprise
-- Holdings, Nordstrom, Sephora, Ulta Beauty, Levi Strauss, Colgate-
-- Palmolive, VF Corp, Rivian, Under Armour, Hilton, Hyatt, Marriott,
-- Uber Technologies, Grubhub, Postmates, DoorDash Inc, eToro, TD
-- Ameritrade, E*TRADE, MoneyGram, Starling Bank, Chase, Invesco,
-- Franklin Templeton, Janus Henderson, Interactive Brokers, USAA,
-- Nationwide Insurance, Liberty Mutual, Chubb, Lemonade, Farmers
-- Insurance, Root Insurance, BlackRock, State Farm, Hippo Insurance,
-- Fortinet, SentinelOne, Wiz, 1Password, Devoted Health, Away, Warby
-- Parker, Allbirds, Casper, Chewy Inc, DraftKings, Electronic Arts,
-- Unity Technologies, Niantic, Trade Desk, HashiCorp, Sprinklr, Wix,
-- Marqeta Inc (the parent form of the already-live/now-disabled
-- "Marqeta" -- confirms the doc's own prior finding it migrated off
-- Greenhouse entirely), Remitly Inc, Flywire Inc, Paysafe, Nuvei,
-- Fiserv, Procore, Take-Two Interactive, Activision Blizzard,
-- SmartRecruiters, iCIMS, AvidXchange, Deel Inc.
--
-- Real-but-empty boards (same class as Plaid/Indeed/Narmi/Candidly/
-- Optiver/Marshall Wace/Wealthsimme/Permira/etc.): Unilever ("unilever",
-- 0 postings, null company_name).
--
-- Real identity rejections, same rigor as every prior "bcg"/Disney/
-- Capital One/Aura/Wise/Current/Founders Fund/Thrive Capital/Anchorage
-- Capital Group/Charles Schwab/Blue Apron catch:
--
-- 1. "General Motors" -- Greenhouse slug "general" resolves (1 posting)
--    but company_name is "General Interest" -- the exact same bare-word
--    slug-squat pattern General Catalyst's own "general" guess hit
--    (Ninth addition). Excluded.
--
-- 2. "US Bank" -- Greenhouse slug "us" resolves (1 posting) but
--    company_name is "itel - United States", an unrelated BPO/call-
--    center company. Excluded.
--
-- 3. "MetLife" -- Lever slug "metlife" resolves (39 postings), but every
--    single posting is an individually-named Colombia-based
--    commissioned insurance-agent recruiting listing ("Andres Gonzalez -
--    Consultor/a Comercial en Protección - Manizales", "Diana Diaz -
--    Gerente de Unidad en Formación - Cali") -- a sales-agent recruiting
--    funnel, not a real corporate open-roles board, the same pattern as
--    Wise's "Wise Worksite Field Sales" and Hudson River Trading's "HRT
--    Talent Community" exclusions. (Independently re-found and rejected
--    on the identical grounds by the uncommitted Twelfth addition's own
--    migration comments -- two independent checks agree.) Excluded.
--
-- 4. "Western Union" -- Greenhouse slug "westernunion" resolves, but has
--    exactly 1 posting titled literally "Senior Recruiter, Talent
--    Acquisition (Test)" -- a test/leftover posting, not a real job. The
--    company's own real careers page confirms a genuine Workday tenant
--    exists separately (workday hint present on westernunion.com/careers),
--    consistent with the established "large enterprise runs Workday, not
--    Greenhouse" pattern -- this Greenhouse board is stale/abandoned, same
--    class as the "Test Company Inc" row cleaned up in an earlier pass.
--    Excluded.
--
-- 5. "Blue Apron" -- Lever slug "blue" resolves (10 postings), but
--    titles ("#706 Snowflake Engagement Manager", "AI/ML Architect -
--    Talent Pipeline", "Solutions Architect (Pre-Sales)") describe a
--    Snowflake-consulting data-services boutique, not the real meal-kit
--    company. (Independently re-found and rejected on the identical
--    grounds by the uncommitted Twelfth addition's own migration
--    comments.) Excluded.
--
-- 6. "Capital Group" -- Lever slug "capital" resolves (37 postings), but
--    sampling the job data (offices in Limassol/Cyprus, Sofia/Bulgaria,
--    Warsaw/Poland, Dubai, Nassau/Bahamas; "Principal Security Engineer
--    (Crypto / Digital Assets)", "Senior Operations Manager (Digital
--    Assets)") shows this is the exact same unrelated crypto/CFD trading
--    company already identity-rejected under Capital One's identical
--    "capital" Lever slug (Fifth addition) -- not the real, US-based
--    asset manager Capital Group. Excluded.
--
-- Twenty real hits, all Greenhouse (Coupa, a twenty-first real hit, is a
-- separate Lever migration). Each verified the same way as every prior
-- addition -- company_name checked for an exact match, plus at least one
-- sampled application URL, page embed, or office footprint cross-checked
-- against the real company:
--
-- Roku: real publicly-traded streaming-device/smart-TV platform (NASDAQ:
-- ROKU). Greenhouse slug "roku", 251 postings, company_name "Roku"
-- (exact).
--
-- HelloFresh: real publicly-traded meal-kit company (ETR: HFG).
-- Greenhouse slug "hellofresh", 420 postings, company_name "HelloFresh"
-- (exact).
--
-- FanDuel: real sports-betting/iGaming brand (Flutter Entertainment
-- subsidiary). Greenhouse slug "fanduel", 92 postings, company_name
-- "FanDuel" (exact).
--
-- Tripadvisor: real publicly-traded online travel-review company
-- (NASDAQ: TRIP). Greenhouse slug "tripadvisor", 95 postings,
-- company_name "Tripadvisor" (exact, note lowercase "a" -- config value
-- matches this precisely, not the commonly-written "TripAdvisor").
-- careers.tripadvisor.com's own page directly hints a Greenhouse embed,
-- confirming identity beyond the slug/name alone.
--
-- Oscar Health: real publicly-traded health-insurance company (NYSE:
-- OSCR). Greenhouse slug "oscar", 264 postings, company_name "Oscar
-- Health" (exact) -- the bare "oscar" slug guess is a real name-
-- collision risk (a common first name), so the full company_name match
-- is what confirms identity here, not the slug alone.
--
-- Zscaler: real publicly-traded cybersecurity company (NASDAQ: ZS).
-- Greenhouse slug "zscaler", 351 postings, company_name "Zscaler"
-- (exact).
--
-- GitLab: real publicly-traded DevOps platform (NASDAQ: GTLB).
-- Greenhouse slug "gitlab", 219 postings, company_name "GitLab" (exact).
--
-- Elastic: real publicly-traded search/observability company (NYSE:
-- ESTC). Greenhouse slug "elastic", 342 postings, company_name "Elastic"
-- (exact).
--
-- Braze: real publicly-traded customer-engagement platform (NASDAQ:
-- BRZE). Greenhouse slug "braze", 296 postings, company_name "Braze"
-- (exact).
--
-- PagerDuty: real publicly-traded incident-response platform (NYSE: PD).
-- Greenhouse slug "pagerduty", 45 postings, company_name "PagerDuty"
-- (exact).
--
-- Rubrik: real publicly-traded data-security company (NYSE: RBRK).
-- Greenhouse slug "rubrik", 134 postings, company_name is "Rubrik Job
-- Board" (not the bare "Rubrik" -- config value matches this exactly,
-- the same IMC-Trading/Old-Mission-Capital-style lesson applied
-- proactively). Every sampled application URL resolves to
-- www.rubrik.com/company/careers/... (own domain), independently
-- confirming identity beyond the company_name field.
--
-- Samsara: real publicly-traded IoT/fleet-management company (NYSE:
-- IOT). Greenhouse slug "samsara", 245 postings, company_name "Samsara"
-- (exact).
--
-- Vercel: real frontend-cloud/deployment-platform company. Greenhouse
-- slug "vercel", 89 postings, company_name "Vercel" (exact);
-- vercel.com/careers and vercel.com/jobs both directly hint a Greenhouse
-- embed on the company's own domain.
--
-- Checkr: real background-check-platform company. Greenhouse slug
-- "checkr", 45 postings, company_name "Checkr" (exact).
--
-- Rent the Runway: real publicly-traded fashion-rental company (NASDAQ:
-- RENT). Greenhouse slug "renttherunway", 23 postings, company_name
-- "Rent the Runway" (exact); renttherunway.com/careers directly hints a
-- Greenhouse embed on the company's own domain.
--
-- Stitch Fix: real publicly-traded personal-styling company (NASDAQ:
-- SFIX). Greenhouse slug "stitchfix", 13 postings, company_name "Stitch
-- Fix" (exact).
--
-- Riot Games: real video-game developer/publisher (League of Legends,
-- Valorant; Tencent subsidiary). Greenhouse slug "riotgames", 167
-- postings, company_name "Riot Games" (exact).
--
-- New Relic: real observability/APM software company (formerly NYSE:
-- NEWR, taken private 2023). Greenhouse slug "newrelic", 51 postings,
-- company_name "New Relic" (exact); newrelic.com/careers directly hints
-- a Greenhouse embed on the company's own domain.
--
-- N26: real German neobank. Greenhouse slug "n26", 62 postings,
-- company_name "N26" (exact); n26.com/careers and n26.com/jobs both
-- directly hint a Greenhouse embed on the company's own domain.
--
-- Monzo: real UK neobank. Greenhouse slug "monzo", 64 postings,
-- company_name "Monzo" (exact); monzo.com/careers and monzo.com/jobs
-- both directly hint a Greenhouse embed on the company's own domain.
--
-- None of these twenty match a NAMED_COMPANY_RATES entry in
-- data/industryBaseRates.js (MBB / bulge-bracket IB / elite quant
-- trading / elite big tech) -- all fall through to that module's broader
-- industry-tier fallback, same as most of this app's real sources.
--
-- All twenty inherit Part 1's white-collar relevance filter
-- (isLikelySeniorRole/isLikelyNonCorporateRole) and Part 2's
-- MAX_ACTIVE_JOBS_PER_COMPANY=30 cap automatically -- no adapter code
-- changes, config-only, same as every Greenhouse addition since the
-- second. Verified live rather than assumed (see this doc's dated entry
-- for the actual post-fetch counts and title spot-checks).
insert into sources (name, type, authorization_status, api_available, rate_limits, attribution_required, storage_restrictions, redistribution_restricted, notes, config)
values
  (
    'Roku (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/roku/jobs. company_name verified to say "Roku" (exact) on every posting. Real publicly-traded streaming-device/smart-TV platform (NASDAQ: ROKU).',
    '{"platform": "greenhouse", "slug": "roku", "company": "Roku"}'::jsonb
  ),
  (
    'HelloFresh (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/hellofresh/jobs. company_name verified to say "HelloFresh" (exact) on every posting. Real publicly-traded meal-kit company (ETR: HFG).',
    '{"platform": "greenhouse", "slug": "hellofresh", "company": "HelloFresh"}'::jsonb
  ),
  (
    'FanDuel (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/fanduel/jobs. company_name verified to say "FanDuel" (exact) on every posting. Real sports-betting/iGaming brand (Flutter Entertainment subsidiary).',
    '{"platform": "greenhouse", "slug": "fanduel", "company": "FanDuel"}'::jsonb
  ),
  (
    'Tripadvisor (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/tripadvisor/jobs. company_name verified to say "Tripadvisor" (exact, lowercase "a") on every posting; careers.tripadvisor.com''s own page directly hints a Greenhouse embed. Real publicly-traded online travel-review company (NASDAQ: TRIP).',
    '{"platform": "greenhouse", "slug": "tripadvisor", "company": "Tripadvisor"}'::jsonb
  ),
  (
    'Oscar Health (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/oscar/jobs. company_name verified to say "Oscar Health" (exact, full name -- the bare "oscar" slug itself is a real name-collision risk given it''s a common first name) on every posting. Real publicly-traded health-insurance company (NYSE: OSCR).',
    '{"platform": "greenhouse", "slug": "oscar", "company": "Oscar Health"}'::jsonb
  ),
  (
    'Zscaler (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/zscaler/jobs. company_name verified to say "Zscaler" (exact) on every posting. Real publicly-traded cybersecurity company (NASDAQ: ZS).',
    '{"platform": "greenhouse", "slug": "zscaler", "company": "Zscaler"}'::jsonb
  ),
  (
    'GitLab (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/gitlab/jobs. company_name verified to say "GitLab" (exact) on every posting. Real publicly-traded DevOps platform (NASDAQ: GTLB).',
    '{"platform": "greenhouse", "slug": "gitlab", "company": "GitLab"}'::jsonb
  ),
  (
    'Elastic (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/elastic/jobs. company_name verified to say "Elastic" (exact) on every posting. Real publicly-traded search/observability company (NYSE: ESTC).',
    '{"platform": "greenhouse", "slug": "elastic", "company": "Elastic"}'::jsonb
  ),
  (
    'Braze (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/braze/jobs. company_name verified to say "Braze" (exact) on every posting. Real publicly-traded customer-engagement platform (NASDAQ: BRZE).',
    '{"platform": "greenhouse", "slug": "braze", "company": "Braze"}'::jsonb
  ),
  (
    'PagerDuty (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/pagerduty/jobs. company_name verified to say "PagerDuty" (exact) on every posting. Real publicly-traded incident-response platform (NYSE: PD).',
    '{"platform": "greenhouse", "slug": "pagerduty", "company": "PagerDuty"}'::jsonb
  ),
  (
    'Rubrik (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/rubrik/jobs. company_name reports "Rubrik Job Board" (not the bare "Rubrik" -- config value matches this exactly, same IMC-Trading/Old-Mission-Capital-style lesson applied proactively); every sampled application URL resolves to www.rubrik.com/company/careers/... (own domain), independently confirming identity beyond the company_name field. Real publicly-traded data-security company (NYSE: RBRK).',
    '{"platform": "greenhouse", "slug": "rubrik", "company": "Rubrik Job Board"}'::jsonb
  ),
  (
    'Samsara (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/samsara/jobs. company_name verified to say "Samsara" (exact) on every posting. Real publicly-traded IoT/fleet-management company (NYSE: IOT).',
    '{"platform": "greenhouse", "slug": "samsara", "company": "Samsara"}'::jsonb
  ),
  (
    'Vercel (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/vercel/jobs. company_name verified to say "Vercel" (exact); vercel.com/careers and vercel.com/jobs both directly hint a Greenhouse embed on the company''s own domain. Real frontend-cloud/deployment-platform company.',
    '{"platform": "greenhouse", "slug": "vercel", "company": "Vercel"}'::jsonb
  ),
  (
    'Checkr (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/checkr/jobs. company_name verified to say "Checkr" (exact) on every posting. Real background-check-platform company.',
    '{"platform": "greenhouse", "slug": "checkr", "company": "Checkr"}'::jsonb
  ),
  (
    'Rent the Runway (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/renttherunway/jobs. company_name verified to say "Rent the Runway" (exact); renttherunway.com/careers directly hints a Greenhouse embed on the company''s own domain. Real publicly-traded fashion-rental company (NASDAQ: RENT).',
    '{"platform": "greenhouse", "slug": "renttherunway", "company": "Rent the Runway"}'::jsonb
  ),
  (
    'Stitch Fix (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/stitchfix/jobs. company_name verified to say "Stitch Fix" (exact) on every posting. Real publicly-traded personal-styling company (NASDAQ: SFIX).',
    '{"platform": "greenhouse", "slug": "stitchfix", "company": "Stitch Fix"}'::jsonb
  ),
  (
    'Riot Games (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/riotgames/jobs. company_name verified to say "Riot Games" (exact) on every posting. Real video-game developer/publisher (League of Legends, Valorant; Tencent subsidiary).',
    '{"platform": "greenhouse", "slug": "riotgames", "company": "Riot Games"}'::jsonb
  ),
  (
    'New Relic (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/newrelic/jobs. company_name verified to say "New Relic" (exact); newrelic.com/careers directly hints a Greenhouse embed on the company''s own domain. Real observability/APM software company (formerly NYSE: NEWR, taken private 2023).',
    '{"platform": "greenhouse", "slug": "newrelic", "company": "New Relic"}'::jsonb
  ),
  (
    'N26 (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/n26/jobs. company_name verified to say "N26" (exact); n26.com/careers and n26.com/jobs both directly hint a Greenhouse embed on the company''s own domain. Real German neobank.',
    '{"platform": "greenhouse", "slug": "n26", "company": "N26"}'::jsonb
  ),
  (
    'Monzo (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/monzo/jobs. company_name verified to say "Monzo" (exact); monzo.com/careers and monzo.com/jobs both directly hint a Greenhouse embed on the company''s own domain. Real UK neobank.',
    '{"platform": "greenhouse", "slug": "monzo", "company": "Monzo"}'::jsonb
  );
