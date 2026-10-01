-- Real persistence for Contribute-to-the-library's other 5 types
-- (Company guide, Resource/guide, Question, Event, Job posting) --
-- direct ask ("all those should persist and stay published"). Interview
-- write-up keeps its own existing, already-real path
-- (interview_writeups, tied into RealJobDetail.jsx's own real display) --
-- untouched here. Same "member-submitted, readable by all, own-row
-- write" shape as feed_posts/interview_writeups.
create table library_contributions (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  body text not null,
  company text,
  categories text[] not null default '{}',
  is_anonymous boolean not null default false,
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_by_name text,
  created_at timestamptz not null default now()
);

alter table library_contributions enable row level security;
create policy "library_contributions_select_authenticated" on library_contributions for select to authenticated using (true);
create policy "library_contributions_insert_own" on library_contributions for insert to authenticated with check (submitted_by = auth.uid());
create policy "library_contributions_update_own" on library_contributions for update to authenticated using (submitted_by = auth.uid());
create policy "library_contributions_delete_own" on library_contributions for delete to authenticated using (submitted_by = auth.uid());
