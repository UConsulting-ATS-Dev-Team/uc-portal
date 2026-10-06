-- Intern accelerator tracker: a calendar of events, per-intern attendance, weekly coffee chats, and
-- complete/incomplete grading. Built from the program lead's requirements doc (home with calendar and
-- three progress requirements; 3 coffee chats a week, at least 2 with UC members; required GMs and firm
-- sessions, optional socials; weekly assignments graded by the education committee).
--
-- Admin = the education committee here: there is no separate committee role, so every write below is
-- is_admin(), and interns only ever read or write their own rows.

-- ---- Events (the calendar) ------------------------------------------------------------------------
create table accelerator_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  start_time time,
  kind text not null check (kind in ('gm', 'accelerator', 'firm', 'uc_event', 'social')),
  required boolean not null default false,
  location text,
  description text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
comment on table accelerator_events is 'Calendar of GMs, accelerator sessions, firm info sessions, UC events and socials. required = counts toward an intern''s required attendance.';
create index accelerator_events_date_idx on accelerator_events (event_date);

alter table accelerator_events enable row level security;
create policy "accelerator_events_select_authenticated" on accelerator_events for select using (auth.role() = 'authenticated');
create policy "accelerator_events_admin_all" on accelerator_events for all using (is_admin()) with check (is_admin());
grant select on accelerator_events to authenticated;
grant insert, update, delete on accelerator_events to authenticated;

-- ---- Attendance (marked by an admin, read by the intern) --------------------------------------------
-- A row means "recorded": attended = true is present, false is a recorded absence. No row = not recorded yet.
create table accelerator_attendance (
  event_id uuid not null references accelerator_events(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  attended boolean not null default true,
  marked_by uuid references profiles(id) on delete set null,
  marked_at timestamptz not null default now(),
  primary key (event_id, profile_id)
);
alter table accelerator_attendance enable row level security;
create policy "accelerator_attendance_select_own" on accelerator_attendance for select using (profile_id = auth.uid());
create policy "accelerator_attendance_admin_all" on accelerator_attendance for all using (is_admin()) with check (is_admin());
grant select, insert, update, delete on accelerator_attendance to authenticated;

-- ---- Coffee chats ----------------------------------------------------------------------------------
create table accelerator_coffee_chats (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  chat_date date not null,
  contact_name text not null,
  is_uc_member boolean not null,
  member_year text,
  member_major text,
  summary text not null,
  photo_path text,
  created_at timestamptz not null default now(),
  constraint accelerator_coffee_chats_uc_details check (
    not is_uc_member or (nullif(trim(member_year), '') is not null and nullif(trim(member_major), '') is not null)
  )
);
comment on table accelerator_coffee_chats is 'An intern''s logged coffee chat. 3 a week, at least 2 with a UC member (is_uc_member); year and major are required for UC members.';
create index accelerator_coffee_chats_profile_idx on accelerator_coffee_chats (profile_id, chat_date);

alter table accelerator_coffee_chats enable row level security;
create policy "accelerator_coffee_chats_select_own" on accelerator_coffee_chats for select using (profile_id = auth.uid());
create policy "accelerator_coffee_chats_insert_own" on accelerator_coffee_chats for insert with check (profile_id = auth.uid());
create policy "accelerator_coffee_chats_update_own" on accelerator_coffee_chats for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "accelerator_coffee_chats_delete_own" on accelerator_coffee_chats for delete using (profile_id = auth.uid());
create policy "accelerator_coffee_chats_admin_all" on accelerator_coffee_chats for all using (is_admin()) with check (is_admin());
grant select, insert, update, delete on accelerator_coffee_chats to authenticated;

-- Photos of the people interns met: private, readable only by the intern and admins.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('accelerator-chat-photos', 'accelerator-chat-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

create policy "Interns can read their own coffee chat photos"
on storage.objects for select to authenticated
using (bucket_id = 'accelerator-chat-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Interns can upload their own coffee chat photos"
on storage.objects for insert to authenticated
with check (bucket_id = 'accelerator-chat-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- remove() is a DELETE ... RETURNING, so deleting needs the SELECT policy above as well.
create policy "Interns can delete their own coffee chat photos"
on storage.objects for delete to authenticated
using (bucket_id = 'accelerator-chat-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Admins can read any coffee chat photo"
on storage.objects for select to authenticated
using (bucket_id = 'accelerator-chat-photos' and is_admin());

create policy "Admins can delete any coffee chat photo"
on storage.objects for delete to authenticated
using (bucket_id = 'accelerator-chat-photos' and is_admin());

-- ---- Grading: complete / incomplete -----------------------------------------------------------------
-- Interns see complete or incomplete plus the committee's comments, never a numeric grade. The grade the
-- committee leaves for itself moves to its own admin-only table so it cannot be read through the API by the
-- intern (a column on the submissions row would be readable by its owner whatever the UI hides).
alter table accelerator_submissions add column status text check (status in ('complete', 'incomplete'));

create table accelerator_submission_scores (
  submission_id uuid primary key references accelerator_submissions(id) on delete cascade,
  score integer,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
comment on table accelerator_submission_scores is 'The committee''s own grade for a submission. Admin-only: interns see complete/incomplete and comments, not this.';
alter table accelerator_submission_scores enable row level security;
create policy "accelerator_submission_scores_admin_all" on accelerator_submission_scores for all using (is_admin()) with check (is_admin());
grant select, insert, update, delete on accelerator_submission_scores to authenticated;

insert into accelerator_submission_scores (submission_id, score, updated_by)
select id, score, graded_by from accelerator_submissions where score is not null;

-- Submissions graded before this change had a score and feedback but no status: they count as complete.
update accelerator_submissions set status = 'complete' where graded_at is not null and status is null;
alter table accelerator_submissions drop column score;

-- An intern can fix and resubmit work marked incomplete, but never edit anything the committee finished.
drop policy "accelerator_submissions_update_own" on accelerator_submissions;
create policy "accelerator_submissions_update_own" on accelerator_submissions
  for update using (profile_id = auth.uid() and (graded_at is null or status = 'incomplete'))
  with check (profile_id = auth.uid());

-- The policies above say which rows an intern may write, not which columns. Without this an intern could
-- write status = 'complete' on their own submission. Non-admin writes keep the grading columns as they were,
-- except that changing the work of an incomplete submission sends it back to the review queue.
create function accelerator_submission_guard()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null or is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := null;
    new.feedback := null;
    new.graded_by := null;
    new.graded_at := null;
    return new;
  end if;

  new.feedback := old.feedback;
  new.graded_by := old.graded_by;
  if old.status = 'incomplete' and (new.body is distinct from old.body or new.file_path is distinct from old.file_path) then
    new.status := null;
    new.graded_at := null;
  else
    new.status := old.status;
    new.graded_at := old.graded_at;
  end if;
  return new;
end;
$$;

create trigger accelerator_submission_guard
  before insert or update on accelerator_submissions
  for each row execute function accelerator_submission_guard();
