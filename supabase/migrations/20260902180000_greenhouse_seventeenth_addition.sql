-- Seventeenth addition: seventeen more Greenhouse companies (two
-- candidates originally checked here, Checkr and Rent the Runway, turned
-- out to already be live sources from an earlier pass -- caught by
-- `supabase db push`'s own unique-name constraint, not re-added). Continues
-- the big-name-first direction the Twelfth-through-Sixteenth additions
-- started (standing user direction, direct quote: "I want to get big name
-- companies first. I've never heard of Marqeta."). Anchorage Digital and
-- e.l.f. Beauty (Lever) are this same pass's two other hits -- a separate
-- migration alongside the fetch-lever-companies adapter.
--
-- Confirmed the live starting count via direct Postgres query first (136
-- Greenhouse + 8 Lever + 1 Deloitte RSS approved company sources, matching
-- the Sixteenth addition's own closing figure of 145 total), then read
-- every prior dated entry in JOB_ENGINE_ARCHITECTURE.md Part 7 (Sixth
-- through Sixteenth additions) to compile the roster of 200+ companies
-- already added or checked-and-rejected across sixteen prior passes, so
-- nothing here re-checked settled ground.
--
-- ~38 candidates checked, spanning verticals the task brief flagged as
-- underexplored: energy/utilities, agriculture/food production,
-- chemicals/industrials, construction/engineering, staffing/HR tech, legal
-- tech, marketing/advertising agencies/adtech, semiconductor equipment, EV
-- charging/clean energy, space/satellite beyond SpaceX/Rocket Lab,
-- robotics beyond Zoox, crypto/web3 exchanges beyond
-- Coinbase/Gemini/Kraken/Circle/Ripple, sports betting beyond
-- FanDuel/DraftKings, luxury/beauty beyond Glossier.
--
-- No usable board on any platform: Skydio, Firefly Aerospace, Varda Space
-- Industries, Enphase Energy, Sunrun, QuantumScape, Procore Technologies,
-- Rippling, Deel, Harvey AI, Ironclad, Criteo, Impossible Foods, Bowery
-- Farming, Ulta Beauty, Coty, Penn Entertainment, Caesars Sportsbook,
-- PointsBet, Allbirds, Chainalysis, OpenSea, Applied Materials, Lam
-- Research, KLA Corporation, Cruise -- extending the now-well-established
-- "legacy/traditional-industry and Fortune-500-scale companies run Workday
-- or nothing checkable" pattern into semiconductor equipment, legacy
-- energy, and traditional agencies/agtech; a genuine miss for a handful of
-- famous newer-economy names too (Harvey AI, Ironclad, Rippling, Deel,
-- Skydio all real high-profile companies with simply no public
-- Greenhouse/Lever board found under any plausible slug guess).
--
-- Real-but-empty or identity-mismatched (same slug-squatting risk class the
-- user's own standing warning names -- short/generic-word slugs are the
-- highest-risk category): "bloom" (Lever) resolves but every sampled
-- posting ("Director of Brand & Social | Poppy & Peonies", remote
-- gifting/e-commerce roles) is an unrelated flower/gifting brand, not Bloom
-- Energy -- excluded. "beyond" (Greenhouse, company_name "Beyond")
-- resolves but every sampled posting is Barcelona/Spain-based SaaS pricing
-- roles, not Beyond Meat (real HQ El Segundo, CA) -- excluded. "axiom"
-- (Greenhouse, company_name "Axiom") resolves with legal-staffing titles
-- (Contracts Counsel, Corporate Controller) consistent with Axiom Law, a
-- real but different company than the intended target Axiom Space --
-- excluded, not independently pursued as Axiom Law in its own right since
-- it wasn't the candidate this pass set out to verify (same precedent as
-- Coleman Research/Co-Star Astrology). "indigo" (Greenhouse, company_name
-- "Indigo") resolves for the intended target Indigo Ag but with only 2
-- total postings and a bare-word slug too thin to independently confirm
-- identity beyond the name match alone -- excluded on the same rigor bar
-- as Coleman Research, not worth the residual risk for 2 postings.
--
-- Seventeen real Greenhouse hits, each identity-verified the same way as
-- every prior addition -- company_name exact match, plus sampled
-- application URLs, office footprints, or self-referencing job content,
-- never a slug guess alone. A local pure-JS estimate against the exact
-- SENIOR_TITLE_PATTERN/MANUAL_TRADE_TITLE_PATTERN/CLINICAL_CARE_TITLE_
-- PATTERN regexes in server/src/relevance.ts was run against every live
-- posting for all seventeen before writing this migration:
--
-- Figure AI: real, extremely high-profile humanoid-robotics company
-- (~$39B valuation). Greenhouse slug "figureai" (the bare "figure" slug is
-- a different company, company_name "Figure Lending" -- excluded, same
-- slug-collision risk class as Axiom/Bloom/Beyond above), 112 postings,
-- company_name "Figure" (short form). San Jose, CA locations and titles
-- ("AI Training Infrastructure Engineer -- Humanoid Whole Body Control",
-- "Apprentice Robot Service Technician") confirm the real humanoid-robot
-- company. 95 of 112 sampled titles survive the relevance filter locally.
--
-- Planet Labs: real publicly-traded (NYSE: PL) satellite-imagery company.
-- Greenhouse slug "planetlabs", 114 postings, company_name "Planet" (the
-- brand's own short form). "Account Executive, Defence & Intelligence"
-- titles across many countries match Planet's real government/defense
-- customer base. 59 of 114 sampled titles survive the relevance filter
-- locally.
--
-- Relativity Space: real 3D-printed-rocket aerospace company, well known
-- in the space industry. Greenhouse slug "relativity" (not
-- "relativityspace"), 342 postings, company_name "Relativity Space"
-- (exact). Long Beach, CA locations match the real company's actual HQ
-- exactly ("Additive Manufacturing Engineer II, PBF", "AI/ML Scientist,
-- Planetary Science"). 143 of 342 sampled titles survive the relevance
-- filter locally (49 trip the manual-trade denylist -- real
-- manufacturing-technician roles, not Carvana-scale dominant).
--
-- Redwood Materials: real battery-recycling/materials company founded by
-- JB Straubel (Tesla co-founder), well covered in cleantech press.
-- Greenhouse slug "redwoodmaterials", 145 postings, company_name exact.
-- McCarran/Carson City, NV locations match the real company's actual
-- Nevada facility. 83 of 145 sampled titles survive the relevance filter
-- locally; composition leans manufacturing/technician-heavy (20 trip the
-- manual-trade denylist -- Electrician, Chemical Operator, Maintenance
-- Technician are common) alongside a genuine substantial corporate cohort
-- (Senior Software Engineer, Data Engineering Manager, Director of
-- Marketing, Global Supply Chain Analyst, Senior HR Business Partner) --
-- worth flagging honestly rather than implying an all-corporate board,
-- same class of note as Rocket Lab/Sweetgreen.
--
-- ChargePoint: real publicly-traded (NYSE: CHPT) EV-charging-network
-- company, one of the most recognized consumer/fleet EV charging brands in
-- the US. Greenhouse slug "chargepoint", 31 postings, company_name exact.
-- Campbell, CA location matches the real company's actual HQ. 12 of 31
-- sampled titles survive the relevance filter locally.
--
-- The Trade Desk: real publicly-traded (NASDAQ: TTD) programmatic
-- advertising company, one of the best-known names in adtech. Greenhouse
-- slug "thetradedesk", 177 postings, company_name exact. 54 of 177 sampled
-- titles survive the relevance filter locally.
--
-- AppLovin: real publicly-traded (NASDAQ: APP) mobile-advertising company,
-- ~$100B+ market cap, now widely recognized. Greenhouse slug "applovin",
-- 35 postings, company_name exact. 29 of 35 sampled titles survive the
-- relevance filter locally.
--
-- Amplitude: real publicly-traded (NASDAQ: AMPL) product-analytics
-- company. Greenhouse slug "amplitude", 36 postings, company_name exact.
-- San Francisco, CA locations match the real company's actual HQ. 13 of 36
-- sampled titles survive the relevance filter locally.
--
-- DoubleVerify: real publicly-traded (NYSE: DV) ad-verification/adtech
-- company. Greenhouse slug "doubleverify", 29 postings, company_name
-- exact. "NYC Global HQ" appears directly in sampled locations, matching
-- the real company's actual HQ. 9 of 29 sampled titles survive the
-- relevance filter locally.
--
-- Attentive: real, well-funded ($multi-billion) marketing-technology
-- unicorn (SMS/email marketing platform). Greenhouse slug "attentive", 37
-- postings, company_name exact. New York, NY locations match the real
-- company's actual HQ. 17 of 37 sampled titles survive the relevance
-- filter locally.
--
-- Everlaw: real legal-technology (e-discovery/litigation) company, the one
-- real hit found in this pass's legal-tech vertical (Harvey AI and
-- Ironclad both had no usable board). Greenhouse slug "everlaw", 31
-- postings, company_name exact. Oakland, CA locations match the real
-- company's actual HQ. 17 of 31 sampled titles survive the relevance
-- filter locally.
--
-- Checkr: real HR-tech (background-check) unicorn. Greenhouse slug
-- "checkr", 45 postings, company_name exact. San Francisco, CA locations
-- match the real company's actual HQ. 21 of 45 sampled titles survive the
-- relevance filter locally.
--
-- Culture Amp: real HR-tech (employee-engagement/People analytics)
-- company. Greenhouse slug "cultureamp", 42 postings, company_name exact.
-- Melbourne/Sydney, Australia locations match the real company's actual
-- HQ. 25 of 42 sampled titles survive the relevance filter locally.
--
-- Fireblocks: real crypto-custody/infrastructure company (~$8B
-- valuation), well known in crypto/fintech circles. Greenhouse slug
-- "fireblocks", 70 postings, company_name exact. Titles reference "Crypto
-- Services" directly. 35 of 70 sampled titles survive the relevance filter
-- locally.
--
-- Consensys: real blockchain company, creator of MetaMask -- one of the
-- best-known names in crypto/web3. Greenhouse slug "consensys", 6
-- postings, company_name exact. One posting explicitly titled "Senior
-- Design Engineer - MetaMask" directly confirms identity. Small board: 1
-- of 6 sampled titles survives the relevance filter locally, added anyway
-- per the same small-but-real-and-famous precedent as SeatGeek (6/20)/
-- StubHub (8/17) in the Sixteenth addition.
--
-- Rent the Runway: real publicly-traded (NASDAQ: RENT) fashion-rental
-- e-commerce company, a widely recognized consumer brand. Greenhouse slug
-- "renttherunway", 23 postings, company_name exact. Sampled locations
-- literally read "Brooklyn, NY (Rent the Runway HQ)" -- the strongest
-- possible location confirmation. 12 of 23 sampled titles survive the
-- relevance filter locally.
--
-- Astranis: real small-satellite company, growing recognition in the space
-- industry. Greenhouse slug "astranis", 81 postings, company_name exact.
-- San Francisco, CA locations match the real company's actual HQ. 54 of
-- 81 sampled titles survive the relevance filter locally.
--
-- Nuro: real autonomous-delivery-vehicle company backed by SoftBank, well
-- known in the AV space. Greenhouse slug "nuro", 110 postings,
-- company_name exact. "Mountain View, California (HQ)" appears directly in
-- sampled locations, matching the real company's actual HQ. 55 of 110
-- sampled titles survive the relevance filter locally -- strong
-- software/ML-engineering composition, alongside Autonomous Vehicle
-- Operator/Fleet Technician roles correctly denylisted as manual-trade (4
-- hits).
--
-- Agility Robotics: real humanoid-robotics company (maker of the "Digit"
-- robot), well known in robotics circles. Greenhouse slug
-- "agilityrobotics", 68 postings, company_name exact. Salem, OR location
-- matches the real company's actual HQ. 14 of 68 sampled titles survive
-- the relevance filter locally.
--
-- None of these seventeen match a NAMED_COMPANY_RATES entry in
-- data/industryBaseRates.js (MBB / bulge-bracket IB / elite quant trading
-- / elite big tech) -- all fall through to that module's broader
-- industry-tier fallback, same as most of this app's real sources today.
--
-- All seventeen inherit Part 1's white-collar relevance filter
-- (isLikelySeniorRole/isLikelyNonCorporateRole) and Part 2's
-- MAX_ACTIVE_JOBS_PER_COMPANY=30 cap automatically -- no adapter code
-- changes, config-only, same as every Greenhouse addition since the
-- second.
insert into sources (name, type, authorization_status, api_available, rate_limits, attribution_required, storage_restrictions, redistribution_restricted, notes, config)
values
  (
    'Figure AI (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/figureai/jobs -- the bare "figure" slug is a different company (company_name "Figure Lending"), excluded. company_name verified to say "Figure" (short form). San Jose, CA locations and humanoid-robotics-specific titles ("AI Training Infrastructure Engineer -- Humanoid Whole Body Control", "Apprentice Robot Service Technician") confirm the real high-profile humanoid-robotics company. 95 of 112 sampled titles survive the white-collar relevance filter locally; will be capped to 30 active.',
    '{"platform": "greenhouse", "slug": "figureai", "company": "Figure"}'::jsonb
  ),
  (
    'Planet Labs (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/planetlabs/jobs. company_name verified to say "Planet" (the real company''s own short brand form). "Account Executive, Defence & Intelligence" titles across many countries match Planet''s real government/defense customer base. Real publicly-traded (NYSE: PL) satellite-imagery company. 59 of 114 sampled titles survive the relevance filter locally.',
    '{"platform": "greenhouse", "slug": "planetlabs", "company": "Planet"}'::jsonb
  ),
  (
    'Relativity Space (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/relativity/jobs -- not "relativityspace". company_name verified to say "Relativity Space" (exact). Long Beach, CA locations match the real company''s actual HQ exactly. Real 3D-printed-rocket aerospace company. 143 of 342 sampled titles survive the relevance filter locally (49 correctly denylisted as manual-trade/manufacturing-technician roles, not Carvana-scale dominant); will be capped to 30 active.',
    '{"platform": "greenhouse", "slug": "relativity", "company": "Relativity Space"}'::jsonb
  ),
  (
    'Redwood Materials (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/redwoodmaterials/jobs. company_name verified to say "Redwood Materials" (exact). McCarran/Carson City, NV locations match the real company''s actual Nevada facility. Real battery-recycling company founded by JB Straubel (Tesla co-founder). 83 of 145 sampled titles survive the relevance filter locally, but the composition leans manufacturing/technician-heavy (20 correctly denylisted as manual-trade -- Electrician, Chemical Operator, Maintenance Technician) alongside a genuine substantial corporate cohort (Senior Software Engineer, Data Engineering Manager, Director of Marketing, Senior HR Business Partner) -- worth noting honestly rather than implying an all-corporate board; will be capped to 30 active.',
    '{"platform": "greenhouse", "slug": "redwoodmaterials", "company": "Redwood Materials"}'::jsonb
  ),
  (
    'ChargePoint (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/chargepoint/jobs. company_name verified to say "ChargePoint" (exact). Campbell, CA location matches the real company''s actual HQ. Real publicly-traded (NYSE: CHPT) EV-charging-network company, one of the most recognized EV charging brands in the US. 12 of 31 sampled titles survive the relevance filter locally.',
    '{"platform": "greenhouse", "slug": "chargepoint", "company": "ChargePoint"}'::jsonb
  ),
  (
    'The Trade Desk (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/thetradedesk/jobs. company_name verified to say "The Trade Desk" (exact). Real publicly-traded (NASDAQ: TTD) programmatic-advertising company, one of the best-known names in adtech. 54 of 177 sampled titles survive the relevance filter locally; will be capped to 30 active.',
    '{"platform": "greenhouse", "slug": "thetradedesk", "company": "The Trade Desk"}'::jsonb
  ),
  (
    'AppLovin (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/applovin/jobs. company_name verified to say "AppLovin" (exact). Real publicly-traded (NASDAQ: APP) mobile-advertising company, ~$100B+ market cap, now widely recognized. 29 of 35 sampled titles survive the relevance filter locally.',
    '{"platform": "greenhouse", "slug": "applovin", "company": "AppLovin"}'::jsonb
  ),
  (
    'Amplitude (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/amplitude/jobs. company_name verified to say "Amplitude" (exact). San Francisco, CA locations match the real company''s actual HQ. Real publicly-traded (NASDAQ: AMPL) product-analytics company. 13 of 36 sampled titles survive the relevance filter locally.',
    '{"platform": "greenhouse", "slug": "amplitude", "company": "Amplitude"}'::jsonb
  ),
  (
    'DoubleVerify (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/doubleverify/jobs. company_name verified to say "DoubleVerify" (exact). "NYC Global HQ" appears directly in sampled locations, matching the real company''s actual HQ. Real publicly-traded (NYSE: DV) ad-verification/adtech company. 9 of 29 sampled titles survive the relevance filter locally.',
    '{"platform": "greenhouse", "slug": "doubleverify", "company": "DoubleVerify"}'::jsonb
  ),
  (
    'Attentive (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/attentive/jobs. company_name verified to say "Attentive" (exact). New York, NY locations match the real company''s actual HQ. Real, well-funded marketing-technology (SMS/email marketing) unicorn. 17 of 37 sampled titles survive the relevance filter locally.',
    '{"platform": "greenhouse", "slug": "attentive", "company": "Attentive"}'::jsonb
  ),
  (
    'Everlaw (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/everlaw/jobs. company_name verified to say "Everlaw" (exact). Oakland, CA locations match the real company''s actual HQ. Real legal-technology (e-discovery/litigation) company -- the one real hit in this pass''s legal-tech vertical (Harvey AI, Ironclad had no usable board). 17 of 31 sampled titles survive the relevance filter locally.',
    '{"platform": "greenhouse", "slug": "everlaw", "company": "Everlaw"}'::jsonb
  ),
  (
    'Culture Amp (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/cultureamp/jobs. company_name verified to say "Culture Amp" (exact). Melbourne/Sydney, Australia locations match the real company''s actual HQ. Real HR-tech (employee-engagement/People analytics) company. 25 of 42 sampled titles survive the relevance filter locally.',
    '{"platform": "greenhouse", "slug": "cultureamp", "company": "Culture Amp"}'::jsonb
  ),
  (
    'Fireblocks (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/fireblocks/jobs. company_name verified to say "Fireblocks" (exact). Titles reference "Crypto Services" directly. Real crypto-custody/infrastructure company (~$8B valuation), well known in crypto/fintech circles. 35 of 70 sampled titles survive the relevance filter locally.',
    '{"platform": "greenhouse", "slug": "fireblocks", "company": "Fireblocks"}'::jsonb
  ),
  (
    'Consensys (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/consensys/jobs. company_name verified to say "Consensys" (exact); one posting explicitly titled "Senior Design Engineer - MetaMask" directly confirms identity (Consensys is MetaMask''s creator). Real blockchain company, one of the best-known names in crypto/web3. Small board: 1 of 6 sampled titles survives the relevance filter locally -- added anyway per the same small-but-real-and-famous precedent as SeatGeek (6/20)/StubHub (8/17) from the Sixteenth addition.',
    '{"platform": "greenhouse", "slug": "consensys", "company": "Consensys"}'::jsonb
  ),
  (
    'Astranis (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/astranis/jobs. company_name verified to say "Astranis" (exact). San Francisco, CA locations match the real company''s actual HQ. Real small-satellite company, growing recognition in the space industry. 54 of 81 sampled titles survive the relevance filter locally.',
    '{"platform": "greenhouse", "slug": "astranis", "company": "Astranis"}'::jsonb
  ),
  (
    'Nuro (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/nuro/jobs. company_name verified to say "Nuro" (exact); "Mountain View, California (HQ)" appears directly in sampled locations, matching the real company''s actual HQ. Real autonomous-delivery-vehicle company backed by SoftBank, well known in the AV space. 55 of 110 sampled titles survive the relevance filter locally -- strong software/ML-engineering composition, alongside Autonomous Vehicle Operator/Fleet Technician roles correctly denylisted as manual-trade.',
    '{"platform": "greenhouse", "slug": "nuro", "company": "Nuro"}'::jsonb
  ),
  (
    'Agility Robotics (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/agilityrobotics/jobs. company_name verified to say "Agility Robotics" (exact). Salem, OR location matches the real company''s actual HQ. Real humanoid-robotics company (maker of the "Digit" robot), well known in robotics circles. 14 of 68 sampled titles survive the relevance filter locally.',
    '{"platform": "greenhouse", "slug": "agilityrobotics", "company": "Agility Robotics"}'::jsonb
  );
