-- Closes the two minor RLS gaps flagged in the pre-production audit
-- (neither blocked a shipped feature -- the frontend never calls
-- update/delete on either table today, confirmed by grepping
-- data/*.js -- but a member should be able to correct or remove their
-- own submitted content, same "own row" convention every other
-- member-owned table in this app already follows).

-- interview_writeups: insert-only until now. Adds update/delete scoped to
-- the submitter's own row, matching e.g. tracked_applications'
-- member-owns-their-row shape.
create policy "interview_writeups_update_own" on interview_writeups for update using (submitted_by = auth.uid());
create policy "interview_writeups_delete_own" on interview_writeups for delete using (submitted_by = auth.uid());
grant update, delete on public.interview_writeups to authenticated;

-- network_connections: had select/insert/update but no delete -- "saved"
-- is a boolean today (unsaving already works via update), but a member
-- has no way to remove a connection row entirely (e.g. a stale
-- coffee_chat_status with no real relationship left). Own-row delete,
-- same convention as saved_jobs' identical member-to-X table.
create policy "network_connections_delete_own" on network_connections for delete using (member_id = auth.uid());
grant delete on public.network_connections to authenticated;

-- access_requests: the anonymous-insert policy had no anti-abuse
-- protection at all (noted as a known limitation in
-- 20260913010000_roster_gating.sql). True rate limiting (by IP, by
-- burst) isn't something plain RLS can do -- there's no client-IP context
-- available to a Postgres policy without extra infrastructure (a
-- fronting Edge Function), which is more than this small club tool's
-- realistic risk profile justifies right now. What a partial unique
-- index *can* cheaply and genuinely close: the same email spamming
-- multiple pending requests (accidental double-submit, or someone
-- repeatedly clicking "Request access"), which would otherwise pile up
-- as duplicate rows in the admin queue. Scoped to status = 'pending' only
-- -- once a request is approved/declined, that same email can submit a
-- fresh one later (e.g. a declined request reconsidered, or a roster
-- entry that later lapsed) without being blocked by their own history.
create unique index access_requests_one_pending_per_email
  on access_requests (lower(trim(email)))
  where status = 'pending';
