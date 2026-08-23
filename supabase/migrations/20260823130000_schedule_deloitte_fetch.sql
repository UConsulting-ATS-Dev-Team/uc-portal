-- Schedules fetch-deloitte-jobs daily, same mechanism as
-- 20260822140000_schedule_greenhouse_fetch.sql (pg_cron + pg_net, already
-- enabled by that migration). Offset by an hour from the Greenhouse job so
-- the two scheduled fetches don't compete for resources at the same moment.

select cron.schedule(
  'fetch-deloitte-jobs-daily',
  '17 14 * * *', -- 14:17 UTC daily
  $$
  select net.http_post(
    url := 'https://sznzfvujohxlzlesfezi.supabase.co/functions/v1/fetch-deloitte-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6bnpmdnVqb2h4bHpsZXNmZXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczNDkwMjgsImV4cCI6MjEwMjkyNTAyOH0.7m5XpTh9YMn-BLT0GgdIIpBW5iL1oaoLvxUWLPrXEe0'
    ),
    body := '{}'::jsonb
  );
  $$
);
