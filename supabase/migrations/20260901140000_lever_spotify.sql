-- Twelfth addition's one Lever hit (the three Greenhouse hits from the
-- same pass -- SpaceX, Discord, Epic Games -- are the prior migration).
-- Same fetch-lever-companies adapter as Wealthfront/Belvedere
-- Trading/Tala -- no code changes, config insert only.
--
-- Spotify: real publicly-traded music-streaming company (NYSE: SPOT).
-- Lever slug "spotify", 77 postings. No self-reported company name exists
-- in Lever's response (same limitation documented for Wealthfront/
-- Belvedere Trading/Tala) -- identity verified instead via strongly
-- Spotify-specific content: "Senior Partner Engineer - Hardware
-- Partnerships" located in Stockholm (Spotify's real headquarters city),
-- "Artist & Label Partnerships Manager" roles (Maghreb/Taiwan/Vietnam --
-- a function unique to Spotify's real music-industry-facing business),
-- "Senior Legal Counsel - Music Publishing" in Los Angeles, and multiple
-- Finance/FP&A roles in New York -- all consistent with Spotify's real,
-- known office footprint (Stockholm, New York, London, Los Angeles).
-- Spotify's own real careers sites (lifeatspotify.com/jobs,
-- spotifyjobs.com) are both heavily client-rendered and didn't surface a
-- direct lever.co embed in a raw fetch -- identity rests on the content
-- signals above, the same class of confirmation this doc used for
-- Affirm/Mercer's Mercury/Chicago Trading Company when a raw careers-page
-- fetch didn't surface a direct link. 23 of 77 postings match a finance/
-- legal/marketing/business-development keyword filter (Manager FP&A,
-- Senior Revenue Accountant, Legal Counsel, Business Development Senior
-- Manager, Marketing Manager, among them) -- genuine white-collar
-- corporate roles, not purely engineering.
insert into sources (name, type, authorization_status, api_available, rate_limits, attribution_required, storage_restrictions, redistribution_restricted, notes, config)
values
  (
    'Spotify (Lever Postings API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other configured Lever company.',
    false,
    'Do not store full job description text -- same policy as every ATS source in this app.',
    false,
    'Public, unauthenticated Lever Postings API at api.lever.co/v0/postings/spotify. No self-reported company name field exists on a Lever posting -- identity verified instead via strongly Spotify-specific content ("Senior Partner Engineer - Hardware Partnerships" in Stockholm -- Spotify''s real HQ city; "Artist & Label Partnerships Manager" roles, unique to Spotify''s real business; Finance/FP&A roles in New York; Legal Counsel roles in Los Angeles) matching the real publicly-traded music-streaming company''s (NYSE: SPOT) known office footprint. Same runtime identity safeguard and honest limitation as Wealthfront/Belvedere Trading/Tala.',
    '{"platform": "lever", "slug": "spotify", "company": "Spotify"}'::jsonb
  );
