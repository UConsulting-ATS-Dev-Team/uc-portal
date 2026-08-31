-- Ninth addition: twelve more companies onto the config-driven Greenhouse
-- mechanism (fetch-greenhouse-companies), the largest single addition in
-- this doc's Part 7 history, surpassing the Eighth. Same standing
-- direction as the Sixth/Seventh/Eighth additions: prioritize finding new
-- companies over adding volume to existing ones, weighted toward
-- consulting/investment banking/tech/finance.
--
-- (1) Checked for any previously-found-but-unadded Lever hits before doing
--     new research, per this pass's own instructions -- none exist.
--     Wealthfront and Belvedere Trading (the two real Lever boards the
--     Eighth addition flagged as "found and deliberately not added, no
--     Lever adapter exists") were already onboarded via the new
--     fetch-lever-companies adapter (see this doc's dated entry
--     immediately above this migration's own). Every other Lever hit
--     surfaced across prior passes was excluded for a different reason
--     (Plaid/Narmi/Optiver/Thoma Bravo: real but 0 postings; Capital One's
--     Lever slug/Oliver Wyman Labs: identity mismatch, an unrelated real
--     company on that slug) -- none were sitting on a "no adapter yet"
--     shelf, so there was no other cheap win here.
--
-- (2) Re-queried the live `people` table directly (`npx supabase db query
--     --linked`, every non-null, non-empty `company` value). Every
--     distinct value came back already checked (live or rejected) in a
--     prior pass -- no new alumni-backed candidates this time (McKenna
--     Labs/Paladin Protocol, the two new hits from the Eighth addition,
--     are still the most recent alumni-only additions; nothing has been
--     added to the roster since).
--
-- (3) Branched into the same four verticals the task brief calls
--     productive, checking a fresh batch of ~39 adjacent-company
--     candidates against both Greenhouse and Lever this time (not just
--     Greenhouse, now that a Lever adapter exists) via
--     scripts/check-company-source.mjs:
--
--     Quant/prop-trading: Millennium Management, D. E. Shaw, Da Vinci
--     Trading, and Maven Securities had no usable signal on either
--     platform. Qube Research and Technologies' Greenhouse hit was
--     initially flagged by the script as a company-name mismatch (its own
--     naive normalizer chokes on "and" vs. "&"), but manual verification
--     confirms it's the real firm (see below) -- included after review,
--     not on the script's verdict alone.
--
--     Fintech: Klarna, Revolut, Rippling, Deel, Acorns, MoneyLion, and
--     Addepar had no usable signal on either platform. Wealthsimple's
--     Lever slug resolves but reports 0 postings -- same "real but empty"
--     case already documented for Plaid/Indeed/Narmi/Candidly/Optiver/
--     Apollo/American Securities/Thoma Bravo, excluded regardless of
--     platform.
--
--     Consulting/advisory: Bates White, Berkeley Research Group, Ankura,
--     Secretariat International, and Sia Partners had no usable signal.
--     Compass Lexecon's Lever slug resolves but reports 0 postings --
--     same real-but-empty case as above.
--
--     Private equity/asset management: TPG, Brookfield, EQT, Oaktree
--     Capital, Centerbridge Partners, and Clayton Dubilier and Rice had no
--     usable signal on either platform. Marshall Wace's and Permira's and
--     Battery Ventures' Greenhouse slugs all resolve but report 0
--     postings and a null company_name -- same real-but-empty case as
--     above, three more data points for the same pattern.
--
--     One real identity rejection along the way: General Catalyst's
--     "general" slug (a bare-word guess, not the real one used below)
--     resolves to company_name "General Interest" -- an unrelated org, the
--     same slug-squatting pattern already caught for "bcg"/"Disney"/
--     Capital One's Lever slug/Aura/Wise/Current in prior passes. Excluded
--     in favor of the real "generalcatalyst" slug, which does carry the
--     correct company_name (see below).
--
--     One additional identity check, Chicago Trading Company (CTC):
--     Greenhouse slug "chicagotrading" resolves with 24 real distinct
--     postings, but its own company_name field reads "CTC Lateral -
--     Website & LinkedIn" -- an internal recruiting-channel label, not a
--     form of the company's name the way IMC Trading's "IMC" or Old
--     Mission Capital's "Old Mission" were. Not accepted on the
--     office/title content alone (Chicago-only + one NY office, systematic
--     options-market-making roles, a real internal desk name "Delta
--     Force") -- independently confirmed by fetching one of its own
--     Greenhouse-hosted job pages directly and finding the page's own logo
--     element links to https://www.chicagotrading.com/ (the real company's
--     own domain), the same class of confirmation this doc's prior
--     additions used for Jane Street/Jump Trading/Akuna Capital/SoFi/
--     AlixPartners/Mercury. Included with the honest company_name anomaly
--     documented, not silently smoothed over.
--
--     Twelve real hits, verified the same way as every prior addition --
--     company_name checked for an exact match (except CTC's documented
--     exception above) plus at least one sampled application URL, page
--     embed, or office footprint cross-checked against the real company,
--     never trusting a slug guess alone:
--
-- Point72: real multi-strategy hedge fund, adjacent to the prop-trading/
-- quant-finance cluster (IMC Trading/Jane Street/Jump Trading/Akuna
-- Capital/XTX Markets/Tower Research Capital/Virtu Financial/Old Mission
-- Capital/DV Trading/Flow Traders, all already live). Greenhouse slug
-- "point72", 236 postings, company_name "Point72" (exact). Titles
-- reference the firm's own real internal programs ("Cubist Quant Academy",
-- "Point72 Academy Investment Analyst Summer Internship Program").
--
-- Squarepoint Capital: real quant trading firm, same cluster. Greenhouse
-- slug "squarepointcapital", 93 postings, company_name "Squarepoint
-- Capital" (exact). Every sampled application URL resolves to
-- www.squarepoint-capital.com/open-opportunities (own domain).
--
-- ExodusPoint: real multi-strategy hedge fund, same cluster. Greenhouse
-- slug "exoduspoint", a small board (2 postings), company_name
-- "ExodusPoint" (exact) on both -- one posting is even titled "Investment
-- - ExodusPoint Jobs Page." Small board size alone isn't disqualifying
-- (Marqeta/XTX Markets/Guild were all added at a similar or smaller
-- scale).
--
-- Schonfeld: real multi-strategy trading firm, same cluster. Greenhouse
-- slug "schonfeld", 55 postings, company_name "Schonfeld" (exact). Titles
-- are genuine quantitative-research/investment-analyst roles consistent
-- with the real firm.
--
-- Qube Research & Technologies (QRT): real quant trading firm, same
-- cluster. Greenhouse slug "quberesearchandtechnologies", 193 postings,
-- company_name "Qube Research & Technologies" (exact once the script's own
-- "and" vs. "&" normalization false-flag is set aside -- see above). Office
-- spread (Zurich, Dubai, Geneva, London, Paris, Budapest, Hong Kong)
-- matches the real global firm.
--
-- Chicago Trading Company (CTC): real Chicago-based options-market-making/
-- prop-trading firm, same cluster. Greenhouse slug "chicagotrading", 24
-- postings, company_name "CTC Lateral - Website & LinkedIn" (an internal
-- recruiting-channel label, not a form of the company name -- see the
-- honest identity discussion above; confirmed instead via a fetched job
-- page's own logo element linking to https://www.chicagotrading.com/, the
-- real company's own domain). Titles reference a real internal desk name
-- ("Delta Force") and are exclusively Chicago/New York-based systematic
-- trading/engineering/compliance roles.
--
-- Gusto: real payroll/HR/benefits fintech, adjacent to Stripe/Brex/
-- Affirm/Chime/Mercury/Marqeta/Carta/Betterment/Upstart/Block (already
-- live). Greenhouse slug "gusto", 91 postings, company_name "Gusto, Inc."
-- (exact).
--
-- Public: real retail investing/trading fintech (Public.com), same
-- cluster. Greenhouse slug "public", a small board (4 postings),
-- company_name "Public" (exact) -- despite the generic name, titles
-- ("Active Trader Sales: Options Lead") are unambiguously the real
-- trading-app company, not a squatter.
--
-- Baringa Partners: real UK-based energy/financial-services/technology
-- consulting firm, adjacent to Accordion/AlixPartners/Charles River
-- Associates/Guidepoint (already live). Greenhouse slug "baringa"
-- (EU-hosted board, job-boards.eu.greenhouse.io -- fetched cleanly through
-- the same boards-api.greenhouse.io endpoint every other source uses), 90
-- postings, company_name "Baringa" (exact). Titles reference real energy/
-- commodities-trading consulting work consistent with the real firm.
--
-- Elixirr: real management consulting firm, same cluster. Greenhouse slug
-- "elixirr", 19 postings, company_name "Elixirr Consulting" (exact).
-- Every sampled application URL resolves to www.elixirr.com/careers (own
-- domain).
--
-- General Catalyst: real venture capital firm (its wealth-management arm,
-- GC Wealth) -- the private-equity/asset-management vertical alongside
-- General Atlantic/Bessemer Venture Partners (added in the same pass).
-- Greenhouse slug "generalcatalyst" (not the bare "general" guess, which
-- is an unrelated company -- see above), a small board (1 posting),
-- company_name "General Catalyst" (exact) -- the posting is titled "Client
-- Service Associate, GC Wealth," GC Wealth being a real General Catalyst
-- subsidiary.
--
-- Bessemer Venture Partners: real venture capital firm, same vertical.
-- Greenhouse slug "bessemerventurepartners", 4 postings, company_name
-- "Bessemer Venture Partners" (exact). Titles are genuine investing
-- roles (Associate/Senior Associate, AI & Data Infrastructure).
--
-- All twelve inherit Part 1's white-collar relevance filter
-- (isLikelySeniorRole/isLikelyNonCorporateRole) and Part 2's
-- MAX_ACTIVE_JOBS_PER_COMPANY=30 cap automatically -- no adapter code
-- changes, config-only, same as every Greenhouse addition since the
-- second. Verified live rather than assumed (see this doc's dated entry
-- for the actual post-fetch counts and title spot-checks).
insert into sources (name, type, authorization_status, api_available, rate_limits, attribution_required, storage_restrictions, redistribution_restricted, notes, config)
values
  (
    'Point72 (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/point72/jobs. company_name verified to say "Point72" on every posting; titles reference the firm''s own real internal programs ("Cubist Quant Academy", "Point72 Academy"). Real multi-strategy hedge fund, adjacent to the prop-trading/quant-finance cluster already live.',
    '{"platform": "greenhouse", "slug": "point72", "company": "Point72"}'::jsonb
  ),
  (
    'Squarepoint Capital (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/squarepointcapital/jobs. company_name verified to say "Squarepoint Capital" on every posting; every sampled application URL resolves to www.squarepoint-capital.com/open-opportunities (own domain). Real quant trading firm, same cluster.',
    '{"platform": "greenhouse", "slug": "squarepointcapital", "company": "Squarepoint Capital"}'::jsonb
  ),
  (
    'ExodusPoint (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/exoduspoint/jobs. company_name verified to say "ExodusPoint" on both current postings (a small board, same size class as Marqeta/XTX Markets/Guild when first added) -- one posting is titled "Investment - ExodusPoint Jobs Page." Real multi-strategy hedge fund, same cluster.',
    '{"platform": "greenhouse", "slug": "exoduspoint", "company": "ExodusPoint"}'::jsonb
  ),
  (
    'Schonfeld (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/schonfeld/jobs. company_name verified to say "Schonfeld" on every posting; titles are genuine quantitative-research/investment-analyst roles. Real multi-strategy trading firm, same cluster.',
    '{"platform": "greenhouse", "slug": "schonfeld", "company": "Schonfeld"}'::jsonb
  ),
  (
    'Qube Research & Technologies (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/quberesearchandtechnologies/jobs. company_name verified to say "Qube Research & Technologies" on every posting (check-company-source.mjs''s own naive "and" vs. "&" normalizer initially flagged this as a mismatch -- manually reviewed and confirmed correct). Office spread (Zurich, Dubai, Geneva, London, Paris, Budapest, Hong Kong) matches the real global quant firm.',
    '{"platform": "greenhouse", "slug": "quberesearchandtechnologies", "company": "Qube Research & Technologies"}'::jsonb
  ),
  (
    'Chicago Trading Company (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/chicagotrading/jobs. company_name is literally "CTC Lateral - Website & LinkedIn" (an internal recruiting-channel label, not a form of the company name the way IMC Trading''s "IMC" or Old Mission Capital''s "Old Mission" were) -- identity confirmed instead by fetching a live job page directly and finding its own logo element links to https://www.chicagotrading.com/ (the real company''s own domain). Titles reference a real internal desk name ("Delta Force") and are exclusively Chicago/New York systematic-trading/engineering/compliance roles. Real Chicago-based options-market-making/prop-trading firm, same cluster.',
    '{"platform": "greenhouse", "slug": "chicagotrading", "company": "CTC Lateral - Website & LinkedIn"}'::jsonb
  ),
  (
    'Gusto (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/gusto/jobs. company_name verified to say "Gusto, Inc." on every posting. Real payroll/HR/benefits fintech, adjacent to Stripe/Brex/Affirm/Chime/Mercury/Marqeta/Carta/Betterment/Upstart/Block (already live).',
    '{"platform": "greenhouse", "slug": "gusto", "company": "Gusto, Inc."}'::jsonb
  ),
  (
    'Public (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/public/jobs. company_name verified to say "Public" on every posting (a small board, 4 postings) -- despite the generic name, titles ("Active Trader Sales: Options Lead") are unambiguously the real Public.com trading app, not a squatter. Real retail investing/trading fintech, same cluster.',
    '{"platform": "greenhouse", "slug": "public", "company": "Public"}'::jsonb
  ),
  (
    'Baringa Partners (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/baringa/jobs (an EU-hosted board, job-boards.eu.greenhouse.io -- fetched cleanly through the same boards-api.greenhouse.io endpoint every other source uses). company_name verified to say "Baringa" on every posting; titles reference real energy/commodities-trading consulting work. Real UK-based energy/financial-services/technology consulting firm, adjacent to Accordion/AlixPartners/Charles River Associates/Guidepoint (already live).',
    '{"platform": "greenhouse", "slug": "baringa", "company": "Baringa"}'::jsonb
  ),
  (
    'Elixirr (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/elixirr/jobs. company_name verified to say "Elixirr Consulting" on every posting; every sampled application URL resolves to www.elixirr.com/careers (own domain). Real management consulting firm, same cluster.',
    '{"platform": "greenhouse", "slug": "elixirr", "company": "Elixirr Consulting"}'::jsonb
  ),
  (
    'General Catalyst (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/generalcatalyst/jobs (not the bare "general" slug guess, which resolves to an unrelated company, "General Interest" -- the same slug-squatting pattern already caught for "bcg"/"Disney"/Capital One''s Lever slug/Aura/Wise/Current). company_name verified to say "General Catalyst" on its one current posting, titled "Client Service Associate, GC Wealth" -- GC Wealth is a real General Catalyst subsidiary. Real venture capital firm -- the private-equity/asset-management vertical alongside General Atlantic (already live).',
    '{"platform": "greenhouse", "slug": "generalcatalyst", "company": "General Catalyst"}'::jsonb
  ),
  (
    'Bessemer Venture Partners (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/bessemerventurepartners/jobs. company_name verified to say "Bessemer Venture Partners" on every posting; titles are genuine investing roles (Associate/Senior Associate, AI & Data Infrastructure). Real venture capital firm, same vertical as General Catalyst/General Atlantic.',
    '{"platform": "greenhouse", "slug": "bessemerventurepartners", "company": "Bessemer Venture Partners"}'::jsonb
  );
