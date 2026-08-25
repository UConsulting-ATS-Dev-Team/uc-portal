-- Part 10 / US-26 -- the member-side half of skill matching. Job-side skill
-- inference (required_skills, via occupationTaxonomy.ts's skillsForOccupation())
-- has existed since Stage 1, but nothing existed on the member profile to
-- match it against until now -- server/src/match.ts's own skills factor
-- (weight 15/100) has always read profile.skills, just against a field the
-- real preferences object never had. Same table-level grants as every other
-- column here already cover this (member_preferences_update_own's RLS
-- policy and the table-level GRANT aren't column-scoped).
alter table member_preferences
  add column skills text[] not null default '{}';
