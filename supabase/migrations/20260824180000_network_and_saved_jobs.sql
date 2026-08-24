-- Syncs the last two pieces of data/store.jsx still local-only after
-- preferences and the tracker went real (see JOB_ENGINE_ARCHITECTURE.md's
-- Stage 5 entry): savedConnections/coffeeChatStatus (Network) and
-- savedJobIds (Jobs board). Same member-only RLS shape as
-- tracked_applications -- no admin bypass, this is personal interaction
-- data with no stated admin use case, same conservative default the rest
-- of this stage has used.

-- One row per (member, person) rather than two tables -- "did I save this
-- person" and "what's my coffee-chat status with them" are both just
-- "this member's relationship to that person," the same reasoning that
-- folded trackedJobs/prepLogged/timelineShiftDays into one
-- tracked_applications row per application instead of three tables.
create table network_connections (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references auth.users(id) on delete cascade,
  person_id text not null, -- real person = uuid, still-mock person = a slug like "sana-liu"
  saved boolean not null default false,
  coffee_chat_status text,
  updated_at timestamptz not null default now(),
  unique (member_id, person_id)
);

alter table network_connections enable row level security;
create policy "network_connections_select_own" on network_connections for select using (member_id = auth.uid());
create policy "network_connections_insert_own" on network_connections for insert with check (member_id = auth.uid());
create policy "network_connections_update_own" on network_connections for update using (member_id = auth.uid());

grant select, insert, update on public.network_connections to authenticated;

-- Saved jobs are member-to-job, a different relationship than member-to-
-- person -- its own table. Presence-based (a row exists iff the job is
-- saved), so insert-on-save/delete-on-unsave rather than a boolean column
-- -- there's no other per-saved-job attribute to carry, unlike
-- network_connections' two independent fields.
create table saved_jobs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references auth.users(id) on delete cascade,
  job_id text not null, -- real job = uuid, still-mock job = a slug
  saved_at timestamptz not null default now(),
  unique (member_id, job_id)
);

alter table saved_jobs enable row level security;
create policy "saved_jobs_select_own" on saved_jobs for select using (member_id = auth.uid());
create policy "saved_jobs_insert_own" on saved_jobs for insert with check (member_id = auth.uid());
create policy "saved_jobs_delete_own" on saved_jobs for delete using (member_id = auth.uid());

grant select, insert, delete on public.saved_jobs to authenticated;
