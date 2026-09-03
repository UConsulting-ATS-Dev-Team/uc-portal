-- Sixteenth addition's one Lever hit (the five Greenhouse hits from the
-- same pass are the prior migration). Same fetch-lever-companies adapter
-- as Wealthfront/Belvedere Trading/Tala/Palantir/Point B/Spotify/Coupa --
-- no code changes, config insert only.
--
-- Zoox: real autonomous-vehicle ("robotaxi") company, an Amazon
-- subsidiary since 2020, extremely high-profile within tech/mobility.
-- Lever slug "zoox" (obvious-guess hit), 236 postings. No self-reported
-- company name exists in Lever's response (same limitation documented for
-- Wealthfront/Belvedere Trading/Tala/Spotify/Coupa) -- identity verified
-- instead via: (1) every sampled posting located in Foster City, CA,
-- Zoox's real known headquarters city; (2) zoox.com/careers's own page
-- content directly references "Amazon" (Zoox's real parent company); (3)
-- job titles are strongly autonomous-vehicle-specific ("Autonomy System
-- Test Engineer", "AV Safety Data Reporting Engineer", "Chassis Controls
-- Engineer, Brakes & Steering", "Compute Platform System Safety
-- Engineer"), matching Zoox's real robotaxi business exactly, not a
-- generic or unrelated org that happens to share the short name "zoox".
-- 102 of 236 sampled titles survive the white-collar relevance filter
-- locally (only 1 of 236 trips the manual-trade denylist -- "brakes" in
-- "Chassis Controls Engineer, Brakes & Steering", an engineering title
-- correctly caught by the same conservative word-boundary match that
-- already excludes Carvana's actual brake-repair technicians; the
-- remaining 133 are correctly denylisted as senior/staff/principal-level,
-- consistent with a company this deep into a mature R&D program); will be
-- capped to 30 active.
insert into sources (name, type, authorization_status, api_available, rate_limits, attribution_required, storage_restrictions, redistribution_restricted, notes, config)
values
  (
    'Zoox (Lever Postings API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other configured Lever company.',
    false,
    'Do not store full job description text -- same policy as every ATS source in this app.',
    false,
    'Public, unauthenticated Lever Postings API at api.lever.co/v0/postings/zoox. No self-reported company name field exists on a Lever posting -- identity verified instead via Foster City CA locations (Zoox''s real HQ), zoox.com/careers referencing Amazon (Zoox''s real parent company since 2020), and strongly autonomous-vehicle-specific job content (Autonomy System Test Engineer, AV Safety Data Reporting Engineer, Chassis Controls Engineer). Real high-profile robotaxi company. Same runtime identity safeguard and honest limitation as Wealthfront/Belvedere Trading/Tala/Spotify/Coupa.',
    '{"platform": "lever", "slug": "zoox", "company": "Zoox"}'::jsonb
  );
