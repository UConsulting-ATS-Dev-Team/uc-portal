-- Removes the test feature request created while verifying the full
-- pending -> approved -> in_progress -> done workflow end to end. Left as
-- "done" it would misrepresent status -- no such filter feature was
-- actually built -- so it's cleaned up rather than left as a fake record,
-- same practice as every other test-data cleanup this session.

delete from feature_requests
where title = 'Let me filter jobs by application deadline range';
