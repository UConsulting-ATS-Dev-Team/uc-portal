-- Saved job searches follow the account instead of living only in one browser's localStorage. Same shape as saved_jobs: a member
-- reads, adds and removes only their own rows. `filters` is the Jobs page's filter object as the page already builds it.
create table saved_searches (
  id uuid primary key,
  member_id uuid not null references profiles(id) on delete cascade,
  label text not null,
  filters jsonb not null default '{}'::jsonb,
  saved_at timestamptz not null default now()
);
create index saved_searches_member_idx on saved_searches (member_id, saved_at desc);

alter table saved_searches enable row level security;
create policy "saved_searches_select_own" on saved_searches for select using (member_id = auth.uid());
create policy "saved_searches_insert_own" on saved_searches for insert with check (member_id = auth.uid());
create policy "saved_searches_update_own" on saved_searches for update using (member_id = auth.uid()) with check (member_id = auth.uid());
create policy "saved_searches_delete_own" on saved_searches for delete using (member_id = auth.uid());
grant select, insert, update, delete on saved_searches to authenticated;
