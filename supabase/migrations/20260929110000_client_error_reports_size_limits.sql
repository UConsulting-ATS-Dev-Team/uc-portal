-- Real gap found in a security pass, 2026-09-28: client_error_reports
-- accepts an anonymous insert by design (a crash can happen before any
-- session exists -- see this table's own creation migration), but had
-- zero server-side size enforcement. data/errorReporting.js already
-- truncates message to 2000 chars and stack to 8000 before sending, but
-- that's a client-side courtesy only -- the anon key it uses is
-- necessarily public (embedded in the shipped frontend bundle), so
-- anyone calling the REST API directly, bypassing the frontend entirely,
-- could insert arbitrarily large payloads with the only real gate being
-- "message is not null and length(trim(message)) > 0" -- trivially true
-- for almost anything. Adds DB-level CHECK constraints mirroring the
-- frontend's own already-chosen limits (2000/8000) plus reasonable caps
-- on the three other free-text columns, so the real enforcement lives at
-- the data layer, not just in code a hostile caller can skip.
--
-- Deliberately not a full IP-based rate limiter (the pattern
-- submit-access-request's own Edge Function uses) -- error reports carry
-- no real club-membership stakes the way access requests do, and this
-- project's own established judgment (see that table's migration
-- comment) is to reach for that heavier infrastructure only when the
-- actual risk profile justifies it. A size cap closes the real, obvious
-- abuse vector (unbounded storage growth from a single oversized or
-- repeated-junk payload) without adding a new moving part for a
-- low-stakes, low-realistic-volume table.
alter table client_error_reports
  add constraint client_error_reports_message_length check (length(message) <= 2000),
  add constraint client_error_reports_stack_length check (stack is null or length(stack) <= 8000),
  add constraint client_error_reports_page_path_length check (page_path is null or length(page_path) <= 500),
  add constraint client_error_reports_user_agent_length check (user_agent is null or length(user_agent) <= 500),
  add constraint client_error_reports_context_length check (length(context) <= 200);
