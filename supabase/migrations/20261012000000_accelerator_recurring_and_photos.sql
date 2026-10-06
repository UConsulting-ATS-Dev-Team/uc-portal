-- Accelerator follow-ups from the program lead:
--  * recurring events (a weekly GM or accelerator meeting is one series of rows sharing a series_id)
--  * two ways attendance is recorded: the committee marks it (a meeting of ~10 people in a room), or the intern
--    submits a photo from the event (company visits, fireside chats, socials)
--  * coffee-chat weeks close at each accelerator meeting, so a chat counts by WHEN IT WAS LOGGED; created_at must
--    therefore not be settable by the intern.

-- ---- Recurring events and how each event's attendance is recorded -----------------------------------
alter table accelerator_events
  add column series_id uuid,
  add column attendance_method text not null default 'admin' check (attendance_method in ('admin', 'photo'));
comment on column accelerator_events.series_id is 'Shared by every occurrence of a recurring event, so the series can be edited or deleted together. Null for a one-off event.';
comment on column accelerator_events.attendance_method is 'admin = the committee marks who came; photo = interns submit a photo from the event.';
create index accelerator_events_series_idx on accelerator_events (series_id) where series_id is not null;

update accelerator_events set attendance_method = 'photo' where kind in ('firm', 'uc_event', 'social');

-- ---- Attendance: who recorded it, and the photo ------------------------------------------------------
alter table accelerator_attendance
  add column source text not null default 'admin' check (source in ('admin', 'photo')),
  add column photo_path text;
comment on column accelerator_attendance.source is 'admin = marked by the committee; photo = the intern submitted a photo (the committee can still change it).';

-- An intern may record themselves as having attended a photo-method event that has started (a day of slack for
-- timezones), and replace their own photo while the row is still theirs. They can never set marked_by, mark
-- themselves absent, or touch a row the committee has since marked (that sets source back to admin).
create policy "accelerator_attendance_insert_own_photo" on accelerator_attendance
  for insert with check (
    profile_id = auth.uid()
    and source = 'photo'
    and attended
    and marked_by is null
    and exists (
      select 1 from accelerator_events e
      where e.id = event_id and e.attendance_method = 'photo' and e.event_date <= current_date + 1
    )
  );

create policy "accelerator_attendance_update_own_photo" on accelerator_attendance
  for update using (profile_id = auth.uid() and source = 'photo')
  with check (
    profile_id = auth.uid()
    and source = 'photo'
    and attended
    and marked_by is null
    and exists (
      select 1 from accelerator_events e
      where e.id = event_id and e.attendance_method = 'photo' and e.event_date <= current_date + 1
    )
  );

-- Private bucket for those photos: the intern and admins only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('accelerator-event-photos', 'accelerator-event-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

create policy "Interns can read their own event photos"
on storage.objects for select to authenticated
using (bucket_id = 'accelerator-event-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Interns can upload their own event photos"
on storage.objects for insert to authenticated
with check (bucket_id = 'accelerator-event-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Interns can delete their own event photos"
on storage.objects for delete to authenticated
using (bucket_id = 'accelerator-event-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Admins can read any event photo"
on storage.objects for select to authenticated
using (bucket_id = 'accelerator-event-photos' and is_admin());

create policy "Admins can delete any event photo"
on storage.objects for delete to authenticated
using (bucket_id = 'accelerator-event-photos' and is_admin());

-- ---- Coffee chats: created_at is the "when it was logged" clock -------------------------------------
-- Weeks close at each accelerator meeting and a chat counts toward the week it was logged in, so an intern must
-- not be able to backdate created_at into a week that has closed. Replace the table-wide write grants with
-- column lists that leave created_at (and id) out.
revoke insert, update on accelerator_coffee_chats from authenticated;
grant insert (profile_id, chat_date, contact_name, is_uc_member, member_year, member_major, summary, photo_path)
  on accelerator_coffee_chats to authenticated;
grant update (chat_date, contact_name, is_uc_member, member_year, member_major, summary, photo_path)
  on accelerator_coffee_chats to authenticated;
