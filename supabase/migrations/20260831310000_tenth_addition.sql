-- Tenth addition: twenty-six more companies (twenty-four Greenhouse, two
-- Lever), the largest single source-discovery pass this doc has recorded,
-- surpassing the Ninth. Same standing direction as every addition since
-- the Sixth: prioritize finding new companies over adding volume to
-- existing ones, weighted toward consulting/investment banking/tech/
-- finance.
--
-- Step 1: re-queried the live `people` table directly (`npx supabase db
-- query --linked`, every non-null/non-empty `company` value, both Alumni
-- and current-member rows). Every distinct value came back already
-- checked (live or rejected) in a prior pass -- no new alumni-backed
-- candidates this pass; the roster hasn't grown since the Eighth
-- addition's McKenna Labs/Paladin Protocol check (confirmed again by the
-- Ninth addition, and again here).
--
-- Step 2: branched into the same four verticals plus a fifth this pass
-- added per the task's own explicit invitation ("more established tech
-- companies with real Greenhouse/Lever boards that haven't been
-- checked yet"), checking ~95 new candidates against both platforms via
-- scripts/check-company-source.mjs:
--
-- Quant/prop-trading (17 checked): Trexquant, Balyasny Asset Management,
-- Verition Fund Management, Man Group, PEAK6, Cumberland, Headlands
-- Technologies, XR Trading, Spot Trading, Tibra Capital, and Gelber Group
-- had no usable signal on either platform. Voleon's Lever slug and Walleye
-- Capital's Greenhouse slug both resolve but report 0 postings (Voleon
-- also has no company_name field to check, same as every Lever posting;
-- Walleye Capital's Greenhouse company_name is null) -- same real-but-
-- empty case already documented for Plaid/Indeed/Narmi/Candidly/Optiver/
-- Apollo/American Securities/Thoma Bravo/Marshall Wace/Permira/Battery
-- Ventures. Graham Capital Management, GSA Capital, Simplex Trading, and
-- Geneva Trading were real hits (see below).
--
-- Fintech (18 checked): Circle, Modern Treasury, Unit, Persona, Airwallex,
-- Navan, Pilot.com, Bench Accounting, Novo, BlueVine, and Divvy had no
-- usable signal on either platform. Papaya Global's Greenhouse slug
-- resolves but reports 0 postings and a null company_name -- same real-
-- but-empty case as above. Ripple, Toast, BILL (Bill.com), Melio,
-- Payoneer, Justworks, and Coalition were real hits (see below).
--
-- Consulting/advisory (18 checked): Roland Berger, Strategy&, Bridgespan
-- Group, Trinity Life Sciences, GLG, Tegus, Capgemini Invent, Publicis
-- Sapient, North Highland, Crowe, CohnReznick, Moss Adams, Riveron,
-- StoneTurn, and Edgeworth Economics had no usable signal on either
-- platform. AlphaSights, Third Bridge, and Point B were real hits (see
-- below).
--
-- Private equity/asset management/VC (15 checked): Accel, Andreessen
-- Horowitz, Lightspeed Venture Partners, Greylock Partners, Benchmark,
-- NEA, Khosla Ventures, Tiger Global Management, Coatue Management,
-- Redpoint Ventures, and Menlo Ventures had no usable signal on either
-- platform. Index Ventures' Lever slug resolves but reports 0 postings --
-- same real-but-empty case as above. Founders Fund's bare "founders" slug
-- resolves to an unrelated company, company_name "Founders Green Animal
-- Hospital" -- the same slug-squatting pattern already caught for "bcg"/
-- "Disney"/Capital One's Lever slug/Aura/Wise/Current/the bare "general"
-- guess for General Catalyst, excluded on identity grounds. "Thrive"
-- (guessed as a possible slug for Thrive Capital) resolves on Greenhouse
-- with company_name "THRIVE", but every posting is a UX/design role based
-- in Atlanta, GA -- independently confirmed via web search to be an
-- unrelated Atlanta strategic-design firm (thrivethinking.com), not the
-- NYC venture capital firm Thrive Capital -- excluded on identity grounds,
-- same rigor as Founders Fund above. Iconiq Capital was a real hit (see
-- below).
--
-- Real estate/insurance (13 checked): JLL, Cushman & Wakefield, Colliers,
-- Newmark, Compass, Opendoor, Rocket Companies, Lemonade, Root Insurance,
-- Hippo Insurance, Next Insurance, Marsh McLennan, Willis Towers Watson,
-- and Arthur J Gallagher had no usable signal on either platform. Better
-- .com's Lever slug resolves but reports 0 postings -- same real-but-empty
-- case as above. Coalition, Inc. (cyber insurance) was a real hit,
-- counted in the fintech list above since it surfaced from that search
-- pass.
--
-- Established tech, checked per this pass's own explicit fifth vertical
-- (14 checked): Snowflake, Unity, and Box had no usable signal on either
-- platform. Palantir, Datadog, MongoDB, Okta, Asana, Instacart, Dropbox,
-- Reddit, Duolingo, Pinterest, and Roblox were real hits (see below) --
-- all eleven are exact company_name matches (Greenhouse) or, for
-- Palantir, confirmed via a hostedUrl/office/program-name match (Lever) --
-- unambiguous, globally known single-entity brands with no realistic
-- slug-collision risk, unlike several smaller/generically-named companies
-- checked in prior passes.
--
-- Twenty-four Greenhouse hits, each verified the same way as every prior
-- addition -- company_name checked for an exact match, plus a sampled
-- application URL, page embed, web search, or office/content footprint
-- cross-checked against the real company:
--
-- Graham Capital Management: real macro hedge fund (Norwalk, CT). Slug
-- "grahamcapitalmanagement", 10 postings, company_name "Graham Capital
-- Management, L.P." (exact). Offices Norwalk/New York/London match.
--
-- GSA Capital: real UK-based quantitative trading firm. Slug "gsacapital",
-- 9 postings, company_name "GSA" (short form -- confirmed via sampled
-- application URL resolving to www.gsacapital.com/careers/gh/... , the
-- company's own domain). Offices London/New York match.
--
-- Simplex Trading: real Chicago-based options trading firm. Slug
-- "simplextrading", 5 postings, company_name "Simplex Trading" (exact).
-- Titles (Algorithmic Trader, Volatility Trader, FPGA Engineer) and
-- Chicago-only offices match.
--
-- Geneva Trading: real Chicago-based proprietary trading firm. Slug
-- "genevatrading", 12 postings, company_name "Geneva Trading" (exact).
-- Genevatrading.com's own careers page directly embeds this Greenhouse
-- job board (confirmed via page-source fetch, same class of confirmation
-- used for SoundCloud/XTX Markets/Hudson River Trading in prior passes).
--
-- Ripple: real blockchain/crypto payments company. Slug "ripple", 128
-- postings, company_name "Ripple" (exact), application URLs resolve to
-- ripple.com/careers/all-jobs/job/... (own domain). Offices New York/
-- London/Toronto/Chicago match.
--
-- Toast: real publicly-traded restaurant point-of-sale fintech (NYSE:
-- TOST). Slug "toast", 301 postings, company_name "Toast" (exact),
-- application URLs resolve to careers.toasttab.com (Toast's own domain).
--
-- BILL (Bill.com): real publicly-traded B2B payments fintech (NYSE:
-- BILL). Slug "billcom", 48 postings, company_name "BILL" (exact real
-- brand name), application URLs resolve to www.bill.com/job?... (own
-- domain).
--
-- Melio: real B2B payments fintech. Slug "melio", 22 postings,
-- company_name "Melio" (exact). Titles reference the company's real
-- Accounts-Payable product ("Engineering Manager, AP"); offices Tel Aviv/
-- New York City match the real company's known dual HQ.
--
-- Payoneer: real publicly-traded cross-border payments fintech (NASDAQ:
-- PAYO). Slug "payoneer", 121 postings, company_name "Payoneer" (exact),
-- application URLs resolve to www.payoneer.com/careers/position/...
-- (own domain).
--
-- Justworks: real publicly-traded HR/PEO platform (NASDAQ: JW). Slug
-- "justworks", 102 postings, company_name "Justworks" (exact). New York
-- HQ plus remote-US offices match.
--
-- AlphaSights: real expert-network/investment-research firm. Slug
-- "alphasights", 82 postings, company_name "AlphaSights" (exact),
-- application URLs resolve to www.alphasights.com/careers/open-roles
-- (own domain). Adjacent to Third Bridge/Guidepoint (Third Bridge added
-- in this same pass, Guidepoint already live).
--
-- Third Bridge: real expert-network/investment-research firm, same
-- cluster as AlphaSights. Slug "thirdbridge" (EU-hosted board,
-- job-boards.eu.greenhouse.io -- same pattern already seen for Baringa
-- Partners), 116 postings, company_name "Third Bridge" (exact). Offices
-- London/Shanghai/New York match.
--
-- ICONIQ (Iconiq Capital): real venture capital/wealth-management firm
-- serving tech founders and executives -- the PE/AM/VC vertical alongside
-- General Atlantic/General Catalyst/Bessemer Venture Partners (already
-- live). Slug "iconiq", 22 postings, company_name "ICONIQ" (exact real
-- short brand). Titles reference the firm's own real internal team
-- ("Associate, Network Intelligence" -- ICONIQ Studio's actual "Network
-- Intelligence & Engagement" pillar, independently confirmed via web
-- search) and its real Financial Advisory wealth-management business;
-- offices San Francisco/New York match. iconiq.com/careers is confirmed
-- (via web search) to be the real company's own careers page linking to
-- this exact board.
--
-- Coalition, Inc.: real cyber-insurance company. Slug "coalition", 40
-- postings, company_name "Coalition, Inc." (exact), application URLs
-- resolve to www.coalitioninc.com/job-posting?... (own domain).
--
-- Datadog: real publicly-traded observability/monitoring software company
-- (NASDAQ: DDOG). Slug "datadog", 455 postings, company_name "Datadog"
-- (exact).
--
-- MongoDB: real publicly-traded database software company (NASDAQ: MDB).
-- Slug "mongodb", 404 postings, company_name "MongoDB" (exact).
--
-- Okta: real publicly-traded identity/security software company (NASDAQ:
-- OKTA). Slug "okta", 344 postings, company_name "Okta" (exact).
--
-- Asana: real publicly-traded work-management SaaS company (NYSE: ASAN).
-- Slug "asana", 119 postings, company_name "Asana" (exact).
--
-- Instacart: real publicly-traded grocery-delivery tech company (NASDAQ:
-- CART). Slug "instacart", 117 postings, company_name "Instacart"
-- (exact). Titles are exclusively corporate roles (Sales, Analytics, AI,
-- Marketing) -- the gig-worker "shopper" role has no presence on this
-- board at all, confirming it's corporate-hiring-only.
--
-- Dropbox: real publicly-traded cloud-storage SaaS company (NASDAQ: DBX).
-- Slug "dropbox", 42 postings, company_name "Dropbox" (exact).
--
-- Reddit: real publicly-traded social-media company (NYSE: RDDT). Slug
-- "reddit", 156 postings, company_name "Reddit" (exact).
--
-- Duolingo: real publicly-traded language-learning edtech company
-- (NASDAQ: DUOL). Slug "duolingo", 86 postings, company_name "Duolingo"
-- (exact).
--
-- Pinterest: real publicly-traded social-media company (NYSE: PINS). Slug
-- "pinterest", 208 postings, company_name "Pinterest" (exact).
--
-- Roblox: real publicly-traded gaming platform company (NYSE: RBLX). Slug
-- "roblox", 227 postings, company_name "Roblox" (exact).
--
-- Two Lever hits, verified the same way as Wealthfront/Belvedere Trading
-- (Lever has no self-reported company-name field -- identity rests on
-- hostedUrl/office/content signals instead):
--
-- Palantir: real publicly-traded data-analytics/software company (NYSE:
-- PLTR). Slug "palantir", 309 postings. Every sampled hostedUrl resolves
-- to jobs.lever.co/palantir/..., offices (London, Washington D.C., New
-- York) match, and one posting is titled "American Tech Fellowship" -- a
-- real, distinctly Palantir-run program, confirming identity beyond the
-- slug alone.
--
-- Point B: real management-consulting firm (Seattle-based). Slug
-- "pointb", 9 postings. Every sampled hostedUrl resolves to
-- jobs.lever.co/pointb/..., titles (Associate/Manager, Strategy &
-- Transformation; Consulting - AI & Process Automation) and offices
-- (Seattle, Chicago, Dallas, Phoenix) match the real consulting firm.
--
-- All twenty-six inherit Part 1's white-collar relevance filter
-- (isLikelySeniorRole/isLikelyNonCorporateRole) and Part 2's
-- MAX_ACTIVE_JOBS_PER_COMPANY=30 cap automatically -- no adapter code
-- changes, config-only, same as every addition since the second
-- (Greenhouse) and the Lever-adapter entry (Lever). Verified live rather
-- than assumed (see this doc's dated entry for the actual post-fetch
-- counts and title spot-checks).
insert into sources (name, type, authorization_status, api_available, rate_limits, attribution_required, storage_restrictions, redistribution_restricted, notes, config)
values
  (
    'Graham Capital Management (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/grahamcapitalmanagement/jobs. company_name verified to say "Graham Capital Management, L.P." on every posting; offices Norwalk CT / New York / London match the real macro hedge fund.',
    '{"platform": "greenhouse", "slug": "grahamcapitalmanagement", "company": "Graham Capital Management, L.P."}'::jsonb
  ),
  (
    'GSA Capital (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/gsacapital/jobs. company_name is the short form "GSA" -- confirmed via a sampled application URL resolving to www.gsacapital.com/careers/gh/... (the company''s own domain), same IMC-Trading-style lesson applied proactively. Real UK-based quantitative trading firm.',
    '{"platform": "greenhouse", "slug": "gsacapital", "company": "GSA"}'::jsonb
  ),
  (
    'Simplex Trading (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/simplextrading/jobs. company_name verified to say "Simplex Trading" on every posting; titles (Algorithmic Trader, Volatility Trader, FPGA Engineer) and Chicago-only offices match the real options trading firm.',
    '{"platform": "greenhouse", "slug": "simplextrading", "company": "Simplex Trading"}'::jsonb
  ),
  (
    'Geneva Trading (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/genevatrading/jobs. company_name verified to say "Geneva Trading" on every posting; genevatrading.com''s own careers page directly embeds this exact Greenhouse board (confirmed via page-source fetch).',
    '{"platform": "greenhouse", "slug": "genevatrading", "company": "Geneva Trading"}'::jsonb
  ),
  (
    'Ripple (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/ripple/jobs. company_name verified to say "Ripple" on every posting; application URLs resolve to ripple.com/careers/all-jobs/job/... (own domain). Real blockchain/crypto payments company.',
    '{"platform": "greenhouse", "slug": "ripple", "company": "Ripple"}'::jsonb
  ),
  (
    'Toast (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/toast/jobs. company_name verified to say "Toast" on every posting; application URLs resolve to careers.toasttab.com (Toast''s own domain). Real publicly-traded restaurant point-of-sale fintech (NYSE: TOST).',
    '{"platform": "greenhouse", "slug": "toast", "company": "Toast"}'::jsonb
  ),
  (
    'BILL (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/billcom/jobs. company_name is the real brand "BILL" (formerly Bill.com); application URLs resolve to www.bill.com/job?... (own domain). Real publicly-traded B2B payments fintech (NYSE: BILL).',
    '{"platform": "greenhouse", "slug": "billcom", "company": "BILL"}'::jsonb
  ),
  (
    'Melio (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/melio/jobs. company_name verified to say "Melio" on every posting; titles reference the real Accounts-Payable product ("Engineering Manager, AP"), offices Tel Aviv / New York City match the real company''s known dual HQ. Real B2B payments fintech.',
    '{"platform": "greenhouse", "slug": "melio", "company": "Melio"}'::jsonb
  ),
  (
    'Payoneer (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/payoneer/jobs. company_name verified to say "Payoneer" on every posting; application URLs resolve to www.payoneer.com/careers/position/... (own domain). Real publicly-traded cross-border payments fintech (NASDAQ: PAYO).',
    '{"platform": "greenhouse", "slug": "payoneer", "company": "Payoneer"}'::jsonb
  ),
  (
    'Justworks (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/justworks/jobs. company_name verified to say "Justworks" on every posting; New York HQ plus remote-US offices match. Real publicly-traded HR/PEO platform (NASDAQ: JW).',
    '{"platform": "greenhouse", "slug": "justworks", "company": "Justworks"}'::jsonb
  ),
  (
    'AlphaSights (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/alphasights/jobs. company_name verified to say "AlphaSights" on every posting; application URLs resolve to www.alphasights.com/careers/open-roles (own domain). Real expert-network/investment-research firm.',
    '{"platform": "greenhouse", "slug": "alphasights", "company": "AlphaSights"}'::jsonb
  ),
  (
    'Third Bridge (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/thirdbridge/jobs (EU-hosted board, job-boards.eu.greenhouse.io -- same pattern as Baringa Partners). company_name verified to say "Third Bridge" on every posting; offices London/Shanghai/New York match. Real expert-network/investment-research firm, same cluster as AlphaSights.',
    '{"platform": "greenhouse", "slug": "thirdbridge", "company": "Third Bridge"}'::jsonb
  ),
  (
    'ICONIQ (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/iconiq/jobs. company_name is the real short brand "ICONIQ" (Iconiq Capital); titles reference the firm''s own real "Network Intelligence" team and Financial Advisory wealth-management business, independently confirmed via web search, which also confirmed iconiq.com/careers is the real company''s own careers page linking to this exact board. Offices San Francisco/New York match. Real venture capital/wealth-management firm.',
    '{"platform": "greenhouse", "slug": "iconiq", "company": "ICONIQ"}'::jsonb
  ),
  (
    'Coalition, Inc. (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/coalition/jobs. company_name verified to say "Coalition, Inc." on every posting; application URLs resolve to www.coalitioninc.com/job-posting?... (own domain). Real cyber-insurance company.',
    '{"platform": "greenhouse", "slug": "coalition", "company": "Coalition, Inc."}'::jsonb
  ),
  (
    'Datadog (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/datadog/jobs. company_name verified to say "Datadog" on every posting. Real publicly-traded observability/monitoring software company (NASDAQ: DDOG).',
    '{"platform": "greenhouse", "slug": "datadog", "company": "Datadog"}'::jsonb
  ),
  (
    'MongoDB (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/mongodb/jobs. company_name verified to say "MongoDB" on every posting. Real publicly-traded database software company (NASDAQ: MDB).',
    '{"platform": "greenhouse", "slug": "mongodb", "company": "MongoDB"}'::jsonb
  ),
  (
    'Okta (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/okta/jobs. company_name verified to say "Okta" on every posting. Real publicly-traded identity/security software company (NASDAQ: OKTA).',
    '{"platform": "greenhouse", "slug": "okta", "company": "Okta"}'::jsonb
  ),
  (
    'Asana (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/asana/jobs. company_name verified to say "Asana" on every posting. Real publicly-traded work-management SaaS company (NYSE: ASAN).',
    '{"platform": "greenhouse", "slug": "asana", "company": "Asana"}'::jsonb
  ),
  (
    'Instacart (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/instacart/jobs. company_name verified to say "Instacart" on every posting; titles are exclusively corporate roles (Sales, Analytics, AI, Marketing) with no gig-worker "shopper" postings present. Real publicly-traded grocery-delivery tech company (NASDAQ: CART).',
    '{"platform": "greenhouse", "slug": "instacart", "company": "Instacart"}'::jsonb
  ),
  (
    'Dropbox (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/dropbox/jobs. company_name verified to say "Dropbox" on every posting. Real publicly-traded cloud-storage SaaS company (NASDAQ: DBX).',
    '{"platform": "greenhouse", "slug": "dropbox", "company": "Dropbox"}'::jsonb
  ),
  (
    'Reddit (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/reddit/jobs. company_name verified to say "Reddit" on every posting. Real publicly-traded social-media company (NYSE: RDDT).',
    '{"platform": "greenhouse", "slug": "reddit", "company": "Reddit"}'::jsonb
  ),
  (
    'Duolingo (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/duolingo/jobs. company_name verified to say "Duolingo" on every posting. Real publicly-traded language-learning edtech company (NASDAQ: DUOL).',
    '{"platform": "greenhouse", "slug": "duolingo", "company": "Duolingo"}'::jsonb
  ),
  (
    'Pinterest (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/pinterest/jobs. company_name verified to say "Pinterest" on every posting. Real publicly-traded social-media company (NYSE: PINS).',
    '{"platform": "greenhouse", "slug": "pinterest", "company": "Pinterest"}'::jsonb
  ),
  (
    'Roblox (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/roblox/jobs. company_name verified to say "Roblox" on every posting. Real publicly-traded gaming platform company (NYSE: RBLX).',
    '{"platform": "greenhouse", "slug": "roblox", "company": "Roblox"}'::jsonb
  ),
  (
    'Palantir (Lever Postings API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other configured Lever company.',
    false,
    'Do not store full job description text -- same policy as every ATS source in this app.',
    false,
    'Public, unauthenticated Lever Postings API at api.lever.co/v0/postings/palantir. No self-reported company name field exists on a Lever posting -- identity verified instead via every sampled hostedUrl resolving to jobs.lever.co/palantir/..., real offices (London, Washington D.C., New York), and a posting titled "American Tech Fellowship" -- a real, distinctly Palantir-run program. Real publicly-traded data-analytics/software company (NYSE: PLTR). Same runtime identity safeguard and honest slug-reassignment limitation documented for Wealthfront/Belvedere Trading applies here too.',
    '{"platform": "lever", "slug": "palantir", "company": "Palantir"}'::jsonb
  ),
  (
    'Point B (Lever Postings API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other configured Lever company.',
    false,
    'Do not store full job description text -- same policy as every ATS source in this app.',
    false,
    'Public, unauthenticated Lever Postings API at api.lever.co/v0/postings/pointb. No self-reported company name field exists on a Lever posting -- identity verified instead via every sampled hostedUrl resolving to jobs.lever.co/pointb/..., titles (Associate/Manager, Strategy & Transformation; Consulting - AI & Process Automation) and offices (Seattle, Chicago, Dallas, Phoenix) matching the real management-consulting firm. Same runtime identity safeguard and honest limitation as Wealthfront/Belvedere Trading/Palantir above.',
    '{"platform": "lever", "slug": "pointb", "company": "Point B"}'::jsonb
  );
