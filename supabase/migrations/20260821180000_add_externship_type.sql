-- Adds "externship" to employment_type -- needed to seed the EY-Parthenon
-- spring-week job from the mock data (data/mockJobs.js) accurately; none of
-- the existing values (internship/full_time/part_time/fellowship/co_op/
-- apprenticeship) fit a multi-day recruiting event. Kept as its own
-- migration/statement: Postgres doesn't allow a new enum value to be used
-- in the same transaction that added it, so this has to land and commit
-- before the seed data in 20260821190000 references it.

alter type employment_type add value if not exists 'externship';
