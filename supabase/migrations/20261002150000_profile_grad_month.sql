-- Real ask: not everyone graduates in June, and how far a member actually
-- is from graduating can meaningfully affect which roles make sense to
-- recommend (an internship fits someone a year+ out; a full-time new-grad
-- role fits someone a few months out) -- class_year alone can't express
-- that. grad_month is nullable (most real members haven't set one yet,
-- same as class_year itself) and only ever feeds a soft match-scoring
-- signal, never a hard eligibility gate -- real job postings only ever
-- state eligible graduation YEARS (jobs.graduation_years), never a month,
-- so there's nothing on the job side to hard-match a month against.
alter table profiles add column grad_month smallint check (grad_month between 1 and 12);
