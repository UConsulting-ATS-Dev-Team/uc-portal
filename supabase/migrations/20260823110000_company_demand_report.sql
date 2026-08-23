-- Surfaces real member demand for companies not yet supported, to replace
-- guesswork (manually researching an arbitrary company list) with an actual
-- signal for which company to research next for Stage 3/4 adapter work.
--
-- member_preferences.followed_companies already holds this data (members
-- can follow any company name, not just the seeded 8 -- Onboarding's
-- StepCompanies already supported free-text follows; MyProfile's Career
-- preferences tab gained the same in this same change), but there's no way
-- to read it in aggregate: member_preferences RLS only grants each member
-- their own row (member_preferences_select_own), by deliberate design --
-- CLAUDE.md and this table's own migration comment are both explicit that
-- admins see aggregate signal only, never raw per-member preference rows.
--
-- A security definer function is what actually enforces that boundary,
-- not just documents it (same spirit as is_admin() and the source registry
-- kill-switch): it can read every row internally, but its RETURN shape is
-- fixed to company/count pairs, so there is no query an admin can construct
-- against this function that gets a member's identity back out -- unlike an
-- RLS policy opening raw table access, which would depend on every future
-- query being written carefully.
--
-- known_companies is passed in by the caller (data/careerOptions.js's
-- COMPANIES list) rather than hardcoded here, so this function doesn't need
-- a migration every time that list changes -- it stays a pure "count
-- follows not in this list" utility.

create or replace function company_demand_report(known_companies text[])
returns table (company text, follower_count bigint)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not is_admin() then
    raise exception 'admin access required';
  end if;

  return query
    select trim(c) as company, count(*) as follower_count
    from member_preferences, unnest(followed_companies) as c
    where trim(c) <> '' and not (trim(c) = any(known_companies))
    group by trim(c)
    order by follower_count desc, company asc;
end;
$$;

grant execute on function company_demand_report(text[]) to authenticated;
