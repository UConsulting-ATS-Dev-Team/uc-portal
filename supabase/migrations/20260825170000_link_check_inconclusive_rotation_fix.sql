-- Real bug found live: check-job-links' candidate query prioritizes
-- link_check_failures desc, then last_link_checked_at asc nulls-first, so
-- an "inconclusive" result (persistent 403, e.g. every Carvana posting
-- behind Cloudflare's bot challenge -- confirmed live, ~1,474 of ~3,300
-- total active jobs) that never touches last_link_checked_at stays
-- indistinguishable from a genuinely never-checked row forever. Confirmed
-- by three consecutive real invocations: inconclusiveBlocked climbed
-- 26 -> 167 -> 182 -> 225 as Carvana's bot-blocked jobs kept winning the
-- same "checked_at IS NULL" tier every single run instead of rotating out
-- -- at that rate, the ~1,800 genuinely-never-checked jobs behind Carvana
-- in the queue would rarely get a turn at all, defeating the whole
-- rotation design 20260825110000's own comment describes.
--
-- Fix: an inconclusive result still counts as "we attempted a check this
-- run" for scheduling purposes, even though it's not evidence either way
-- for link_health -- same distinction §3.4 already draws between "did we
-- run a check" and "what did the check conclude." Replaces the two-array
-- mark_link_check_results with a three-array version; the third array
-- only touches last_link_checked_at (and updated_at), never
-- link_health/link_check_failures, so an inconclusive result still can't
-- accidentally count toward or clear the broken-threshold counter -- it
-- just stops crowding every future run's priority queue.
drop function mark_link_check_results(uuid[], uuid[]);

create or replace function mark_link_check_results(ok_ids uuid[], failed_ids uuid[], inconclusive_ids uuid[])
returns void as $$
  update jobs
  set link_health = 'ok', link_check_failures = 0, last_link_checked_at = now(), updated_at = now()
  where id = any(ok_ids);

  update jobs
  set
    link_check_failures = jobs.link_check_failures + 1,
    link_health = case when jobs.link_check_failures + 1 >= 3 then 'broken'::link_health_status else jobs.link_health end,
    last_link_checked_at = now(),
    updated_at = now()
  where id = any(failed_ids);

  update jobs
  set last_link_checked_at = now(), updated_at = now()
  where id = any(inconclusive_ids);
$$ language sql;

revoke all on function mark_link_check_results(uuid[], uuid[], uuid[]) from public, anon, authenticated;
grant execute on function mark_link_check_results(uuid[], uuid[], uuid[]) to service_role;
