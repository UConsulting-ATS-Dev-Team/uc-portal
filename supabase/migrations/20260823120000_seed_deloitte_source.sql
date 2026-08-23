-- Stage 4's first additional automated source, per JOB_ENGINE_ARCHITECTURE.md
-- Part 7. See supabase/functions/fetch-deloitte-jobs/index.ts's header
-- comment for the full comparison against BCG (schema.org present, but its
-- search page is a client-rendered SPA with no enumeration mechanism) and
-- Accenture (a clean Workday JSON endpoint, but an undocumented internal
-- one, the weakest legal footing of the three).

insert into sources (name, type, authorization_status, api_available, rate_limits, attribution_required, storage_restrictions, redistribution_restricted, notes)
values (
  'Deloitte (Careers RSS Feed)',
  'feed',
  'approved',
  true,
  'Each keyword feed is hard-capped at 20 results by Deloitte''s own endpoint -- confirmed live that jobRecordsPerPage/jobOffset have no effect. Polled once daily via pg_cron across a small fixed keyword list (consultant/strategy/analyst), well within any reasonable rate expectation.',
  false,
  'Do not store full job description text. The JobPosting schema.org description field is real content Deloitte itself publishes as structured data, but this adapter stays conservative and consistent with every other source in this app -- only structured facts (title, location, employment type, dates) are stored. application_url is the link-out path to the full posting.',
  false,
  'RSS 2.0 feed at apply.deloitte.com/en_US/careers/SearchJobs/{keyword}/feed/ (Content-Type: text/xml) -- a format that exists specifically for third-party syndication by decades-old convention, matching Part 2''s "RSS/XML/JSON feeds explicitly published for reuse" category. Categorically different legal posture than scraping the HTML search-results page sitting next to it, which this adapter never touches. Each linked job detail page separately embeds schema.org JobPosting JSON-LD for structured facts. See JOB_ENGINE_ARCHITECTURE.md Part 7''s Stage 4 entry for the full writeup, including the real confidence difference from Stripe/Greenhouse''s exhaustive feed (this one is capped at 20 most-relevant results per keyword, so the usual "absent from today''s fetch = expired" freshness signal does not apply here and is deliberately skipped).'
);
