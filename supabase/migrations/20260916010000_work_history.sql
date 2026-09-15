-- Real self-reported work history -- the legitimate version of "alumni
-- LinkedIn tracker": automatically finding/scraping alumni LinkedIn
-- profiles is off the table (LinkedIn's ToS explicitly prohibits
-- automated collection, already this project's own established policy --
-- see JOB_ENGINE_ARCHITECTURE.md). This is the honest alternative: a
-- member or alumnus voluntarily lists their own past employers, so other
-- members can see real referral/insight signal before applying somewhere.
-- Readable by any authenticated member (the whole point is cross-member
-- visibility), writable only by its own owner.
create table work_history (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  company text not null,
  role text,
  start_year integer,
  end_year integer, -- null = current/ongoing
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table work_history is 'Self-reported past employers (real people, real consent) -- never scraped or auto-populated from LinkedIn or any other external source.';

alter table work_history enable row level security;
create policy "work_history_select_authenticated" on work_history for select using (auth.role() = 'authenticated');
create policy "work_history_insert_own" on work_history for insert with check (profile_id = auth.uid());
create policy "work_history_update_own" on work_history for update using (profile_id = auth.uid());
create policy "work_history_delete_own" on work_history for delete using (profile_id = auth.uid());

-- Real payoff stat shown back to the person who just added an entry (the
-- incentive to actually do this, given self-report participation can't be
-- guaranteed) -- "N members are interested in [Company]" from real
-- member_preferences.followed_companies data, the same real signal
-- company_demand_report() already aggregates for admins. This is a
-- narrower, non-admin-gated version: any authenticated member can look up
-- the count for one company (never the members themselves, just a
-- count) -- same "security definer fixes the return shape so no query can
-- get identity back out" principle that function's own comment documents.
create or replace function company_interest_count(target_company text)
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select count(*)
  from member_preferences, unnest(followed_companies) as c
  where lower(trim(c)) = lower(trim(target_company));
$$;

grant execute on function company_interest_count(text) to authenticated;

-- Real "who's worked here" for Job Detail / Company Page -- resolves a
-- real display name per entry the same way list_recent_signups()/
-- member_engagement_report() already do (people-email match, then
-- profiles.full_name, then the account's own email local-part), since
-- profiles has no email column and auth.users isn't reachable via
-- PostgREST directly. work_history's own SELECT policy already lets any
-- authenticated member read the raw rows -- this exists specifically to
-- resolve a real name/company match without a second round trip per row.
create or replace function list_work_history_at_company(target_company text)
returns table (profile_id uuid, display_name text, role text, start_year integer, end_year integer)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return query
    select
      wh.profile_id,
      coalesce(
        nullif(p_dir.name, ''),
        nullif(pr.full_name, ''),
        split_part(u.email::text, '@', 1)
      ) as display_name,
      wh.role,
      wh.start_year,
      wh.end_year
    from work_history wh
    join auth.users u on u.id = wh.profile_id
    join profiles pr on pr.id = wh.profile_id
    left join people p_dir on lower(trim(p_dir.email)) = lower(trim(u.email::text))
    where lower(trim(wh.company)) = lower(trim(target_company))
    order by wh.end_year is null desc, wh.end_year desc nulls first, wh.start_year desc nulls last;
end;
$$;

grant execute on function list_work_history_at_company(text) to authenticated;
