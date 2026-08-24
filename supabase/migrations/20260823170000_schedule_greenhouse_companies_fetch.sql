-- Replaces the Stripe-specific cron job with one pointing at the new
-- generic fetch-greenhouse-companies function, which now handles all 7
-- configured Greenhouse companies in a single scheduled run.

select cron.unschedule('fetch-greenhouse-stripe-daily');

select cron.schedule(
  'fetch-greenhouse-companies-daily',
  '17 13 * * *', -- same time slot the old Stripe-only job used
  $$
  select net.http_post(
    url := 'https://sznzfvujohxlzlesfezi.supabase.co/functions/v1/fetch-greenhouse-companies',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6bnpmdnVqb2h4bHpsZXNmZXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczNDkwMjgsImV4cCI6MjEwMjkyNTAyOH0.7m5XpTh9YMn-BLT0GgdIIpBW5iL1oaoLvxUWLPrXEe0'
    ),
    body := '{}'::jsonb
  );
  $$
);
