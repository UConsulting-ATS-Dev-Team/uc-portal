-- One account per name for everyone except admins. A name here is the saved profile name, else the name on the roster, the
-- alumni directory or the intern list for that email. If an admin account carries the name, the name may be used again, so an
-- admin can make test accounts under their own name.
create or replace function account_name_key(p_email text, p_full_name text) returns text
language sql security definer set search_path = public stable as $$
  select normalize_person_name(coalesce(
    nullif(trim(p_full_name), ''),
    (select nullif(trim(name), '') from roster where lower(trim(email)) = lower(trim(p_email))),
    (select nullif(trim(name), '') from people where lower(trim(email)) = lower(trim(p_email))),
    (select nullif(trim(name), '') from intern_roster where lower(trim(email)) = lower(trim(p_email)))
  ));
$$;
revoke all on function account_name_key(text, text) from public;

create or replace function signup_name_taken(check_email text, check_name text) returns boolean
language plpgsql security definer set search_path = public stable as $$
declare
  v_key text := account_name_key(check_email, check_name);
begin
  if v_key = '' then return false; end if;
  -- An admin's name is free to reuse.
  if exists (
    select 1 from auth.users u join profiles pr on pr.id = u.id
    where pr.role = 'admin' and account_name_key(u.email::text, pr.full_name) = v_key
  ) then return false; end if;
  return exists (
    select 1 from auth.users u join profiles pr on pr.id = u.id
    where lower(trim(u.email::text)) <> lower(trim(check_email))
      and account_name_key(u.email::text, pr.full_name) = v_key
  );
end;
$$;
grant execute on function signup_name_taken(text, text) to anon, authenticated;

create or replace function reject_non_roster_signup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not can_sign_up(new.email) and not intern_name_available(new.raw_user_meta_data ->> 'full_name') then
    raise exception 'UC_ROSTER_REJECTED: % is not on the UC roster', new.email;
  end if;
  if signup_name_taken(new.email, new.raw_user_meta_data ->> 'full_name') then
    raise exception 'UC_NAME_TAKEN: an account already exists under this name';
  end if;
  return new;
end;
$$;
