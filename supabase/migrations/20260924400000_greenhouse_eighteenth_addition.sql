-- Eighteenth addition: two more Greenhouse companies, both real consulting
-- firms -- prioritized per standing direction to check consulting firms
-- first (UC is a consulting club) before broadening to other verticals.
--
-- Confirmed the live starting count via direct Postgres query first (169
-- total approved company sources). Checked ~20 consulting-firm candidates
-- across MBB-adjacent, healthcare/life-sciences, brand/marketing, and
-- restructuring/turnaround consulting against both the Greenhouse and
-- Lever public APIs.
--
-- No usable board on either platform: West Monroe, Slalom, ZS Associates,
-- Guidehouse, Sia Partners, L.E.K. Consulting, Kearney, Protiviti, FTI
-- Consulting, Huron Consulting Group, ICF, Booz Allen Hamilton, Simon-
-- Kucher & Partners, Cornerstone Research, Analysis Group, NERA Economic
-- Consulting, Bridgespan Group, Alvarez & Marsal, Berkeley Research
-- Group, Ankura Consulting, CrossCountry Consulting, GLG, Innosight,
-- Eagle Hill Consulting, Public Consulting Group -- extending the
-- established "elite/traditional consulting firms mostly run proprietary
-- ATS, not Greenhouse/Lever" pattern from prior additions. Accordion,
-- AlixPartners, Baringa, Charles River Associates, Point B, Deloitte,
-- AlphaSights, and Third Bridge were already live sources from earlier
-- passes -- confirmed directly against the sources table before spending
-- any verification effort on them, not re-added.
--
-- One identity rejection: "oliverwyman" (Lever) resolves but is an
-- unrelated small company, not the real Oliver Wyman (Marsh McLennan) --
-- only 2 total postings ("Account Executive"/"Software Engineer", San
-- Francisco, generic SaaS-sales language, dated 2016), no consulting
-- content or NYC/global-firm signal at all. Same slug-squatting risk
-- class every prior addition has flagged for a short/well-known-brand
-- slug. Excluded.
--
-- One real-but-empty board: "stax"/"staxinc" (Lever) both resolve for
-- what appears to be the real Stax Inc (PE-focused strategy consulting)
-- but return zero active postings on either slug -- not worth adding an
-- empty source.
--
-- Two real hits, both identity-verified the same way as every prior
-- addition -- exact company_name match plus sampled office locations and
-- consulting-specific title content, never a slug guess alone. A local
-- pure-JS check against the exact isLikelyNonCorporateRole()
-- (MANUAL_TRADE_TITLE_PATTERN/CLINICAL_CARE_TITLE_PATTERN) logic in
-- server/src/relevance.ts was run against every live posting for both
-- before writing this migration:
--
-- ClearView Healthcare Partners: real healthcare/life-sciences strategy
-- consulting firm (pharma/biotech commercial strategy, market access,
-- launch planning). Greenhouse slug "clearviewhealthcarepartners", 31
-- postings, company_name exact. Newton, MA location matches the real
-- firm's actual HQ; "Consulting Project Team Lead - Pricing & Market
-- Access", "Life Sciences Strategy Consultant", "Consulting Project Team
-- Lead - Corporate Strategy" titles are exactly the real firm's known
-- practice areas. 31 of 31 sampled titles survive the relevance filter
-- locally (100% white-collar, no manual-trade/clinical-care hits) --
-- will be capped to 30 active.
--
-- Prophet: real brand/marketing strategy consulting firm (San Francisco
-- HQ). Greenhouse slug "prophet", 21 postings, company_name exact.
-- Offices sampled (Austin, Chicago, NYC, Atlanta, Zurich, Munich, Berlin,
-- Hong Kong, Shanghai, London) match the real firm's actual global
-- footprint; "2027 Summer Associate - Austin" directly signals real
-- undergraduate campus recruiting, and "Engagement Manager"/"Associate"
-- titles match standard consulting-firm level naming. 21 of 21 sampled
-- titles survive the relevance filter locally.
--
-- Neither matches a NAMED_COMPANY_RATES entry in data/industryBaseRates.js
-- (MBB/bulge-bracket IB/elite quant/elite big tech) -- both fall through
-- to that module's broader industry-tier fallback via their real
-- "Management consulting"-adjacent classification, same as most of this
-- app's real sources today.
--
-- Both inherit Part 1's white-collar relevance filter
-- (isLikelySeniorRole/isLikelyNonCorporateRole) and Part 2's
-- MAX_ACTIVE_JOBS_PER_COMPANY=30 cap automatically -- no adapter code
-- changes, config-only, same as every Greenhouse addition since the
-- second. Total company job-listing sources after this addition: 171.
insert into sources (name, type, authorization_status, api_available, rate_limits, attribution_required, storage_restrictions, redistribution_restricted, notes, config)
values
  (
    'ClearView Healthcare Partners (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/clearviewhealthcarepartners/jobs. company_name verified to say "ClearView Healthcare Partners" (exact). Newton, MA location matches the real firm''s actual HQ. Real healthcare/life-sciences strategy consulting firm -- "Consulting Project Team Lead - Pricing & Market Access", "Life Sciences Strategy Consultant" titles match the real firm''s known practice areas. 31 of 31 sampled titles survive the relevance filter locally (100% white-collar); will be capped to 30 active.',
    '{"platform": "greenhouse", "slug": "clearviewhealthcarepartners", "company": "ClearView Healthcare Partners"}'::jsonb
  ),
  (
    'Prophet (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/prophet/jobs. company_name verified to say "Prophet" (exact). Offices sampled (Austin, Chicago, NYC, Atlanta, Zurich, Munich, Berlin, Hong Kong, Shanghai, London) match the real firm''s actual global footprint. Real brand/marketing strategy consulting firm; "2027 Summer Associate - Austin" directly signals real undergraduate campus recruiting. 21 of 21 sampled titles survive the relevance filter locally.',
    '{"platform": "greenhouse", "slug": "prophet", "company": "Prophet"}'::jsonb
  );
