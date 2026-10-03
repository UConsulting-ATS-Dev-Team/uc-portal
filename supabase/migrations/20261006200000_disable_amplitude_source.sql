-- Amplitude's Greenhouse job board no longer exists: boards-api.greenhouse.io/v1/boards/amplitude/jobs
-- returns 404 (rechecked repeatedly), and every one of its jobs' application links redirects
-- to an error page ("job-boards.greenhouse.io/amplitude?error=true"), even in a browser.
-- It was the only dead board among all 171 enabled Greenhouse and Lever sources (probed on
-- 2026-10-03).
--
-- With the board gone the fetcher fails on every run, and -- because a failed fetch never marks
-- jobs missed -- its 16 jobs would otherwise stay active forever. Disable the source (the
-- fetchers skip disabled sources) and expire the jobs it tracked. Nothing is deleted; if
-- Amplitude moves to another ATS, add a new source for it.
update jobs
   set active = false, status = 'expired', updated_at = now()
 where active
   and id in (
     select js.job_id
       from job_sources js
       join sources s on s.id = js.source_id
      where s.config->>'platform' = 'greenhouse' and s.config->>'slug' = 'amplitude'
   );

update sources
   set enabled = false
 where type = 'employer_api'
   and config->>'platform' = 'greenhouse'
   and config->>'slug' = 'amplitude';
