-- Makes pages/Feed.jsx's composer real -- it looked fully functional (a
-- new post appears instantly, under the poster's own identity) but only
-- ever wrote to a plain useState, not even this browser's own
-- uc-portal-state cache: invisible to every other real member and gone
-- on reload. Same "member-submitted, readable by all" shape as
-- interview_writeups (20260902120000), the closest existing precedent --
-- no admin-review gate, since a member's own feed post doesn't need
-- Careers Committee approval before other members see it, same reasoning
-- interview_writeups' own migration comment already gives.
--
-- author_name/author_role_line are denormalized at post time (same
-- convention as interview_writeups.submitted_by_name) rather than joined
-- from profiles on every read -- profiles has no reliable full_name/
-- class_year for most real accounts yet, and RLS on profiles only grants
-- a member their own row anyway, so a join wouldn't even resolve other
-- posters' names.
--
-- roleChip ("Member"/"Alumnus"/"Announcement" in the old mock data) is
-- NOT stored -- every real post today is from a signed-in member (no
-- alumni account exists yet, and there's no separate "announcement"
-- identity), so the frontend just renders "Member" as a constant. Worth
-- revisiting once a real alumni or admin-announcement posting path
-- exists; not invented ahead of that need.
--
-- Deliberately does NOT cover "helpful"/"save"/"RSVP" reactions or an
-- embedded real job on a post -- those stay client-local for now, same
-- as today, per direct scope decision (posts themselves were the actual
-- complaint: not real, not shared, not persisted).
create table feed_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  author_role_line text,
  post_type text not null check (post_type in ('UC-posted job', 'Interview write-up', 'Advice', 'Event')),
  body text not null,
  is_event boolean not null default false,
  event_label text,
  created_at timestamptz not null default now()
);

alter table feed_posts enable row level security;
create policy "feed_posts_select_authenticated" on feed_posts for select using (auth.role() = 'authenticated');
create policy "feed_posts_insert_own" on feed_posts for insert with check (author_id = auth.uid());
create policy "feed_posts_update_own" on feed_posts for update using (author_id = auth.uid());
create policy "feed_posts_delete_own" on feed_posts for delete using (author_id = auth.uid());

-- Same gap every other table in this project hits -- explicit grants
-- required even for roles RLS would otherwise allow through.
grant select, insert, update, delete on public.feed_posts to authenticated;
