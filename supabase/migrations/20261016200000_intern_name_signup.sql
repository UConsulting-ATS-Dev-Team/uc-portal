-- Interns can be cleared to sign up by NAME when their email isn't known yet. The admin lists names; an intern who signs up
-- with a matching full name (and any email) becomes an intern account and uses the name up, so each name works once.
-- It is a deliberately light gate: the list is small and an admin can check anyone who signs up in person.
create table intern_name_roster (
  name_key text primary key,
  name text not null,
  claimed_at timestamptz,
  claimed_by uuid references profiles(id) on delete set null,
  added_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
comment on table intern_name_roster is 'Names cleared to sign up as interns without an email on file. claimed_at set means the name has been used; deleting the account does not free it (remove and re-add the name instead).';

alter table intern_name_roster enable row level security;
create policy intern_name_roster_admin_all on intern_name_roster for all to authenticated using (is_admin()) with check (is_admin());
grant select, insert, update, delete on intern_name_roster to authenticated;

create or replace function normalize_person_name(t text) returns text language sql immutable as $$
  select lower(regexp_replace(trim(coalesce(t, '')), '\s+', ' ', 'g'));
$$;

create or replace function intern_name_available(p_name text) returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from intern_name_roster
    where name_key = normalize_person_name(p_name) and name_key <> '' and claimed_at is null
  );
$$;
revoke all on function intern_name_available(text) from public;

-- What the sign-up page asks before it creates the account: a known email, or a name still waiting on the intern list.
create or replace function can_sign_up_with_name(check_email text, check_name text) returns boolean
language sql security definer set search_path = public stable as $$
  select can_sign_up(check_email) or intern_name_available(check_name);
$$;
grant execute on function can_sign_up_with_name(text, text) to anon, authenticated;

create or replace function reject_non_roster_signup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not can_sign_up(new.email) and not intern_name_available(new.raw_user_meta_data ->> 'full_name') then
    raise exception 'UC_ROSTER_REJECTED: % is not on the UC roster', new.email;
  end if;
  return new;
end;
$$;

-- Same as before, plus: an email that is on no list but whose full name is on the intern name list becomes an intern, with
-- that name on the profile, and the name is marked used. Current members and alumni (matched by email) are never affected.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_member_status text := 'current_member';
  v_full_name text := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');
  v_name_claimed boolean := false;
begin
  if exists (select 1 from people where lower(trim(email)) = lower(trim(new.email)) and status = 'Alumni') then
    v_member_status := 'alumni';
  elsif not exists (select 1 from roster where lower(trim(email)) = lower(trim(new.email))) then
    if exists (select 1 from intern_roster where lower(trim(email)) = lower(trim(new.email))) then
      v_member_status := 'intern';
    elsif intern_name_available(v_full_name) then
      v_member_status := 'intern';
      v_name_claimed := true;
    end if;
  end if;

  insert into public.profiles (id, member_status, full_name)
  values (new.id, v_member_status, case when v_name_claimed then (select name from intern_name_roster where name_key = normalize_person_name(v_full_name)) end);

  if v_name_claimed then
    update intern_name_roster set claimed_at = now(), claimed_by = new.id
    where name_key = normalize_person_name(v_full_name) and claimed_at is null;
  end if;

  begin
    perform deliver_pending_messages(new.id, new.email);
  exception when others then
    raise warning 'deliver_pending_messages failed for %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;
