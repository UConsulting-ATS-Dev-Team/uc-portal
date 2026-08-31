-- Schedules snapshot-job-board daily, same pg_cron + pg_net mechanism every
-- other scheduled function uses (20260822140000 first enabled both
-- extensions). Deliberately the last of the four daily jobs (13:17
-- greenhouse, 14:17 deloitte, 15:17 check-job-links, this one at 16:17) --
-- running after both ingestion fetchers AND the link-health checker means
-- each day's snapshot reflects that day's fully-settled board (freshly
-- inserted/refreshed/expired jobs, freshly-checked link health), not a
-- partial state from earlier in the day's cron sequence.
select cron.schedule(
  'snapshot-job-board-daily',
  '17 16 * * *', -- 16:17 UTC daily
  $$
  select net.http_post(
    url := 'https://sznzfvujohxlzlesfezi.supabase.co/functions/v1/snapshot-job-board',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6bnpmdnVqb2h4bHpsZXNmZXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczNDkwMjgsImV4cCI6MjEwMjkyNTAyOH0.7m5XpTh9YMn-BLT0GgdIIpBW5iL1oaoLvxUWLPrXEe0'
    ),
    body := '{}'::jsonb
  );
  $$
);
