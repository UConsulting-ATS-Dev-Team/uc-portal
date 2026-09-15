-- Real alumni accounts -- direct follow-up to "alumni accounts... their
-- own separate views (more focused on feed/network than jobs/education)."
-- Two real pieces: (1) alumni need genuine signup access, which `roster`
-- alone doesn't grant (roster is scoped to current members only, by
-- design -- see 20260913010000_roster_gating.sql's own header comment);
-- (2) a signed-in account needs a real signal for "which experience
-- should this be," separate from `role` (access level: member/admin,
-- unchanged) -- a new `member_status` column, not a third `role` value,
-- since membership status and access level are genuinely different
-- concepts that happen to both currently have two real values.

alter table profiles add column member_status text not null default 'current_member'
  check (member_status in ('current_member', 'alumni'));
comment on column profiles.member_status is 'Real membership status, separate from role (access level). Set once at signup by matching the account''s email against people.status -- never auto-changes afterward.';

-- Renamed from is_on_roster() -- it now checks more than roster (a real
-- Alumni match in `people` also grants signup access), so the old name
-- would be actively misleading about what it actually gates. Same
-- case/whitespace-insensitive matching convention the original used.
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
  );
$$;

grant execute on function can_sign_up(text) to anon, authenticated;

drop function if exists is_on_roster(text);

-- Sets member_status at the moment of signup from the same real
-- Directory data can_sign_up() just approved against -- not a second,
-- separately-guessed source. Defaults to current_member when there's no
-- people match at all (e.g. an admin account created directly, outside
-- the normal Directory-driven flow -- matches every existing real
-- account's actual status today).
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
  end if;
  insert into public.profiles (id, member_status) values (new.id, v_member_status);
  return new;
end;
$$;

create or replace function reject_non_roster_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not can_sign_up(new.email) then
    raise exception 'UC_ROSTER_REJECTED: % is not on the UC roster', new.email;
  end if;
  return new;
end;
$$;
