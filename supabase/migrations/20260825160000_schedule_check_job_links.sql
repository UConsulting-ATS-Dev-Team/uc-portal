-- Schedules check-job-links daily, same pg_cron + pg_net mechanism every
-- other scheduled fetcher uses (20260822140000 first enabled both
-- extensions). Offset an hour past fetch-deloitte-jobs (14:17 UTC) so the
-- three scheduled jobs don't compete for resources at the same moment --
-- running after the day's ingestion fetchers also means link checks that
-- day include whatever they just inserted/refreshed, not stale data from
-- before it.
select cron.schedule(
  'check-job-links-daily',
  '17 15 * * *', -- 15:17 UTC daily
  $$
  select net.http_post(
    url := 'https://sznzfvujohxlzlesfezi.supabase.co/functions/v1/check-job-links',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6bnpmdnVqb2h4bHpsZXNmZXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczNDkwMjgsImV4cCI6MjEwMjkyNTAyOH0.7m5XpTh9YMn-BLT0GgdIIpBW5iL1oaoLvxUWLPrXEe0'
    ),
    body := '{}'::jsonb
  );
  $$
);
