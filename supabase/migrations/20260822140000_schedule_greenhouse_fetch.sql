-- Schedules the Stage 3 Greenhouse/Stripe fetch to run once daily via
-- Supabase's pg_cron + pg_net extensions -- pg_cron triggers on a cron
-- schedule from inside Postgres itself, pg_net makes the actual HTTP call
-- to the deployed Edge Function without needing any external scheduler.
--
-- The Authorization header uses the anon key, not the service role key --
-- the anon key is not a secret (it's already shipped in this app's public
-- frontend bundle, see data/supabaseClient.js's own comment), so embedding
-- it here is no new exposure. The Edge Function itself does all its actual
-- privileged reads/writes with its own SUPABASE_SERVICE_ROLE_KEY, injected
-- automatically by the Edge Functions runtime -- this header only needs to
-- pass the platform's baseline JWT check to reach the function at all.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'fetch-greenhouse-stripe-daily',
  '17 13 * * *', -- 13:17 UTC daily -- off-the-hour so it doesn't stack with other projects' on-the-hour jobs
  $$
  select net.http_post(
    url := 'https://sznzfvujohxlzlesfezi.supabase.co/functions/v1/fetch-greenhouse-stripe',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6bnpmdnVqb2h4bHpsZXNmZXppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczNDkwMjgsImV4cCI6MjEwMjkyNTAyOH0.7m5XpTh9YMn-BLT0GgdIIpBW5iL1oaoLvxUWLPrXEe0'
    ),
    body := '{}'::jsonb
  );
  $$
);
