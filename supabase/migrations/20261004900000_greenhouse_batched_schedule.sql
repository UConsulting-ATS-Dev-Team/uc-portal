-- Replace the once-a-day, all-companies Greenhouse run with a batched one.
--
-- The old job called fetch-greenhouse-companies once a day with no body, so a
-- single invocation had to process all ~160 companies. With ~11k active jobs
-- that exceeds the Edge Function resource limit and the run is killed after
-- logging only the few companies that happened to finish first -- by
-- 2026-10-03, 138 of 160 sources had not been fetched in 2-3+ weeks, which
-- also meant no expiry and no per-company cap enforcement for them.
--
-- Now: every 2 hours, process the 14 least-recently-fetched companies
-- (oldest_fetched_sources()). 12 runs x 14 = 168 >= the ~161 enabled sources,
-- so each company is refreshed about once a day -- which keeps the "5
-- consecutive missed fetches" expiry rule meaning roughly five days, as
-- designed. A 14-company run was measured at a few seconds in total.
--
-- Same auth as the other scheduled functions: the cron secret comes from
-- Vault by name (never the plaintext), the anon key is the public one already
-- present in every earlier cron migration.
select cron.unschedule('fetch-greenhouse-companies-daily');

select cron.schedule(
  'fetch-greenhouse-companies-batch',
  '17 */2 * * *',
  $$
  select net.http_post(
    url := 'https://cfwbtzajnaodgqilgkqn.supabase.co/functions/v1/fetch-greenhouse-companies',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmd2J0emFqbmFvZGdxaWxna3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MTk3NTQsImV4cCI6MjEwNDQ5NTc1NH0.pMdJ5vEZXrBaVQqkqXJycjGVOF116hTvusYUsagSc7w',
      'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{"batch": 14}'::jsonb
  );
  $$
);
