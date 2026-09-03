-- Sixteenth addition: five more Greenhouse companies (Anduril Industries,
-- Rocket Lab, SeatGeek, StubHub, Sweetgreen). Continues the big-name-first
-- direction the Twelfth/Thirteenth/Fourteenth/Fifteenth additions started
-- (direct user quote: "I want to get big name companies first. I've never
-- heard of Marqeta."). Zoox (Lever) is this same pass's sixth hit -- a
-- separate migration alongside the fetch-lever-companies adapter.
--
-- Confirmed the live starting count via direct Postgres query first (131
-- Greenhouse + 7 Lever approved sources), then read every prior dated
-- entry in JOB_ENGINE_ARCHITECTURE.md Part 7 (Sixth through Fifteenth
-- additions) to compile the full roster of 200+ companies already added
-- or checked-and-rejected across fifteen prior passes, so nothing here
-- re-checks settled ground.
--
-- Candidates checked (~34 total) spanning verticals the task brief
-- flagged as underexplored: airlines/hospitality, insurance,
-- semiconductor/hardware, biotech/pharma, defense/aerospace, real
-- estate/proptech, food & beverage, telecom, automotive/mobility,
-- sports/media, fashion/retail, financial data/market infrastructure.
-- No usable board on any platform: Aurora Innovation, Polestar, AMD, Arm
-- Holdings, Garmin, Chipotle Mexican Grill, TKO Group Holdings, Warby
-- Parker, Chewy, Wayfair, Etsy, FactSet, Morningstar, Intercontinental
-- Exchange, Chubb, Alaska Airlines, JetBlue Airways, Royal Caribbean
-- Group, Vail Resorts (confirming the now well-established pattern that
-- most legacy Fortune-500-scale and mid-size traditional-industry
-- companies run Workday or nothing checkable at all, extending it
-- cleanly into airlines/insurance/retail/hardware verticals not yet
-- deeply tested). Workday-hint-only (not buildable, same class as every
-- prior Workday-only finding): Micron Technology, Vertex Pharmaceuticals,
-- Gilead Sciences, 23andMe, Nasdaq Inc, CME Group, Live Nation
-- Entertainment.
--
-- One identity rejection worth recording: "CoStar Group" -- Greenhouse
-- slug "costar" resolves (8 postings, company_name "Co-Star"), but every
-- sampled posting (Brand Designer, Haskell Developer, Product Designer,
-- all New York-based) and direct page-source confirmation
-- (costarastrology.com self-reference) identify this as Co-Star
-- Astrology, an unrelated NYC-based astrology app -- not the real
-- Washington DC-area commercial real-estate data giant CoStar Group
-- (NASDAQ: CSGP). Same slug-collision pattern already caught for "bcg"/
-- Disney/Capital One/Aura/Wise/Current/Founders Fund/Thrive
-- Capital/Anchorage Capital Group/Charles Schwab/MetLife/Blue Apron.
-- Excluded.
--
-- Five real Greenhouse hits, each identity-verified the same way as every
-- prior addition -- company_name exact match, plus sampled application
-- URLs, office footprints, or self-referencing job content, never a slug
-- guess alone. A local pure-JS estimate against the exact
-- SENIOR_TITLE_PATTERN/MANUAL_TRADE_TITLE_PATTERN/CLINICAL_CARE_TITLE_
-- PATTERN regexes in server/src/relevance.ts was run against every live
-- posting for all five before writing this migration:
--
-- Anduril Industries: real defense-tech company (autonomous weapons
-- systems, drones; founded by Palmer Luckey), extremely high-profile.
-- Greenhouse slug "andurilindustries" (the plain "anduril" guess is not
-- the hit -- legal-name-style token, same technique as Wiz/Fanatics/
-- Tenable), 2,207 postings -- the second-largest board this app has ever
-- added after SpaceX's 2,255. company_name "Anduril Industries" (exact).
-- Office footprint (Costa Mesa CA -- real HQ, Fort Collins CO, Colorado
-- Springs CO, Atlanta GA, Seattle WA) matches Anduril's real known
-- locations exactly. 1,081 of 2,207 sampled titles survive the relevance
-- filter locally (2026/2027 Early Career Electrical/Mechanical/Software
-- Engineer roles heavily represented); will be capped to 30 active.
--
-- Rocket Lab: real publicly-traded space/launch company (NASDAQ: RKLB).
-- Greenhouse slug "rocketlab" (obvious-guess hit), 452 postings,
-- company_name "Rocket Lab Corporation" (exact). Locations (Long Beach
-- CA, Auckland NZ) match Rocket Lab's real known facilities. Board is
-- manufacturing-heavy (Aerospace Production Technician, A&P Mechanic,
-- Assembly Integration & Test Technician are common) but not
-- Carvana-scale dominant -- only 46 of 452 titles (10%) trip the manual-
-- trade denylist; 180 of 452 survive the relevance filter locally
-- (Additive Manufacturing Engineer, Avionics Design Engineer, Avionics
-- Automation Test Engineer among the white-collar engineering roles kept).
--
-- SeatGeek: real event-ticketing marketplace, a widely recognized
-- consumer brand. Greenhouse slug "seatgeek" (obvious-guess hit), 20
-- postings, company_name "SeatGeek" (exact). Sampled application URLs
-- resolve directly to seatgeek.com/jobs/...?gh_jid=... (own domain),
-- same own-domain-embed tier as Adyen/Klaviyo/Netskope/Wiz. NYC-based
-- roles match SeatGeek's real HQ. Small board: 6 of 20 titles survive the
-- relevance filter locally (Client Success Manager, senior/staff-heavy
-- rest correctly denylisted).
--
-- StubHub: real publicly-traded (NYSE: STUB) live-event ticket resale
-- marketplace, a widely recognized consumer brand. Greenhouse slug
-- "stubhubinc" (the bare "stubhub" guess does not resolve -- legal-
-- name-style token, same technique as Wiz/Fanatics/Anduril above), 17
-- postings, company_name "StubHub" (exact). One posting explicitly
-- references "viagogo - DACH" (StubHub's real European subsidiary
-- brand); Atlanta GA and New York NY offices match StubHub's real known
-- footprint. Small board: 8 of 17 titles survive the relevance filter
-- locally (Associate Product Manager, Product Manager, Engineering
-- Manager among them).
--
-- Sweetgreen: real publicly-traded (NYSE: SG) fast-casual salad chain, a
-- widely recognized consumer brand. Greenhouse slug "sweetgreen"
-- (obvious-guess hit), 56 postings, company_name "sweetgreen" (exact,
-- lowercase matching the brand's own styling). 48 of 56 titles survive
-- the relevance filter locally, but the composition is heavily
-- restaurant-operations titles (Assistant Restaurant Manager, Restaurant
-- General Manager, Assistant Coach, Head Coach -- Sweetgreen's internal
-- term for shift lead) rather than HQ corporate roles -- the same
-- already-established "ambiguous manager/retail-corporate keep zone" this
-- doc has documented for Peloton/Lucid Motors/Glossier/StockX store-level
-- titles (not manual-trade or clinical, so correctly not denylisted, but
-- worth flagging honestly rather than implying an HQ-heavy board). A
-- genuine minority of real corporate roles exists too (Manager Talent
-- Acquisition, Quality Assurance Specialist, Recruiter, Tax Manager,
-- Risks & Claims Manager).
--
-- None of these five match a NAMED_COMPANY_RATES entry in
-- data/industryBaseRates.js (MBB / bulge-bracket IB / elite quant trading
-- / elite big tech) -- all fall through to that module's broader
-- industry-tier fallback, same as most of this app's real sources today.
--
-- All five inherit Part 1's white-collar relevance filter
-- (isLikelySeniorRole/isLikelyNonCorporateRole) and Part 2's
-- MAX_ACTIVE_JOBS_PER_COMPANY=30 cap automatically -- no adapter code
-- changes, config-only, same as every Greenhouse addition since the
-- second.
insert into sources (name, type, authorization_status, api_available, rate_limits, attribution_required, storage_restrictions, redistribution_restricted, notes, config)
values
  (
    'Anduril Industries (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/andurilindustries/jobs -- the plain "anduril" slug is not the real token. company_name verified to say "Anduril Industries" (exact). Office footprint (Costa Mesa CA -- real HQ, Fort Collins CO, Colorado Springs CO, Atlanta GA, Seattle WA) matches. Real high-profile defense-tech company. 1,081 of 2,207 sampled titles survive the white-collar relevance filter locally; will be capped to 30 active.',
    '{"platform": "greenhouse", "slug": "andurilindustries", "company": "Anduril Industries"}'::jsonb
  ),
  (
    'Rocket Lab (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/rocketlab/jobs. company_name verified to say "Rocket Lab Corporation" (exact). Locations (Long Beach CA, Auckland NZ) match. Real publicly-traded space/launch company (NASDAQ: RKLB). Board is manufacturing-technician-heavy (only 10% denylisted as manual-trade, not Carvana-scale); 180 of 452 sampled titles survive the relevance filter locally (engineering roles kept, technician/mechanic roles correctly filtered); will be capped to 30 active.',
    '{"platform": "greenhouse", "slug": "rocketlab", "company": "Rocket Lab Corporation"}'::jsonb
  ),
  (
    'SeatGeek (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/seatgeek/jobs. company_name verified to say "SeatGeek" (exact). Sampled application URLs resolve to seatgeek.com/jobs/...?gh_jid=... (own domain). Real event-ticketing marketplace, widely recognized consumer brand. Small board: 6 of 20 sampled titles survive the relevance filter locally.',
    '{"platform": "greenhouse", "slug": "seatgeek", "company": "SeatGeek"}'::jsonb
  ),
  (
    'StubHub (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/stubhubinc/jobs -- the bare "stubhub" slug does not resolve; this is the real token. company_name verified to say "StubHub" (exact). One posting references "viagogo - DACH" (StubHub''s real European subsidiary brand); Atlanta GA/New York NY offices match. Real publicly-traded (NYSE: STUB) live-event ticket resale marketplace. Small board: 8 of 17 sampled titles survive the relevance filter locally.',
    '{"platform": "greenhouse", "slug": "stubhubinc", "company": "StubHub"}'::jsonb
  ),
  (
    'Sweetgreen (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/sweetgreen/jobs. company_name verified to say "sweetgreen" (exact, lowercase matching the brand''s own styling). Real publicly-traded (NYSE: SG) fast-casual restaurant chain, widely recognized consumer brand. 48 of 56 sampled titles survive the relevance filter locally, but the surviving composition leans heavily restaurant-operations (Assistant Restaurant Manager, Restaurant General Manager, Assistant/Head Coach) rather than HQ-corporate -- same already-documented "ambiguous manager/retail-corporate keep zone" as Peloton/Lucid Motors/Glossier/StockX, not manual-trade or clinical so correctly not denylisted; a genuine minority of real corporate roles (Tax Manager, Recruiter, Quality Assurance Specialist) also present.',
    '{"platform": "greenhouse", "slug": "sweetgreen", "company": "sweetgreen"}'::jsonb
  );
