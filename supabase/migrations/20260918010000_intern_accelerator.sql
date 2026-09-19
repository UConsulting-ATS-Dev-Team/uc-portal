-- Real accelerator program for incoming freshmen -- direct ask from the
-- user's advisor: a 6-8 week onboarding curriculum (weekly lessons, each
-- with real prep material an admin uploads and a real graded assignment),
-- gated behind a new "Intern" tier that sees essentially nothing else in
-- the app until an admin graduates them to a real current member.

-- Real security fix, found while building this: profiles_update_own lets
-- any signed-in account update its own row directly, and the existing
-- role-escalation trigger only ever clamped `role` -- `member_status` (an
-- equally sensitive column added later, for alumni) was never covered, so
-- any member could already self-promote their own member_status via a
-- plain client update. Matters a lot more now: an intern's entire access
-- model depends on member_status only ever changing via an admin action.
create or replace function prevent_role_self_escalation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not is_admin() then
    new.role := old.role;
  end if;
  if new.member_status is distinct from old.member_status and auth.uid() is not null and not is_admin() then
    new.member_status := old.member_status;
  end if;
  return new;
end;
$$;

alter table profiles drop constraint profiles_member_status_check;
alter table profiles add constraint profiles_member_status_check
  check (member_status in ('current_member', 'alumni', 'intern'));

-- Real admin-managed allowlist for incoming freshmen -- they're brand new
-- recruits, not yet on the roster or in the Directory sheet at all, so
-- neither existing signup path applies. Same shape as `roster` itself,
-- deliberately kept separate rather than overloading roster's own meaning
-- (roster = current members; this = "not a member yet, but cleared to
-- start the accelerator").
create table intern_roster (
  email text primary key,
  name text,
  added_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
comment on table intern_roster is 'Admin-managed allowlist for incoming freshmen starting the accelerator program -- grants intern-tier signup access only, same pattern as roster.';

alter table intern_roster enable row level security;
create policy "intern_roster_admin_all" on intern_roster for all using (is_admin()) with check (is_admin());

create or replace function can_sign_up(check_email text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from roster where lower(trim(email)) = lower(trim(check_email))
  ) or exists (
    select 1 from people where lower(trim(email)) = lower(trim(check_email)) and status = 'Alumni'
  ) or exists (
    select 1 from intern_roster where lower(trim(email)) = lower(trim(check_email))
  );
$$;

-- Precedence when determining member_status at signup: an intern_roster
-- match only applies if the email isn't already a real roster/alumni
-- match -- current-member and alumni status are both more established,
-- real facts than "cleared to start the accelerator," so they win if
-- somehow both are true for the same email.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_member_status text := 'current_member';
begin
  if exists (
    select 1 from people
    where lower(trim(email)) = lower(trim(new.email)) and status = 'Alumni'
  ) then
    v_member_status := 'alumni';
  elsif not exists (
    select 1 from roster where lower(trim(email)) = lower(trim(new.email))
  ) and exists (
    select 1 from intern_roster where lower(trim(email)) = lower(trim(new.email))
  ) then
    v_member_status := 'intern';
  end if;
  insert into public.profiles (id, member_status) values (new.id, v_member_status);
  return new;
end;
$$;

-- One evergreen curriculum, reused every cohort, but built to be easy for
-- an admin to actually change year to year (plain CRUD, no hardcoded
-- lesson list in code) -- direct instruction: "same curriculum but can
-- vary slightly year to year so make it easy to change."
create table accelerator_lessons (
  id uuid primary key default gen_random_uuid(),
  week_number integer not null,
  title text not null,
  topic_overview text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table accelerator_lessons is 'The accelerator curriculum -- one evergreen sequence of weekly lessons, admin-editable so it can change slightly each year without a code change.';

alter table accelerator_lessons enable row level security;
create policy "accelerator_lessons_select_authenticated" on accelerator_lessons for select using (auth.role() = 'authenticated');
create policy "accelerator_lessons_admin_all" on accelerator_lessons for all using (is_admin()) with check (is_admin());

-- Admin-uploaded prep material (slideshow/PDF/Excel) per lesson. Not
-- sensitive content -- a dedicated public bucket (see below), same
-- reasoning as the avatars bucket: real, but not private data, so a
-- plain public URL is simpler than signed-URL machinery for something
-- every authenticated member can already see via accelerator_lessons'
-- own select policy.
create table accelerator_materials (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references accelerator_lessons(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table accelerator_materials enable row level security;
create policy "accelerator_materials_select_authenticated" on accelerator_materials for select using (auth.role() = 'authenticated');
create policy "accelerator_materials_admin_all" on accelerator_materials for all using (is_admin()) with check (is_admin());

-- The real anti-skip gate, per direct decision: required submission is
-- the mechanism, not a timer -- no submission means no progress, and a
-- rushed/empty one shows up plainly when an admin grades it. One
-- submission per lesson per person (upsert on resubmit, not a growing
-- history -- a v1 simplification, not locked once graded).
create table accelerator_submissions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references accelerator_lessons(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  body text,
  file_path text,
  file_name text,
  submitted_at timestamptz not null default now(),
  score integer,
  feedback text,
  graded_by uuid references profiles(id),
  graded_at timestamptz,
  unique (lesson_id, profile_id)
);
comment on table accelerator_submissions is 'Real assignment submissions -- the actual anti-skip gate (no submission, no progress to the next lesson), plus real admin grading.';

alter table accelerator_submissions enable row level security;
create policy "accelerator_submissions_select_own" on accelerator_submissions for select using (profile_id = auth.uid());
create policy "accelerator_submissions_insert_own" on accelerator_submissions for insert with check (profile_id = auth.uid());
create policy "accelerator_submissions_update_own" on accelerator_submissions for update using (profile_id = auth.uid() and graded_at is null);
create policy "accelerator_submissions_admin_all" on accelerator_submissions for all using (is_admin()) with check (is_admin());

-- Extended with member_status so the admin Members page can show/filter
-- interns and offer a real "graduate to current member" action -- no new
-- write policy needed for that action, profiles_update_admin (an
-- existing, unrestricted-by-column admin policy) already covers it, same
-- path AdminMembers.jsx's existing role-toggle already uses.
drop function if exists list_members();

create function list_members()
returns table (
  member_id uuid,
  display_name text,
  email text,
  role member_role,
  member_status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not is_admin() then
    raise exception 'admin access required';
  end if;

  return query
    select
      u.id as member_id,
      coalesce(nullif(p.full_name, ''), u.email)::text as display_name,
      u.email::text as email,
      p.role,
      p.member_status,
      u.created_at
    from auth.users u
    join profiles p on p.id = u.id
    order by u.created_at asc;
end;
$$;
