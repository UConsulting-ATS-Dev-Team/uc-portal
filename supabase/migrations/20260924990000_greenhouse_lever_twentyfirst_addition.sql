-- Twenty-first addition: 3 more companies (Watershed Informatics and
-- Calm.com on Greenhouse, Ro and Patch Media on Lever) -- a healthcare/
-- wellness/consumer-brand batch after the cybersecurity/gaming pass.
--
-- Confirmed the live starting count via direct Postgres query first (173
-- total approved company sources). Checked a healthcare/climate-tech
-- candidate list: Tempus, Flatiron Health, Color, Ro, Hims, Cityblock,
-- Oscar, Devoted Health, Included Health, Ginger, Headspace, Calm, Noom,
-- Carbon, Sunrun, Climeworks, Charm Industrial, Watershed, Patch, Aclima.
--
-- No usable board on either platform: Tempus, Flatiron Health, Color,
-- Hims, Cityblock, Devoted Health, Included Health, Ginger, Headspace,
-- Noom, Sunrun, Climeworks, Charm Industrial, Aclima.
--
-- Already a live source: "oscar" (Greenhouse) resolved to the real Oscar
-- Health -- confirmed already present in the sources table before
-- spending further verification effort on it, not re-added.
--
-- One real hit rejected after applying the actual combined relevance
-- filter (isLikelySeniorRole OR isLikelyNonCorporateRole -- both gates,
-- not just the non-corporate one): "carbon" (Greenhouse) resolves to the
-- real Carbon, Inc. (3D-printing hardware unicorn, Sunnyvale, company_name
-- verified), 13 real postings -- but 0 of 13 survive the combined filter
-- locally (entirely Senior/Director-level hardware/manufacturing
-- engineering roles). Not worth adding a source with nothing to actually
-- show a member. Also rejected: "patch" (Greenhouse) resolves to Patch
-- (childcare staffing -- patchcaregiving.com), 5 postings, all substitute/
-- lead childcare teacher roles -- technically survives the title-keyword
-- filter (no denylist term matches "childcare teacher") but is plainly not
-- the kind of corporate role this app serves; excluded on the same human-
-- judgment basis as prior additions' thin/off-fit exclusions, not a
-- mechanical filter result.
--
-- Four real hits, each identity-verified via company_name plus sampled
-- office locations and title content, and each checked against the actual
-- combined relevance filter (not just eyeballed):
--
-- Watershed Informatics (Greenhouse, slug "watershed"): a genomics/
-- bioinformatics software company in Cambridge, MA -- NOT the well-known
-- climate-tech "Watershed" (carbon accounting SaaS, San Francisco); this
-- is a distinct, smaller real company, confirmed via company_name
-- ("Watershed Informatics", exact) and its real Cambridge/Boston office
-- locations plus bioinformatics-specific title content ("Customer Success
-- Engineer, Bioinformatics", "High Performance Computing Engineer").
-- 7 of 8 sampled titles survive the combined relevance filter locally.
-- Named distinctly in this migration's own source name to avoid any
-- future confusion with the other, more famous Watershed.
--
-- Calm.com (Greenhouse, slug "calm"): the real, well-known meditation/
-- sleep app (unicorn valuation, Calm.com verified as company_name). Very
-- small board -- only 2 total postings, 1 of 2 ("Growth Product Manager")
-- survives the combined relevance filter. Thin, but added per the same
-- small-but-real-and-famous precedent already established (Consensys 1/6,
-- Pacaso 5/5, SeatGeek 6/20) -- a single real, verified posting from a
-- well-known consumer brand is still real signal for a member.
--
-- Ro (Lever, site "ro"): real, well-known telehealth unicorn (parent
-- company of Roman/Rory), New York HQ verified via office locations and
-- company mentions in posting text ("Ro is consistently recognized as a
-- top workplace..."). 52 total postings; 11 of 52 survive the combined
-- relevance filter -- most of the board is pharmacy/fulfillment-operations
-- work at Ro's own dispensing centers (Romeoville, IL; Boynton Beach, FL;
-- Torrance, CA), which is exactly what exposed a real, narrow gap in the
-- shared relevance filter (see below) -- survivors include genuine
-- corporate roles (Analytics Engineer, Engineering Manager, Inventory
-- Allocation Analyst, Technical Lead, Instructional Designer).
--
-- Patch Media (Lever, site "patch"): real hyperlocal news company
-- (patch.com), company_name/posting content verified ("Patch Media is an
-- equal opportunity employer..."). Small board -- 5 postings, 4 of 5
-- survive the combined relevance filter (Account Executive - Local Sales,
-- Ad Ops Associate, 2x Local News Content Producer). Distinct from the
-- childcare "Patch" rejected above -- same bare slug word, two unrelated
-- real companies, verified independently via each platform's own
-- company_name/content rather than assumed from the slug alone.
--
-- Relevance-filter gap fix, applied alongside this batch (not a separate
-- pass): evaluating Ro's real board surfaced "Fulfillment Associate" and
-- "Fulfillment Pharmacist" postings neither denylist pattern caught --
-- real warehouse/dispensing-center roles, not corporate work. Added
-- "fulfillment associates?" (scoped, matching the existing "warehouse"
-- precedent -- not bare "fulfillment", since a legitimate "Fulfillment
-- Manager, Enterprise Ops" title is plausible elsewhere) to
-- MANUAL_TRADE_TITLE_PATTERN, and bare "pharmacists?" (matching the
-- existing bare "nurses?"/"physicians?" precedent) to
-- CLINICAL_CARE_TITLE_PATTERN, in both server/src/relevance.ts and
-- supabase/functions/_shared/pipeline/relevance.ts. Checked against the
-- live jobs table first (zero existing titles contained "pharmacist" or
-- "fulfillment") -- no collision risk with any already-ingested posting.
-- Verified via server/tests/relevance.test.ts (2 new cases: excludes
-- "Fulfillment Associate - Romeoville, IL" / "Fulfillment Pharmacist -
-- Boynton Beach, FL"; keeps "Fulfillment Manager, Enterprise Ops"). Ro's
-- own survivor count above (11/52) already reflects the fixed filter, not
-- the pre-fix count. `npm run test:server`: 145/145 green.
--
-- None of the four matches a NAMED_COMPANY_RATES entry in
-- data/industryBaseRates.js -- all fall through to that module's broader
-- industry-tier fallback.
--
-- All four inherit Part 1's white-collar relevance filter and Part 2's
-- MAX_ACTIVE_JOBS_PER_COMPANY=30 cap automatically -- config-only, no
-- adapter code changes beyond the relevance-filter fix above (which
-- applies pipeline-wide, not per-company). Total company job-listing
-- sources after this addition: 177.
insert into sources (name, type, authorization_status, api_available, rate_limits, attribution_required, storage_restrictions, redistribution_restricted, notes, config)
values
  (
    'Watershed Informatics (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/watershed/jobs. company_name verified to say "Watershed Informatics" (exact) -- a genomics/bioinformatics software company in Cambridge, MA, NOT the more widely-known climate-tech "Watershed" (carbon accounting SaaS, San Francisco); a genuinely distinct company sharing only the name. 7 of 8 sampled titles survive the combined relevance filter locally.',
    '{"platform": "greenhouse", "slug": "watershed", "company": "Watershed Informatics"}'::jsonb
  ),
  (
    'Calm.com (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/calm/jobs. company_name verified to say "Calm.com" (exact). Real, well-known meditation/sleep app. Very small board (2 total postings); 1 of 2 survives the combined relevance filter locally ("Growth Product Manager") -- added per the small-but-real-and-famous precedent already established (Consensys 1/6, Pacaso 5/5).',
    '{"platform": "greenhouse", "slug": "calm", "company": "Calm.com"}'::jsonb
  ),
  (
    'Ro (Lever Postings API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Lever company.',
    false,
    'Do not store full job description text -- same policy as every Lever source in this app.',
    false,
    'Public, unauthenticated Postings API at api.lever.co/v0/postings/ro. Real, well-known telehealth unicorn (parent of Roman/Rory), New York HQ confirmed via office locations and posting text. 52 total postings; 11 of 52 survive the combined relevance filter locally -- most of the board is pharmacy-fulfillment-center operations work (Romeoville IL / Boynton Beach FL / Torrance CA), which surfaced a real gap in the shared relevance filter, fixed alongside this addition (see this migration''s header comment). Survivors include real corporate roles: Analytics Engineer, Engineering Manager, Inventory Allocation Analyst, Technical Lead.',
    '{"platform": "lever", "slug": "ro", "company": "Ro"}'::jsonb
  ),
  (
    'Patch Media (Lever Postings API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Lever company.',
    false,
    'Do not store full job description text -- same policy as every Lever source in this app.',
    false,
    'Public, unauthenticated Postings API at api.lever.co/v0/postings/patch. Real hyperlocal news company (patch.com), company_name and posting content verified ("Patch Media is an equal opportunity employer..."). Distinct from the unrelated childcare-staffing "Patch" evaluated and rejected on Greenhouse (see this migration''s header comment) -- same bare slug word, two different real companies, each verified independently. Small board: 5 postings, 4 of 5 survive the combined relevance filter locally (Account Executive - Local Sales, Ad Ops Associate, 2x Local News Content Producer).',
    '{"platform": "lever", "slug": "patch", "company": "Patch Media"}'::jsonb
  );
