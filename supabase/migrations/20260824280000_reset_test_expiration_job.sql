-- Resets the real Figma job used to verify 20260824270000's
-- mark_jobs_missed() state machine (missed_fetches counter -> potentially_
-- expired at 2 -> expired/inactive at 5, all confirmed correct live) back
-- to its genuine original state. Not actually expired -- this was a real,
-- currently-tracked posting borrowed for the test, not one the real
-- Greenhouse feed has ever stopped returning.
update jobs
set missed_fetches = 0, status = 'active', active = true, updated_at = now()
where id = '275821a7-101f-4402-afd6-7fb06a1312b8';
