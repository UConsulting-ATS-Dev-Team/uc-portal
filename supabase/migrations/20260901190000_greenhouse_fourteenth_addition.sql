-- Fourteenth addition: six more Greenhouse companies (Fastly, Tenable,
-- Faire, StockX, Bombas, MyFitnessPal). Continues the big-name-first
-- direction the Twelfth/Thirteenth additions started (direct user quote:
-- "I want to get big name companies first. I've never heard of
-- Marqeta."). Read every prior dated entry in JOB_ENGINE_ARCHITECTURE.md
-- Part 7 first (Sixth through Thirteenth additions), compiling the full
-- roster of 190+ companies already added or checked-and-rejected across
-- thirteen prior passes, to avoid re-checking any of it.
--
-- Checked ~55 new candidates across categories not yet deeply searched:
-- real estate/proptech (Rivian, Zillow, Redfin, Compass, Opendoor),
-- retail/e-commerce (Wayfair, Chewy, Etsy, Warby Parker, Allbirds),
-- healthcare/biotech (Moderna, GoodRx, Teladoc, Hims & Hers), insurtech
-- (Lemonade, Root Insurance, Hippo Insurance, Next Insurance), food
-- delivery (Grubhub, Gopuff), cybersecurity (SentinelOne, Rapid7,
-- Tenable, HashiCorp), cloud infra (Fastly, DigitalOcean), gaming
-- (Electronic Arts, Unity Technologies, Niantic, Zynga), fitness tech
-- (Strava, Whoop), media (Vimeo, Patreon), hardware (GoPro, Sonos,
-- Garmin), travel (Booking Holdings, Expedia Group), dating apps
-- (Bumble, Match Group), automotive (Aurora Innovation), and a batch of
-- DTC/marketplace consumer brands (StockX, GOAT, Poshmark, ThredUp,
-- Casper, Away, Bombas, Faire, Rothy's, Outdoor Voices, MeUndies,
-- Grailed, MyFitnessPal, Untuckit, Cameo, Calm, Headspace, Chegg).
--
-- Almost all came back with no usable board or a Workday hint only,
-- extending this doc's now-established pattern to several new
-- verticals: real estate/proptech, most DTC/retail brands, healthcare/
-- biotech, insurtech, most cybersecurity vendors, gaming, fitness-app
-- makers, and travel OTAs all overwhelmingly run Workday or have no
-- checkable ATS signal at all. Real-but-empty boards (same class as
-- Plaid/Indeed/Narmi/Optiver/etc.): Whoop (Lever, 0 postings), Poshmark
-- (Greenhouse, 0 postings), Grailed (Greenhouse, 0 postings).
--
-- One real, legitimate board found and deliberately NOT added on
-- composition grounds, not identity grounds: Gopuff (Lever slug
-- "gopuff", 763 postings, confirmed genuinely the real instant-delivery
-- company -- 582 of 763 postings' own description text directly says
-- "across Gopuff's network", and titles are Philadelphia, PA-anchored,
-- Gopuff's real HQ). Sampled the full title list rather than trusting
-- the identity check alone: the board is overwhelmingly hundreds of
-- individual per-location "Liquor Barn - Store Associate/Key Holder,
-- {city}" and "Operations Associate, {city}" postings -- real hourly
-- retail-store and micro-fulfillment-center roles, the same "wrong kind
-- of job" problem Carvana's manual-trade half and Charlie Health's
-- clinical half already established this app filters for, except this
-- specific flavor (retail store clerks, warehouse pickers titled
-- "Operations Associate" rather than "Warehouse Associate") isn't
-- reliably caught by the current MANUAL_TRADE_TITLE_PATTERN in
-- server/src/relevance.ts. A crude keyword filter found only 553 of 763
-- titles surviving an obvious-retail-keyword strip, and even most of
-- that remainder is still per-location "Operations Associate, {city}"
-- fulfillment-center listings, not genuine corporate roles. Expanding
-- the denylist to also catch "store associate"/"key holder"/city-suffix
-- "operations associate" patterns was judged out of scope for this
-- source-discovery pass (the same "don't scope-creep a fallback
-- feature" judgment call already made once for the odds model's
-- industry-baseline limitation) -- flagged here as a real candidate for
-- a future denylist-expansion pass, not silently dropped or added blind
-- to risk swamping the 30-job cap with non-corporate listings.
--
-- Six real hits, each verified the same way as every prior addition --
-- company_name checked for an exact match (not substring), plus a
-- sampled application URL, office footprint, or job-description
-- self-reference cross-checked against the real company, never trusting
-- a slug guess alone. Two required finding the real board token by hand
-- after the obvious slug guess 404'd, the same technique already used
-- for SoundCloud/XTX Markets/Hudson River Trading/Chicago Trading
-- Company:
--
-- Fastly: real publicly-traded edge-cloud/CDN company (NYSE: FSLY).
-- Greenhouse slug "fastly" (an obvious-guess hit this time), 50
-- postings, company_name "Fastly" (exact). Sampled application URLs
-- resolve to www.fastly.com/about/jobs/apply?gh_jid=... (own domain) --
-- Assistant General Counsel/Counsel Product/Deal Desk Manager roles in
-- New York City and San Francisco. 12 of 50 titles survive the
-- white-collar relevance filter.
--
-- Tenable: real publicly-traded cybersecurity company (NASDAQ: TENB).
-- The obvious "tenable" Greenhouse slug 404'd; the real board is at
-- "tenableinc", found by trying legal-name-style variants the same way
-- Tenable Inc's own site never surfaced a direct embed in a raw fetch.
-- 39 postings, company_name "Tenable, Inc." (exact, not the bare
-- "Tenable" -- same IMC-Trading/Old-Mission-Capital lesson about not
-- assuming the short display name). Sampled location field reads "US -
-- Headquarters - Maryland - Columbia" -- Tenable's real HQ (Columbia,
-- MD) named directly. 23 of 39 titles survive the relevance filter.
--
-- Faire: real B2B wholesale marketplace connecting independent
-- retailers and brands. Greenhouse slug "faire", 63 postings,
-- company_name "Faire" (exact). No direct page-source embed found (the
-- careers page is client-rendered), so identity rests on two other
-- signals instead: every sampled job description's own "About Faire"
-- intro text ("Faire is a technology wholesale platform built on the
-- belief that the future is local...") and a San Francisco HQ plus a
-- real Kitchener-Waterloo/Toronto, ON engineering-office pair matching
-- Faire's known real Canada footprint. Heavily senior-titled board (most
-- postings carry "Senior"/"Staff"/"Head of"/"Principal", all correctly
-- denylisted) -- only 12 of 63 titles survive the relevance filter, but
-- those 12 (Account Executive, Executive Assistant Brand, GTM Systems
-- Engineer, Strategic Finance Lead, Talent Brand Manager, among them)
-- are genuinely white-collar, so the low survival rate reflects the
-- real seniority mix of this board, not a filtering bug.
--
-- StockX: real publicly-known sneaker/streetwear/collectibles resale
-- marketplace. Greenhouse slug "stockx" (obvious-guess hit), 34
-- postings, company_name "StockX" (exact). "Office Detroit, MI - HQ"
-- directly names StockX's real headquarters; titles self-reference the
-- company ("Business Development Manager, Trading Cards & Collectibles
-- - StockX Live", "Category Manager - StockX Live"); "Verification
-- Center" locations (Lithia Springs GA, Veldhoven NL, Tempe AZ, Detroit
-- MI, West Caldwell NJ) match StockX's real physical product-
-- authentication facilities. Board composition is mostly clean
-- corporate/tech roles (Category Manager, Data Analyst, Software
-- Engineer, Accountant) plus a "Sneaker/Energy Verification Expert"
-- role family that isn't manual-trade in the denylisted sense (product
-- authentication, not a trade skill) -- kept per the same
-- ambiguous-but-not-clearly-non-corporate judgment already applied to
-- Peloton's/Lucid's/Glossier's retail-adjacent titles. 27 of 34 titles
-- survive the relevance filter.
--
-- Bombas: real direct-to-consumer sock/apparel brand (donates a pair
-- per pair sold; a well-known Shark Tank alumnus). Greenhouse slug
-- "bombas" (obvious-guess hit), 13 postings, company_name "Bombas"
-- (exact). Every posting's office field reads "Bombas HQ (NYC)" --
-- Bombas's real headquarters, named directly in the data. Real
-- corporate roles: Administrative Assistant, Assistant Account
-- Executive Wholesale, Corporate Counsel, HR Business Partner Manager.
-- 10 of 13 titles survive the relevance filter.
--
-- MyFitnessPal: real calorie/nutrition-tracking app (independent again
-- since a 2020 Francisco Partners buyout from Under Armour). Greenhouse
-- slug "myfitnesspal" (obvious-guess hit), 13 postings, company_name
-- "MyFitnessPal" (exact). Two titles directly self-reference "Cal AI" --
-- MyFitnessPal's real AI calorie-tracking feature launched in 2024
-- ("Director, Product Management - Head of Cal AI", "Influencer
-- Marketing Specialist - Cal AI") -- an unambiguous, specific identity
-- signal, not a generic-name coincidence. Small survival count (5 of 13
-- -- FP&A Analyst, Influencer Marketing Specialist, Lead Brand
-- Marketing, Manager Engineering Subscription Growth, Site Reliability
-- Engineer) reflects the board's real Director/Sr.-heavy mix, same
-- small-but-real-relevant-slice precedent as ExodusPoint (2)/Bessemer
-- Venture Partners (1)/General Catalyst (1).
--
-- None of these six match a NAMED_COMPANY_RATES entry in
-- data/industryBaseRates.js (MBB / bulge-bracket IB / elite quant
-- trading / elite big tech) -- all fall through to that module's
-- broader industry-tier fallback, same as most of this app's real
-- sources today.
--
-- All six inherit Part 1's white-collar relevance filter
-- (isLikelySeniorRole/isLikelyNonCorporateRole) and Part 2's
-- MAX_ACTIVE_JOBS_PER_COMPANY=30 cap automatically -- no adapter code
-- changes, config-only, same as every Greenhouse addition since the
-- second. A local pure-JS estimate against the exact denylist regexes
-- in server/src/relevance.ts (run before this migration was written, not
-- assumed) predicted every one of the six would land comfortably under
-- the 30-job cap post-filter (Fastly 12, Tenable 23, Faire 12, StockX
-- 27, Bombas 10, MyFitnessPal 5) -- see this doc's dated entry for the
-- actual post-fetch/post-cap counts confirmed live against Postgres.
insert into sources (name, type, authorization_status, api_available, rate_limits, attribution_required, storage_restrictions, redistribution_restricted, notes, config)
values
  (
    'Fastly (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/fastly/jobs. company_name verified to say "Fastly" (exact). Sampled application URLs resolve to www.fastly.com/about/jobs/apply?gh_jid=... (own domain) -- Assistant General Counsel Commercial / Counsel Product / Deal Desk Manager in New York City / San Francisco. Real publicly-traded edge-cloud/CDN company (NYSE: FSLY).',
    '{"platform": "greenhouse", "slug": "fastly", "company": "Fastly"}'::jsonb
  ),
  (
    'Tenable (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/tenableinc/jobs -- the obvious "tenable" slug 404s; this is the real token, found by trying legal-name-style variants. company_name verified to say "Tenable, Inc." (exact) -- config uses the full legal form, not the bare "Tenable", same lesson as IMC Trading/Old Mission Capital. Sampled location field reads "US - Headquarters - Maryland - Columbia" -- Tenable''s real HQ, named directly. Real publicly-traded cybersecurity company (NASDAQ: TENB).',
    '{"platform": "greenhouse", "slug": "tenableinc", "company": "Tenable, Inc."}'::jsonb
  ),
  (
    'Faire (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/faire/jobs. company_name verified to say "Faire" (exact). No direct careers-page embed found (client-rendered); identity confirmed instead via every sampled job description''s own "About Faire" intro text ("Faire is a technology wholesale platform built on the belief that the future is local...") plus a San Francisco HQ and real Kitchener-Waterloo/Toronto ON engineering-office pair matching Faire''s known footprint. Real B2B wholesale marketplace connecting independent retailers and brands.',
    '{"platform": "greenhouse", "slug": "faire", "company": "Faire"}'::jsonb
  ),
  (
    'StockX (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/stockx/jobs. company_name verified to say "StockX" (exact). "Office Detroit, MI - HQ" directly names StockX''s real headquarters; titles self-reference the company ("...- StockX Live"); "Verification Center" locations (Lithia Springs GA, Veldhoven NL, Tempe AZ, Detroit MI, West Caldwell NJ) match StockX''s real physical product-authentication facilities. Real sneaker/streetwear/collectibles resale marketplace.',
    '{"platform": "greenhouse", "slug": "stockx", "company": "StockX"}'::jsonb
  ),
  (
    'Bombas (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/bombas/jobs. company_name verified to say "Bombas" (exact); every posting''s office field reads "Bombas HQ (NYC)" -- Bombas''s real headquarters, named directly. Real direct-to-consumer sock/apparel brand (donates a pair per pair sold).',
    '{"platform": "greenhouse", "slug": "bombas", "company": "Bombas"}'::jsonb
  ),
  (
    'MyFitnessPal (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/myfitnesspal/jobs. company_name verified to say "MyFitnessPal" (exact). Two titles directly self-reference "Cal AI" -- MyFitnessPal''s real AI calorie-tracking feature launched 2024 ("Director, Product Management - Head of Cal AI", "Influencer Marketing Specialist - Cal AI") -- an unambiguous, specific identity signal. Real calorie/nutrition-tracking app (independent since a 2020 Francisco Partners buyout from Under Armour).',
    '{"platform": "greenhouse", "slug": "myfitnesspal", "company": "MyFitnessPal"}'::jsonb
  );
