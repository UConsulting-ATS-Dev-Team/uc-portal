-- Removes the fabricated test fixture used to verify resolve-duplicate-
-- candidate's new field-level merge logic (US-19) end-to-end through the
-- real Edge Function as an authenticated admin -- confirmed live: the kept
-- job correctly backfilled its missing description/salary_min from the
-- duplicate, correctly kept its own non-null city rather than being
-- overwritten, correctly unioned required_skills, and the duplicate was
-- correctly deactivated. Not real data -- delete all of it.
delete from duplicate_candidates where id = '33333333-3333-3333-3333-333333333333';
delete from jobs where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
