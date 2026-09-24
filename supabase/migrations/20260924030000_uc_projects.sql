-- Real self-reported UC project history -- direct ask, from the original
-- MVP notes ("track past uc projects as well"): a place for members to
-- record which UC-affiliated projects they've worked on (case
-- competitions, pro-bono consulting engagements, committee/internal
-- projects, client work), for the club's own long-term institutional
-- memory. Same shape as work_history (20260916010000) -- authenticated-
-- read (the whole point is other members/future exec being able to look
-- back at what UC has actually done over the years), own-row write.
--
-- category is a real, constrained vocabulary (not free text) since the
-- stated goal is long-term tracking, not just a personal scratchpad --
-- free text would drift into inconsistent, hard-to-aggregate values over
-- a few years of member input.
create table uc_projects (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  category text not null default 'Other' check (category in ('Case competition', 'Pro-bono consulting', 'Client project', 'Committee project', 'Other')),
  organization text, -- the client/partner/competition name, if applicable -- optional, not every project has one
  semester text, -- free text ("Fall 2026") -- matches member_preferences.recruiting_cycle's own free-text convention
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table uc_projects is 'Self-reported past UC-affiliated projects, for the club''s own long-term institutional tracking -- never scraped or inferred, only what a member records themselves.';

alter table uc_projects enable row level security;
create policy "uc_projects_select_authenticated" on uc_projects for select using (auth.role() = 'authenticated');
create policy "uc_projects_insert_own" on uc_projects for insert with check (profile_id = auth.uid());
create policy "uc_projects_update_own" on uc_projects for update using (profile_id = auth.uid());
create policy "uc_projects_delete_own" on uc_projects for delete using (profile_id = auth.uid());
