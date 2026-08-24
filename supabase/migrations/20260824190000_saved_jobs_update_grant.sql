-- Same base-privilege gap as 20260821150000_grants.sql and
-- 20260824150000_people_grants.sql found before: RLS alone doesn't grant
-- table-level access. Confirmed the same way -- a real upsert() against
-- saved_jobs failed with "permission denied for table saved_jobs" even
-- though the select/insert/delete grants and their matching RLS policies
-- all existed. Root cause: upsert's ON CONFLICT DO UPDATE path needs both
-- an UPDATE grant and a matching UPDATE policy, even when the caller only
-- ever inserts new rows in the common case -- the original migration
-- deliberately omitted UPDATE since saved_jobs' rows never change once
-- written (this is a presence-only table), but upsert still needs both to
-- exist for its conflict-handling branch, whether or not that branch ever
-- actually fires for a given call.
create policy "saved_jobs_update_own" on saved_jobs for update using (member_id = auth.uid());
grant update on public.saved_jobs to authenticated;
