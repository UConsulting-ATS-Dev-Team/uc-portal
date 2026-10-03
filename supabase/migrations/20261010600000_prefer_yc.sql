-- "Prefer Y Combinator-backed companies": a member preference that adds a Y Combinator factor to their match
-- score (data/jobMatch.js). Off by default; only the member can change their own row (existing RLS).
alter table member_preferences
  add column if not exists prefer_yc boolean not null default false;
