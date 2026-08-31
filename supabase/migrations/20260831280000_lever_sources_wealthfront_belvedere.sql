-- First two sources onto the new fetch-lever-companies Edge Function (see
-- that function's own header comment for the full adapter design). Both
-- were found and identity-verified during the Eighth Greenhouse addition
-- pass (JOB_ENGINE_ARCHITECTURE.md, 2026-08-31) but deliberately not added
-- then, since this codebase had no Lever adapter at all at that point --
-- flagged there as real candidates for a future Lever adapter, not
-- rejected on authorization or identity grounds. This migration is that
-- follow-on.
--
-- Lever's own public Postings API (api.lever.co/v0/postings/{slug}) is
-- Lever's own documented, unauthenticated, explicitly third-party-facing
-- job board API -- same legal category as Greenhouse's Job Board API
-- already vetted throughout this doc for every existing Greenhouse source,
-- not per-customer terms.
--
-- Both re-verified directly against the real live API immediately before
-- writing this migration (2026-08-31):
--
-- Wealthfront: Lever slug "wealthfront", 23 postings. No self-reported
-- company name exists in Lever's response (confirmed by inspecting the
-- full real key set -- see server/src/leverAdapter.ts's header), so
-- identity here rests on: every sampled hostedUrl resolving to
-- jobs.lever.co/wealthfront/... (Lever's own domain), every location
-- (Palo Alto CA / Seattle WA / San Francisco CA / New York City NY)
-- matching the real fintech's known offices, and posting content (Android
-- Engineer, AML Monitoring Analyst, Backend Engineer referencing real
-- Wealthfront products -- Cash Account, tax-loss harvesting) that's
-- unambiguously the real investment/fintech Wealthfront, not a
-- name-collision.
--
-- Belvedere Trading: Lever slug "belvederetrading", 14 postings. Same
-- identity basis: hostedUrls resolve to jobs.lever.co/belvederetrading/...,
-- office locations (Chicago IL, plus a Singapore office) and posting
-- content (Options Trader, FPGA Engineer, floor-trading roles referencing
-- MIAX/AMEX) match the real Chicago-based proprietary trading firm.
insert into sources (name, type, authorization_status, api_available, rate_limits, attribution_required, storage_restrictions, redistribution_restricted, notes, config)
values
  (
    'Wealthfront (Lever Postings API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other configured Lever company.',
    false,
    'Do not store full job description text -- same policy as every ATS source in this app.',
    false,
    'Public, unauthenticated Lever Postings API at api.lever.co/v0/postings/wealthfront. No self-reported company name field exists on a Lever posting (unlike Greenhouse''s company_name) -- identity verified instead via hostedUrl resolving to jobs.lever.co/wealthfront/..., real Wealthfront office locations, and posting content matching the real fintech. Runtime identity safeguard (fetch-lever-companies) checks each posting''s own hostedUrl against this source''s configured slug -- see that function''s header comment for the honest limitation this does not cover (a genuine future slug reassignment to an unrelated org would not be caught, since Lever gives this adapter no self-reported-name signal the way Greenhouse does).',
    '{"platform": "lever", "slug": "wealthfront", "company": "Wealthfront"}'::jsonb
  ),
  (
    'Belvedere Trading (Lever Postings API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other configured Lever company.',
    false,
    'Do not store full job description text -- same policy as every ATS source in this app.',
    false,
    'Public, unauthenticated Lever Postings API at api.lever.co/v0/postings/belvederetrading. No self-reported company name field exists on a Lever posting -- identity verified instead via hostedUrl resolving to jobs.lever.co/belvederetrading/..., real Belvedere Trading office locations (Chicago, plus Singapore), and posting content (options trading, FPGA engineering) matching the real prop-trading firm. Same runtime identity safeguard and honest limitation as the Wealthfront source above.',
    '{"platform": "lever", "slug": "belvederetrading", "company": "Belvedere Trading"}'::jsonb
  );
