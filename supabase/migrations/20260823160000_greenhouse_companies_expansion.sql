-- Generalizes the Greenhouse pilot from one hardcoded company to a
-- data-driven list, per fetch-greenhouse-companies/index.ts's header
-- comment. All 6 new companies go through the exact same Greenhouse Job
-- Board API mechanism already vetted for Stripe (developers.greenhouse.io/
-- job-board.html) -- confirmed via scripts/check-company-source.mjs
-- against a broader UC-relevant candidate list, with each hit's own
-- company_name field checked to rule out a slug collision (the same round
-- of research caught "Oliver Wyman Labs" masquerading as the real Oliver
-- Wyman via a Lever slug -- excluded, not included here). All 6 confirmed
-- with substantial live posting counts (130-820) at the time of this
-- migration. See JOB_ENGINE_ARCHITECTURE.md Part 7's Stage 4 entry.

-- Stripe moves onto the same config shape as everything else, so one
-- adapter (fetch-greenhouse-companies) can run all 7 by querying sources
-- instead of a company being hardcoded into its own Edge Function.
update sources
set config = '{"platform": "greenhouse", "slug": "stripe", "company": "Stripe"}'::jsonb
where name = 'Stripe (Greenhouse Job Board API)';

insert into sources (name, type, authorization_status, api_available, rate_limits, attribution_required, storage_restrictions, redistribution_restricted, notes, config)
values
  (
    'Databricks (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company, well within Greenhouse''s own guidance against per-page-view polling.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app (Greenhouse''s API terms cover API use, not a copyright license from the employer over the posting text). application_url is the link-out path.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/databricks/jobs, the same officially documented mechanism confirmed for Stripe in Stage 3. company_name on each posting verified to say "Databricks" before this was added.',
    '{"platform": "greenhouse", "slug": "databricks", "company": "Databricks"}'::jsonb
  ),
  (
    'Coinbase (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/coinbase/jobs. company_name verified to say "Coinbase" before this was added.',
    '{"platform": "greenhouse", "slug": "coinbase", "company": "Coinbase"}'::jsonb
  ),
  (
    'Airbnb (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/airbnb/jobs. company_name verified to say "Airbnb" before this was added.',
    '{"platform": "greenhouse", "slug": "airbnb", "company": "Airbnb"}'::jsonb
  ),
  (
    'Brex (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/brex/jobs. company_name verified to say "Brex" before this was added.',
    '{"platform": "greenhouse", "slug": "brex", "company": "Brex"}'::jsonb
  ),
  (
    'Figma (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/figma/jobs. company_name verified to say "Figma" before this was added.',
    '{"platform": "greenhouse", "slug": "figma", "company": "Figma"}'::jsonb
  ),
  (
    'Robinhood (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/robinhood/jobs. company_name verified to say "Robinhood" before this was added.',
    '{"platform": "greenhouse", "slug": "robinhood", "company": "Robinhood"}'::jsonb
  );
