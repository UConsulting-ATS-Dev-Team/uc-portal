-- Nineteenth addition: one more Greenhouse company, Pacaso -- checked a
-- proptech/insurtech batch after the Eighteenth addition's consulting
-- pass. Confirmed the live starting count via direct Postgres query first
-- (166 total approved company sources, matching the Eighteenth addition's
-- own closing figure).
--
-- No usable board on either platform: Opendoor, Compass, Zillow, Redfin,
-- Flyhomes, Hippo, Lemonade, Root, Next Insurance, Clearcover, Kin,
-- Policygenius -- extending the established pattern into proptech/
-- insurtech specifically.
--
-- Real-but-empty board: "ethos" (Greenhouse, presumably the real Ethos
-- life-insurance company) resolves but returns zero active postings --
-- not worth adding an empty source.
--
-- One thin/ambiguous candidate excluded on the same rigor bar as prior
-- additions' "Indigo" exclusion: "branch" (Greenhouse) resolves with only
-- 3 postings ("Enterprise Account Executive, Marketplaces", "Senior
-- Accountant", "Senior Software Engineer, Platform", all Remote US) and
-- company_name "Branch" -- but "Branch" is a genuinely common company
-- name (Branch Insurance, Branch Metrics, Branch International, Branch
-- Furniture all real, different companies) with no title content
-- specific enough to confirm which one this is. Too thin a board to
-- independently confirm identity beyond the bare name match alone --
-- excluded, not independently pursued.
--
-- One real hit: Pacaso -- real, well-known proptech unicorn (~$1.5B
-- valuation, co-founded by a former Zillow co-founder), luxury
-- vacation-home co-ownership platform. Greenhouse slug "pacaso",
-- company_name "Pacaso " (note trailing space in the source data itself,
-- not a transcription artifact) verified. Small board: 5 postings --
-- "Contract Asset Manager, Malibu" and "Maintenance Manager, Tahoe" are
-- real, identity-confirming titles matching Pacaso's actual co-ownership
-- markets (Malibu, Lake Tahoe are both real, well-known Pacaso markets);
-- "Director of Lifecycle Marketing", "Ownership Advisor, Sales", "Social
-- Media and Influencer Strategist" are genuinely corporate. 5 of 5
-- sampled titles survive the relevance filter locally (checked against
-- isLikelyNonCorporateRole() in server/src/relevance.ts) -- added anyway
-- per the same small-but-real-and-famous precedent as Consensys (1/6),
-- SeatGeek (6/20), StubHub (8/17) from prior additions.
--
-- Does not match a NAMED_COMPANY_RATES entry in data/industryBaseRates.js
-- -- falls through to that module's broader industry-tier fallback.
--
-- Inherits Part 1's white-collar relevance filter and Part 2's
-- MAX_ACTIVE_JOBS_PER_COMPANY=30 cap automatically -- config-only, no
-- adapter code changes. Total company job-listing sources after this
-- addition: 167.
insert into sources (name, type, authorization_status, api_available, rate_limits, attribution_required, storage_restrictions, redistribution_restricted, notes, config)
values
  (
    'Pacaso (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/pacaso/jobs. company_name verified to say "Pacaso" (trailing space in source data). "Contract Asset Manager, Malibu" and "Maintenance Manager, Tahoe" titles match Pacaso''s real luxury vacation-home co-ownership markets. Real proptech unicorn (~$1.5B valuation). Small board: 5 of 5 sampled titles survive the relevance filter locally -- added per the small-but-real-and-famous precedent already established (Consensys 1/6, SeatGeek 6/20, StubHub 8/17).',
    '{"platform": "greenhouse", "slug": "pacaso", "company": "Pacaso"}'::jsonb
  );
