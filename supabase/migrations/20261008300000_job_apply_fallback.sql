-- A fallback apply link for jobs whose own application link is broken.
--
-- Some employers publish a Greenhouse wrapper URL on their own careers site that is itself
-- misconfigured -- e.g. GSA Capital's https://www.gsacapital.com/careers/gh/?gh_jid=... returns 404
-- even in a browser -- while the job is live on Greenhouse and Greenhouse's own hosted application
-- page works. That page is predictable from data we already hold: the board slug (sources.config)
-- and the job's Greenhouse id (job_sources.source_job_id):
--   https://job-boards.greenhouse.io/embed/job_app?for=<slug>&token=<job id>
-- Members can't read `sources` or `job_sources`, so this returns just that URL for an active
-- Greenhouse-sourced job and nothing else. Both parts are public Greenhouse identifiers, and both
-- are validated against a strict pattern before being put in a URL.
--
-- Checked on 2026-10-03 against 25 broken-link jobs: it lands on a real application page for the
-- 3 that are genuinely live on Greenhouse, and on the company's generic board page for the rest
-- (which are closed jobs still awaiting expiry) -- so the UI offers it as "try this page",
-- only for links already flagged broken.
create or replace function job_apply_fallback(p_job_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select 'https://job-boards.greenhouse.io/embed/job_app?for=' || (s.config->>'slug') || '&token=' || js.source_job_id
  from jobs j
  join job_sources js on js.job_id = j.id
  join sources s on s.id = js.source_id
  where j.id = p_job_id
    and j.active
    and s.type = 'employer_api'
    and s.config->>'platform' = 'greenhouse'
    and s.config->>'slug' ~ '^[A-Za-z0-9_-]+$'
    and js.source_job_id ~ '^[0-9]+$'
  order by js.is_primary desc
  limit 1;
$$;

revoke all on function job_apply_fallback(uuid) from public, anon;
grant execute on function job_apply_fallback(uuid) to authenticated;
