-- Closes a real gap flagged (but not built) in an earlier pass: the
-- existing access_requests_one_pending_per_email unique index
-- (20260914030000_rls_gap_fixes.sql) stops the same email from spamming
-- duplicate requests, but does nothing against many *different* fake
-- emails submitted rapidly from one source -- a real anonymous-insert
-- endpoint with no IP-based limiting at all. Low realistic risk for a
-- small club tool (documented as such at the time), but genuinely
-- buildable now with an Edge Function fronting the insert instead of a
-- direct client insert, so building it.
--
-- Not RLS-readable/writable by anyone (RLS enabled, zero policies --
-- default-deny) -- only the new submit-access-request Edge Function
-- touches this, via the service role, which bypasses RLS by design.
create table access_request_attempts (
  id uuid primary key default gen_random_uuid(),
  ip text not null,
  created_at timestamptz not null default now()
);
comment on table access_request_attempts is 'IP-based rate-limit log for the anonymous access-request endpoint. Written only by the submit-access-request Edge Function (service role) -- no client-facing RLS policy at all.';
alter table access_request_attempts enable row level security;

create index access_request_attempts_ip_created_idx on access_request_attempts (ip, created_at);

-- The direct anon-insert policy is removed now that the sanctioned path
-- is the rate-limited Edge Function (which inserts via the service role,
-- bypassing RLS entirely) -- leaving this policy in place would let a
-- scripted client bypass the new rate limit trivially by calling the
-- PostgREST endpoint directly instead of the Edge Function, defeating the
-- entire point of this change.
drop policy if exists "access_requests_insert_anon" on access_requests;
