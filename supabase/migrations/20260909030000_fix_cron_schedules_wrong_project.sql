-- This project (uc-portal, ref cfwbtzajnaodgqilgkqn) was provisioned by
-- pushing the full existing migration history onto it via `supabase db
-- push`. That history's 6 scheduling migrations (fetch-greenhouse-*,
-- fetch-deloitte-jobs, check-job-links, snapshot-job-board,
-- fetch-lever-companies) each hardcode a specific project's URL and anon
-- key into their `net.http_post` call -- correct for the personal project
-- they were originally written against (ref sznzfvujohxlzlesfezi), but now
-- silently wrong here: applying them verbatim left this project's pg_cron
-- calling out to a *different* Supabase project's Edge Functions instead
-- of its own, so none of this project's own scheduled ingestion would ever
-- actually run.
--
-- Rather than edit that already-applied history (this repo's own
-- convention is corrective follow-up migrations, e.g.
-- 20260824220000_fix_imc_company_name.sql), this re-points the 5 jobs that
-- are actually still active today (one of the original 6,
-- fetch-greenhouse-stripe-daily, was already unscheduled and replaced by
-- fetch-greenhouse-companies-daily later in the same history) at THIS
-- project's own URL and anon key. Anon key embedded here is this project's
-- own, not a secret -- same reasoning as the original migrations' comments
-- (it's already public in this app's frontend bundle; the Edge Function
-- itself does privileged work with its own injected service role key).
select cron.unschedule('fetch-greenhouse-companies-daily');
select cron.unschedule('fetch-deloitte-jobs-daily');
select cron.unschedule('check-job-links-daily');
select cron.unschedule('snapshot-job-board-daily');
select cron.unschedule('fetch-lever-companies-daily');

select cron.schedule(
  'fetch-greenhouse-companies-daily',
  '17 13 * * *',
  $$
  select net.http_post(
    url := 'https://cfwbtzajnaodgqilgkqn.supabase.co/functions/v1/fetch-greenhouse-companies',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmd2J0emFqbmFvZGdxaWxna3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MTk3NTQsImV4cCI6MjEwNDQ5NTc1NH0.pMdJ5vEZXrBaVQqkqXJycjGVOF116hTvusYUsagSc7w'
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'fetch-deloitte-jobs-daily',
  '17 14 * * *',
  $$
  select net.http_post(
    url := 'https://cfwbtzajnaodgqilgkqn.supabase.co/functions/v1/fetch-deloitte-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmd2J0emFqbmFvZGdxaWxna3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MTk3NTQsImV4cCI6MjEwNDQ5NTc1NH0.pMdJ5vEZXrBaVQqkqXJycjGVOF116hTvusYUsagSc7w'
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'check-job-links-daily',
  '17 15 * * *',
  $$
  select net.http_post(
    url := 'https://cfwbtzajnaodgqilgkqn.supabase.co/functions/v1/check-job-links',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmd2J0emFqbmFvZGdxaWxna3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MTk3NTQsImV4cCI6MjEwNDQ5NTc1NH0.pMdJ5vEZXrBaVQqkqXJycjGVOF116hTvusYUsagSc7w'
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'snapshot-job-board-daily',
  '17 16 * * *',
  $$
  select net.http_post(
    url := 'https://cfwbtzajnaodgqilgkqn.supabase.co/functions/v1/snapshot-job-board',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmd2J0emFqbmFvZGdxaWxna3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MTk3NTQsImV4cCI6MjEwNDQ5NTc1NH0.pMdJ5vEZXrBaVQqkqXJycjGVOF116hTvusYUsagSc7w'
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'fetch-lever-companies-daily',
  '17 17 * * *',
  $$
  select net.http_post(
    url := 'https://cfwbtzajnaodgqilgkqn.supabase.co/functions/v1/fetch-lever-companies',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmd2J0emFqbmFvZGdxaWxna3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MTk3NTQsImV4cCI6MjEwNDQ5NTc1NH0.pMdJ5vEZXrBaVQqkqXJycjGVOF116hTvusYUsagSc7w'
    ),
    body := '{}'::jsonb
  );
  $$
);
