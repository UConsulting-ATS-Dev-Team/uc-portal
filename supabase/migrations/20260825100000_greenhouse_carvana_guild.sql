-- Two more companies onto the config-driven Greenhouse mechanism
-- (fetch-greenhouse-companies) -- sourced the same way as IMC Trading/
-- Charlie Health (20260824210000): cross-referencing
-- scripts/check-company-source.mjs against the *real* UC alumni-by-company
-- counts (the `people` table, from the UConsulting Directory import),
-- ranked by count, rather than another guessed candidate list.
--
-- Every company actually checked this pass, ranked by real alumni count
-- and skipping everything already live or already rejected in a prior
-- pass: Microsoft, Visa, Ares Management, Disney, Meta, PIMCO, Google,
-- Amazon, Apple, Capital One, Cisco, Intel, PayPal, KKR, Sequoia Capital,
-- Boeing, CBRE, Aon, BDO, Indeed, Guild Education, Standard Chartered,
-- NASA JPL, DoorDash -- plus a fresh re-check of the five candidates a
-- prior pass had sourced but never confirmed added or rejected (Notion,
-- Plaid, Ramp, Evercore, Moelis). All came back with no usable public
-- board except the two added here, for these reasons:
--   * Microsoft, Meta, Visa, Intel, Boeing, NASA JPL, Moelis: a
--     "myworkdayjobs.com" reference on their careers page (a Workday
--     hint), same weak, non-buildable signal already documented for
--     Accenture -- not a confirmed public API/endpoint.
--   * Disney: Greenhouse slug "disney" resolves to an unrelated company
--     ("Sgt. Pepper's Lonely Hearts Club Band") -- the same slug-squatting
--     pattern already caught for "bcg" (Stage 3) and "Oliver Wyman Labs"
--     (Stage 4) -- not Disney, excluded.
--   * Capital One: Lever slug "capital" resolves to 41 real postings, but
--     sampling the actual job data (locations: Limassol/Cyprus, Sofia/
--     Bulgaria, Warsaw/Poland, Dubai, Nassau/Bahamas; roles like "Back
--     Office Payments and AML Officer (Crypto Operations)") makes clear
--     this is an unrelated crypto/CFD trading company, not the real
--     Capital One (a US bank with no Cyprus/Bahamas footprint) -- another
--     slug collision, same caution as Disney above, excluded.
--   * Indeed: Greenhouse slug "indeed" is real (presumably Indeed's own
--     corporate-recruiting board) but reports 0 postings -- not a usable
--     data source regardless of authenticity, excluded.
--   * Ares Management, PIMCO, Google, Amazon, Apple, Cisco, PayPal, KKR,
--     Sequoia Capital, CBRE, Aon, BDO, DoorDash, Notion, Plaid (Lever slug
--     found, but 0 postings -- same "real but empty" case as Indeed),
--     Ramp, Evercore, Standard Chartered: no Greenhouse/Lever board, no
--     schema.org JobPosting, no Workday hint at all -- nothing checkable.
--
-- Carvana: real used-car retailer (NYSE: CVNA), one real UC alumnus on
-- record. Greenhouse slug "carvana", 1,698 postings, company_name
-- "Carvana" on every posting (exact match), and every sampled posting's
-- application URL is hosted on Carvana's own domain
-- (carvana.com/careers/apply?gh_jid=...) -- as strong an identity
-- confirmation as Stripe's own pilot had.
--
-- Guild (formerly "Guild Education", the company's own 2023 rebrand --
-- the real alumnus's record predates the rename, which is why the source
-- research started from "Guild Education"): real workforce-education/
-- tuition-benefits company, one real UC alumnus on record. Greenhouse
-- slug "guild", 5 postings, company_name "Guild" on every posting (exact
-- match -- note this is the short/rebranded name, not "Guild Education",
-- so the source config below uses "Guild" to agree with what Greenhouse
-- actually reports, same lesson as IMC Trading's company-name fix
-- 20260824220000), and every sampled posting's application URL is hosted
-- on Guild's own domain (guild.com/open-positions-at-guild?gh_jid=...).
insert into sources (name, type, authorization_status, api_available, rate_limits, attribution_required, storage_restrictions, redistribution_restricted, notes, config)
values
  (
    'Carvana (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/carvana/jobs. company_name verified to say "Carvana" on every posting, and sampled application URLs resolve to carvana.com/careers/apply, confirming this is genuinely Carvana and not a slug collision.',
    '{"platform": "greenhouse", "slug": "carvana", "company": "Carvana"}'::jsonb
  ),
  (
    'Guild (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/guild/jobs. company_name verified to say "Guild" (the company''s current name, rebranded from "Guild Education" in 2023 -- the config''s `company` match value below is "Guild" to agree with Greenhouse''s actual field) on every posting, and sampled application URLs resolve to guild.com/open-positions-at-guild, confirming identity.',
    '{"platform": "greenhouse", "slug": "guild", "company": "Guild"}'::jsonb
  );
