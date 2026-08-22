-- Stage 3 pilot source (JOB_ENGINE_ARCHITECTURE.md Part 7): the first
-- automated job source, gated through §3.7's registry exactly like every
-- other source. Chosen after checking all 8 companies in the current mock
-- data for a legitimate, structured, no-login path -- Stripe/Greenhouse was
-- the one confirmed against Greenhouse's own developer docs
-- (developers.greenhouse.io/job-board.html): "no permission needed... data
-- each customer has chosen to publish on their careers page... build
-- custom career and application sites" -- an explicit third-party
-- integration point, not an inferred one. MBB/Deloitte/Accenture each have
-- their own structured-data story (BCG/Deloitte: schema.org JobPosting;
-- Accenture: an internal Workday endpoint with a murkier "intended for
-- third parties" case; Bain/McKinsey/Goldman/EY-Parthenon: nothing usable)
-- but none as clean as Greenhouse's documented API, so this is the pilot,
-- per Part 5's "one employer ATS adapter, reviewed and piloted
-- individually" recommendation -- not a statement that the others are
-- ruled out, just not first.

insert into sources (name, type, authorization_status, api_available, rate_limits, attribution_required, storage_restrictions, redistribution_restricted, notes)
values (
  'Stripe (Greenhouse Job Board API)',
  'employer_api',
  'approved',
  true,
  'Polled once daily via pg_cron. Greenhouse publishes no hard rate limit on this endpoint but advises against per-page-view polling; daily is well under that.',
  false,
  'Do not store full job description text. The adapter (supabase/functions/fetch-greenhouse-stripe) never requests it (no ?content=true param) -- Greenhouse''s API terms cover API use, not a copyright license from Stripe over the posting text itself. application_url is the link-out path to the full posting.',
  false,
  'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/stripe/jobs, confirmed against Greenhouse''s own developer documentation as an intended third-party integration point (not scraping, not an undocumented internal endpoint). See JOB_ENGINE_ARCHITECTURE.md Part 7''s Stage 3 entry for the full comparison against the other 7 mock companies.'
);
