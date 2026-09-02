-- Marqeta's Greenhouse board (boards-api.greenhouse.io/v1/boards/marqeta)
-- now 404s outright, confirmed via scripts/check-company-source.mjs and
-- direct curl against every plausible slug variant -- not a transient
-- outage or a slug rename, no usable ATS signal found anywhere on their
-- real careers page either. This isn't a per-job link failure
-- (check-job-links' territory) -- the whole source is gone, so
-- fetch-greenhouse-companies has no list to reconcile against at all.
--
-- Disable the source (the real §3.7 kill-switch -- no redeploy needed,
-- SourceManagement.jsx already surfaces this) so the daily cron stops
-- repeatedly hitting a dead endpoint, and deactivate the 2 remaining
-- active Marqeta postings, since they're now unverifiable (not
-- confirmed-broken links per se, but no longer confirmable as still-open
-- either) rather than leaving them showing as active indefinitely with
-- no path to ever re-verify them.
update sources
set enabled = false,
    authorization_status = 'disabled',
    notes = coalesce(notes || E'\n\n', '') || '2026-09-01: Greenhouse board 404s on every plausible slug (marqeta, marqetainc, marqeta-inc); real careers page (marqeta.com/careers) shows no detectable ATS signal. Company likely migrated off Greenhouse. Disabled rather than left silently failing daily.'
where config->>'slug' = 'marqeta' and config->>'platform' = 'greenhouse';

update jobs
set active = false, status = 'removed'
where company = 'Marqeta' and active = true;
