-- Real UC member/alumni directory, replacing data/mockPeople.js's 13
-- fictional entries as the primary Network/Member-profile data source --
-- see JOB_ENGINE_ARCHITECTURE.md's Stage 5 note ("real CRM integration
-- replacing the mocked alumni/connection data") and the accompanying
-- one-time import script/data for the full provenance writeup.
--
-- Source: the club's own "UConsulting Directory" Google Sheet (owner's
-- Drive, read-only access), its Active + Alumni tabs specifically -- the
-- other 3 tabs in that sheet are stale duplicates from earlier schema
-- migrations the club went through and were excluded by direct instruction.
--
-- Only fields with a real product use case are stored -- phone numbers and
-- Venmo handles exist in the source sheet but have no current (or planned)
-- feature that needs them, and are meaningfully more sensitive than the
-- rest, so they were deliberately never extracted, not just hidden by RLS.
--
-- RLS matches jobs/industries/job_functions: readable by any authenticated
-- club member (auth.role() = 'authenticated'), not the public anon role --
-- appropriate for real names/emails of real people, versus a public
-- job-board API meant to be reachable without a session.
create table people (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  status text not null check (status in ('Current member', 'Alumni')),
  class_year integer,
  admit_class text,
  graduating_class text,
  major text,
  company text,
  role text,
  industry text,
  location text,
  email text,
  linkedin text,
  mentor text,
  created_at timestamptz not null default now()
);

alter table people enable row level security;

create policy "people_select_authenticated" on people for select using (auth.role() = 'authenticated');
create policy "people_admin_all" on people for all using (is_admin()) with check (is_admin());
