-- Thirteenth addition's one Lever hit (the twenty Greenhouse hits from
-- the same pass are the prior migration). Same fetch-lever-companies
-- adapter as Wealthfront/Belvedere Trading/Tala/Palantir/Point B/
-- Spotify -- no code changes, config insert only.
--
-- Coupa: real spend-management/business-spend-management software
-- company (taken private by Thoma Bravo in 2023, still a well-known
-- enterprise-software brand). Lever slug "coupa", 79 postings. No
-- self-reported company name exists in Lever's response (same
-- limitation documented for Wealthfront/Belvedere Trading/Tala/Spotify)
-- -- identity verified instead via strongly Coupa-specific content:
-- "Director, FP&A - 11697" in Chicago, "German Financial Accountant" in
-- Germany, "HR Data & Insights Manager - 11517" in Colombia, "Legal
-- Counsel I - 11829" in Colombia, "Legal Director, Products &
-- Partnerships - 11858" in Canada, "Sr Product Manager - 11826" in
-- Austin -- a genuine global corporate-role spread (Tokyo, UK,
-- Australia, Mexico City, Chicago, Austin, Germany, Colombia, Canada)
-- matching Coupa's real known footprint, with real sequential internal
-- req-ID numbering (11341, 11517, 11661, 11697, 11826, 11829, 11858) --
-- the pattern of a genuine corporate ATS, not a talent-pipeline/signup
-- form (the "real board, not usable" class this doc excluded Hudson
-- River Trading/Thrive Capital/MetLife/Blue Apron's "blue" slug on).
-- Coupa's own real careers page (coupa.com/careers, coupa.com/jobs) is
-- client-rendered and returned HTTP 403 on a raw fetch -- identity rests
-- on the content signals above, the same class of confirmation this doc
-- used for Affirm/Mercury/Chicago Trading Company/Spotify when a raw
-- careers-page fetch didn't surface a direct link.
insert into sources (name, type, authorization_status, api_available, rate_limits, attribution_required, storage_restrictions, redistribution_restricted, notes, config)
values
  (
    'Coupa (Lever Postings API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other configured Lever company.',
    false,
    'Do not store full job description text -- same policy as every ATS source in this app.',
    false,
    'Public, unauthenticated Lever Postings API at api.lever.co/v0/postings/coupa. No self-reported company name field exists on a Lever posting -- identity verified instead via strongly Coupa-specific content (Director FP&A/Legal Counsel/HR Data & Insights Manager/Product Manager roles across Tokyo/UK/Australia/Mexico City/Chicago/Austin/Germany/Colombia/Canada, matching Coupa''s real known global footprint, with genuine sequential internal req-ID numbering). Real spend-management/business-spend-management software company (Thoma Bravo portfolio company since 2023). Same runtime identity safeguard and honest limitation as Wealthfront/Belvedere Trading/Tala/Spotify.',
    '{"platform": "lever", "slug": "coupa", "company": "Coupa"}'::jsonb
  );
