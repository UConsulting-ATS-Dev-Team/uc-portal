-- Schedules fetch-lever-companies daily, same pg_cron + pg_net mechanism
-- every other scheduled fetcher uses (20260822140000 first enabled both
-- extensions). Next available slot after the four existing daily jobs
-- (13:17 greenhouse, 14:17 deloitte, 15:17 check-job-links, 16:17
-- snapshot-job-board) -- 17:17 UTC, so this still runs after every existing
-- ingestion/health/snapshot job that day rather than racing them.
select cron.schedule(
  'fetch-lever-companies-daily',
  '17 17 * * *', -- 17:17 UTC daily
  $$
  select net.http_post(
    url := 'https://sznzfvujohxlzlesfezi.supabase.co/functions/v1/fetch-lever-companies',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6bnpmdnVqb2h4bHpsZXNmZXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczNDkwMjgsImV4cCI6MjEwMjkyNTAyOH0.7m5XpTh9YMn-BLT0GgdIIpBW5iL1oaoLvxUWLPrXEe0'
    ),
    body := '{}'::jsonb
  );
  $$
);
