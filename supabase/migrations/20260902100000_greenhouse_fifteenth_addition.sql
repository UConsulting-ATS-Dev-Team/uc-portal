-- Fifteenth addition: six more Greenhouse companies (Flexport, Netskope,
-- Wiz, Doximity, Fanatics, MasterClass). Continues the big-name-first
-- direction the Twelfth/Thirteenth/Fourteenth additions started (direct
-- user quote: "I want to get big name companies first. I've never heard
-- of Marqeta."). Read every prior dated entry in
-- JOB_ENGINE_ARCHITECTURE.md Part 7 first (Sixth through Fourteenth
-- additions), compiling the full roster of 190+ companies already added
-- or checked-and-rejected across fourteen prior passes -- confirmed
-- against the live `sources` table (133 distinct company names, 134
-- rows counting Deloitte's RSS feed) before checking anything, to avoid
-- re-checking any of it.
--
-- Checked ~70 new candidates across categories the task brief flagged as
-- not yet exhausted: media/entertainment/streaming, healthcare/pharma/
-- biotech, insurance, real estate/proptech, food delivery, cybersecurity,
-- cloud infrastructure, semiconductor/hardware, sports/fitness tech,
-- education tech, hospitality/travel, logistics/supply chain, and
-- automotive/mobility. Most of these candidates overlapped with the
-- Fourteenth addition's own already-checked list (Rivian, Zillow,
-- Redfin, Compass, Opendoor, Chegg, Unity Technologies, Niantic, GoPro,
-- Sonos, Strava, Whoop, SentinelOne, HashiCorp, DigitalOcean, Moderna,
-- GoodRx, Teladoc, Hims & Hers, Lemonade, Root Insurance) -- independent
-- re-checks this pass agreed with that prior pass's "no usable board"
-- verdict on every one of them, a useful cross-validation rather than
-- wasted effort. New candidates checked this pass that hadn't been
-- tried before: Illumina, Headspace (re-confirmed no usable board, not
-- previously detailed), Noom, Booking.com, Expedia, Vrbo, Skillshare,
-- Convoy, Rapid7, Snyk, 1Password, iRobot, DraftKings, Course Hero
-- (Greenhouse slug resolves, 0 postings -- real-but-empty, same class as
-- Plaid/Indeed/Narmi/Whoop/etc.) -- all came back with no usable board
-- or signal, further confirming the now well-established pattern that
-- most consumer/enterprise brands at this scale run Workday or nothing
-- checkable at all.
--
-- One candidate checked and deliberately NOT added, composition grounds
-- not identity grounds: Calm (Greenhouse slug "calm" resolves,
-- company_name "Calm.com" -- genuinely the real meditation-app company,
-- confirmed via SF/Austin/NYC/Minneapolis office footprint) -- but the
-- board has exactly one live posting ("Senior Product Designer"), and
-- "Senior" trips the existing SENIOR_TITLE_PATTERN denylist on
-- ingestion, netting to zero active relevant jobs. Functionally
-- identical to the "Medium" precedent from the Twelfth addition (a real
-- company, correctly identified, added then removed once its one
-- posting proved non-relevant) -- not added at all here rather than
-- added-then-removed, since the zero-relevance outcome was caught before
-- writing the migration this time.
--
-- Six real hits, each verified the same way as every prior addition --
-- company_name checked for an exact match (not substring), plus sampled
-- application URLs, office footprints, or job-description self-
-- references cross-checked against the real company, never trusting a
-- slug guess alone. A local pure-JS estimate against the exact
-- SENIOR_TITLE_PATTERN/MANUAL_TRADE_TITLE_PATTERN/
-- CLINICAL_CARE_TITLE_PATTERN regexes in server/src/relevance.ts was run
-- against every live posting for all six before writing this migration
-- (not assumed) -- see this doc's dated entry for the predicted vs.
-- actual post-fetch/post-cap counts:
--
-- Flexport: real freight-forwarding/logistics tech company (Y Combinator
-- alumnus, one of the best-known logistics unicorns; ~$8B peak
-- valuation). Greenhouse slug "flexport" (obvious-guess hit), 174
-- postings, company_name "Flexport" (exact). Office footprint spans
-- Atlanta/Chicago/Dallas/NYC/San Bernardino warehouses plus
-- Dublin/Frankfurt/Hamburg/Amsterdam/Milan sales offices -- matches
-- Flexport's real global footprint. 119 of 174 titles survive the
-- relevance filter locally (Sales Development Representative, Account
-- Manager, Ocean Operations Associate, Customs Specialist, among them);
-- will be capped to 30 active by MAX_ACTIVE_JOBS_PER_COMPANY.
--
-- Netskope: real publicly-traded cloud-security (SASE) company (NASDAQ:
-- NTSK, IPO'd 2025). Greenhouse slug "netskope" (obvious-guess hit), 143
-- postings, company_name "Netskope" (exact). Strongest identity signal
-- of this pass: every sampled application URL resolves directly to
-- Netskope's own domain (www.netskope.com/company/careers/open-
-- positions/?gh_jid=...), the same own-domain-embed tier as Adyen/
-- Klaviyo/William Blair/Fastly. 99 of 143 titles survive the relevance
-- filter locally (Strategic Sales Manager, Regional Sales Manager,
-- Channel Marketing Specialist, among them); will be capped to 30.
--
-- Wiz: real cloud-security company, extremely high-profile in 2025-2026
-- (Google's ~$32B acquisition, one of the largest tech acquisitions
-- ever) -- exactly the kind of name the user's "big name" direction asks
-- for. The obvious "wiz" Greenhouse slug guess doesn't resolve to it (a
-- different org); the real board is at "wizinc", found the same way
-- Tenable's "tenableinc" token was found in the Fourteenth addition.
-- 127 postings, company_name "Wiz, Inc." (exact). Application URLs
-- resolve to Wiz's own domain (www.wiz.io/careers/job/...?gh_jid=...).
-- 93 of 127 titles survive the relevance filter locally (Partner
-- Marketing Manager, Enterprise Account Executive, Compliance Engineer -
-- US Public Sector, among them); will be capped to 30.
--
-- Doximity: real publicly-traded medical/physician professional network
-- (NYSE: DOCS). Greenhouse slug "doximity" (obvious-guess hit), 10
-- postings, company_name "Doximity" (exact). Titles reference
-- Doximity's real "Hospital Solutions" product line directly (Client
-- Success Manager, Hospital Solutions / Product Manager, Hospital
-- Solutions), San Francisco HQ matches. 5 of 10 titles survive the
-- relevance filter locally (Client Success Manager Hospital Solutions,
-- Data Analyst Reporting Partnerships, Locum Tenens Recruiter, Product
-- Manager Hospital Solutions, Sales Development Representative Talent
-- Finder) -- a small but genuinely relevant slice, same precedent as
-- ExodusPoint/Bessemer Venture Partners/General Catalyst's thin boards.
--
-- Fanatics: real sports-merchandise/e-commerce company (major MLB/NFL/
-- NBA licensing partner; ~$31B private valuation), a widely recognized
-- consumer brand. Greenhouse slug "fanaticsinc" (the obvious bare
-- "fanatics" guess didn't resolve; found via the legal-name-style
-- variant, same technique as Tenable/Wiz above), 16 postings,
-- company_name "Fanatics Inc." (exact). NYC and Jacksonville FL offices
-- match Fanatics's real headquarters footprint. 7 of 16 titles survive
-- the relevance filter locally (HRIS Integrations Support Analyst,
-- Manager Enterprise Partnerships - Financial Services, HR Compliance
-- Manager, AI Engineer, Manager Corporate Security, among them).
--
-- MasterClass: real celebrity-taught online-learning subscription
-- service, a widely recognized consumer brand. Greenhouse slug
-- "masterclass" (obvious-guess hit), 3 postings, company_name
-- "MasterClass" (exact) -- titles self-reference the company directly
-- ("Enrollment Advisor, MasterClass Executive"), an unambiguous identity
-- signal. Thin board: 2 of 3 titles survive the relevance filter locally
-- (AI Project Reviewer (CONTRACT), Enrollment Advisor MasterClass
-- Executive (Temporary)) -- the third ("Creative Director, Certificates")
-- is correctly denylisted as senior. Added anyway per the same
-- thin-but-real precedent as Doximity/ExodusPoint/Bessemer Venture
-- Partners/General Catalyst, not held to a higher bar just because the
-- absolute count is small.
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
-- second.
insert into sources (name, type, authorization_status, api_available, rate_limits, attribution_required, storage_restrictions, redistribution_restricted, notes, config)
values
  (
    'Flexport (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/flexport/jobs. company_name verified to say "Flexport" (exact). Office footprint (Atlanta/Chicago/Dallas/NYC/San Bernardino warehouses, Dublin/Frankfurt/Amsterdam/Milan sales offices) matches the real freight-forwarding/logistics company. 119 of 174 sampled titles survive the white-collar relevance filter locally; will be capped to 30 active.',
    '{"platform": "greenhouse", "slug": "flexport", "company": "Flexport"}'::jsonb
  ),
  (
    'Netskope (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/netskope/jobs. company_name verified to say "Netskope" (exact). Sampled application URLs resolve to www.netskope.com/company/careers/open-positions/?gh_jid=... (own domain). Real publicly-traded cloud-security (SASE) company (NASDAQ: NTSK). 99 of 143 sampled titles survive the relevance filter locally; will be capped to 30 active.',
    '{"platform": "greenhouse", "slug": "netskope", "company": "Netskope"}'::jsonb
  ),
  (
    'Wiz (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/wizinc/jobs -- the obvious "wiz" slug resolves to an unrelated org; this is the real token. company_name verified to say "Wiz, Inc." (exact). Sampled application URLs resolve to www.wiz.io/careers/job/...?gh_jid=... (own domain). Real cloud-security company, subject of Google''s ~$32B acquisition (one of the largest tech acquisitions ever). 93 of 127 sampled titles survive the relevance filter locally; will be capped to 30 active.',
    '{"platform": "greenhouse", "slug": "wizinc", "company": "Wiz, Inc."}'::jsonb
  ),
  (
    'Doximity (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/doximity/jobs. company_name verified to say "Doximity" (exact). Titles reference Doximity''s real "Hospital Solutions" product line directly, San Francisco HQ matches. Real publicly-traded physician/medical professional network (NYSE: DOCS). 5 of 10 sampled titles survive the relevance filter locally.',
    '{"platform": "greenhouse", "slug": "doximity", "company": "Doximity"}'::jsonb
  ),
  (
    'Fanatics (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/fanaticsinc/jobs -- the obvious "fanatics" slug does not resolve; this is the real token (legal-name-style variant). company_name verified to say "Fanatics Inc." (exact). NYC/Jacksonville FL offices match Fanatics''s real HQ footprint. Real sports-merchandise/e-commerce company (major MLB/NFL/NBA licensing partner). 7 of 16 sampled titles survive the relevance filter locally.',
    '{"platform": "greenhouse", "slug": "fanaticsinc", "company": "Fanatics Inc."}'::jsonb
  ),
  (
    'MasterClass (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/masterclass/jobs. company_name verified to say "MasterClass" (exact); titles self-reference the company directly ("Enrollment Advisor, MasterClass Executive"). Real celebrity-taught online-learning subscription service. Thin board: 2 of 3 sampled titles survive the relevance filter locally.',
    '{"platform": "greenhouse", "slug": "masterclass", "company": "MasterClass"}'::jsonb
  );
