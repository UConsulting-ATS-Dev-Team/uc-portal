-- Eleventh addition's one Lever hit (the seventeen Greenhouse hits from
-- the same pass are the prior migration). Same fetch-lever-companies
-- adapter as Wealthfront/Belvedere Trading -- no code changes, config
-- insert only.
--
-- Tala: real mobile-lending/microfinance fintech (serves Mexico, India,
-- the Philippines, Kenya). Lever slug "tala", 8 postings. No self-reported
-- company name exists in Lever's response (same limitation documented for
-- Wealthfront/Belvedere Trading) -- identity verified instead via
-- tala.co/careers's own page source directly embedding this exact board
-- (jobs.lever.co/tala/... links present), and posting locations (MX, IN,
-- PH) matching the real company's known footprint exactly. Titles are
-- genuine corporate/tech roles (Brand & Community Manager, Senior Backend
-- Engineer, SDET, Senior Manager Expansion Risk, Senior Product Analyst
-- (Accounting & Finance), Senior SecOps Engineer) -- no manual-trade or
-- clinical-care titles.
insert into sources (name, type, authorization_status, api_available, rate_limits, attribution_required, storage_restrictions, redistribution_restricted, notes, config)
values
  (
    'Tala (Lever Postings API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other configured Lever company.',
    false,
    'Do not store full job description text -- same policy as every ATS source in this app.',
    false,
    'Public, unauthenticated Lever Postings API at api.lever.co/v0/postings/tala. No self-reported company name field exists on a Lever posting -- identity verified instead via tala.co/careers''s own page source directly embedding this exact board, and posting locations (Mexico, India, Philippines) matching the real mobile-lending fintech''s known footprint. Same runtime identity safeguard and honest limitation as Wealthfront/Belvedere Trading.',
    '{"platform": "lever", "slug": "tala", "company": "Tala"}'::jsonb
  );
