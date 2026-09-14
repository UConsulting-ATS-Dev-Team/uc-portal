-- Removes the synthetic test row created while live-verifying the new
-- roster-gating flow (real "Request access" submission from a browser test
-- against a fake @example.com address) -- not a real person's request,
-- shouldn't sit in the admin's real queue.
delete from access_requests where email = 'totally-random-person-9182@example.com';
