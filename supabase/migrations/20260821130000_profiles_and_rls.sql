-- Member profiles + Row Level Security for every table from the initial
-- schema. This is a private, members-only platform (CLAUDE.md's "Purpose"
-- section) -- nothing here should be reachable by an unauthenticated client
-- beyond taxonomy lookups needed for a filter UI. A table with RLS enabled
-- and no matching policy is fully locked to every role except service_role
-- (trusted server-side code only, never the browser) -- that's the default
-- this migration puts every table into unless a policy below opens it up.

create type member_role as enum ('member', 'admin');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role member_role not null default 'member',
  created_at timestamptz not null default now()
);

comment on table profiles is 'One row per auth.users row, auto-created on signup by handle_new_user(). role gates admin-only RLS policies below.';

-- Auto-creates a profile the moment someone signs up, so every policy below
-- can assume a profiles row exists for any authenticated user.
create function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Shared helper so every admin-gated policy below reads the same way,
-- rather than repeating the same subquery in a dozen places.
create function is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

alter table profiles enable row level security;
create policy "profiles_select_own" on profiles for select using (id = auth.uid());
create policy "profiles_select_admin" on profiles for select using (is_admin());
create policy "profiles_update_own" on profiles for update using (id = auth.uid());

-- Source governance (§3.7) -- compliance config, admin-only end to end.
alter table sources enable row level security;
create policy "sources_admin_all" on sources for all using (is_admin()) with check (is_admin());

-- Taxonomies (§3.2) -- readable by any signed-in member (needed for filter
-- UIs), never writable from the client.
alter table industries enable row level security;
create policy "industries_select_authenticated" on industries for select using (auth.role() = 'authenticated');

alter table job_functions enable row level security;
create policy "job_functions_select_authenticated" on job_functions for select using (auth.role() = 'authenticated');

-- Jobs (§3.1) -- members see active jobs only; admins see everything.
-- Writes are admin-only as a client-side safety net -- the real write path
-- is an Edge Function (service_role, bypasses RLS entirely) promoting an
-- approved opportunity_submissions row into a job, not a direct client insert.
alter table jobs enable row level security;
create policy "jobs_select_active_authenticated" on jobs for select using (auth.role() = 'authenticated' and active);
create policy "jobs_select_admin" on jobs for select using (is_admin());
create policy "jobs_admin_insert" on jobs for insert with check (is_admin());
create policy "jobs_admin_update" on jobs for update using (is_admin());

-- Provenance -- visible alongside whatever job it belongs to (same
-- active/admin visibility rule as jobs itself).
alter table job_sources enable row level security;
create policy "job_sources_select_with_job" on job_sources for select using (
  exists (select 1 from jobs where jobs.id = job_sources.job_id and (jobs.active or is_admin()))
);

-- Duplicate review queue (US-18) -- internal admin tooling, never member-facing.
alter table duplicate_candidates enable row level security;
create policy "duplicate_candidates_admin_all" on duplicate_candidates for all using (is_admin()) with check (is_admin());

-- Member submissions (US-07/08/09) -- a member can create and see their own;
-- admins can see and review every submission.
alter table opportunity_submissions enable row level security;
create policy "opportunity_submissions_insert_own" on opportunity_submissions for insert with check (submitted_by = auth.uid());
create policy "opportunity_submissions_select_own" on opportunity_submissions for select using (submitted_by = auth.uid());
create policy "opportunity_submissions_select_admin" on opportunity_submissions for select using (is_admin());
create policy "opportunity_submissions_update_admin" on opportunity_submissions for update using (is_admin());
