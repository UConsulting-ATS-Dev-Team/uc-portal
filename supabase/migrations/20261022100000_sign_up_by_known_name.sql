-- Anyone whose name is already in the database can sign up with any email, not just the one listed for them. People use a
-- different address than the one in the directory all the time, and the club is small enough that an admin can check a
-- surprising sign-up in person. Until now only the intern name list worked this way.
--
-- A typed name matches a listed one the same fuzzy way intern names always have (case, spacing, typos, nicknames, shortened first
-- names; see match_intern_name). The listed names come from four places, and where the match was found decides the account type:
--   roster              -> current member
--   intern_roster       -> intern (an intern listed by email who signed up with another address)
--   intern_name_roster  -> intern (unclaimed names only, one use)
--   people, Alumni      -> alumnus
-- The new profile carries the LISTED name (not what was typed), so one-account-per-name keeps working: a second sign-up under the
-- same person is refused whatever spelling it uses.

-- A score for how well a typed name matches a listed one: null for no match, 10 for an exact one, else similarity plus a bonus.
-- Same rules as match_intern_name.
create or replace function name_match_score(p_typed text, p_listed text) returns real
language plpgsql immutable set search_path = public, extensions as $$
declare
  v_typed text := name_letters(p_typed);
  v_listed text := name_letters(p_listed);
  v_first text;
  v_last text;
  v_lf text;
  v_ll text;
  v_sim real;
begin
  if v_typed = '' or v_listed = '' then return null; end if;
  if v_listed = v_typed then return 10; end if;
  -- Fuzzy matching needs a first and a last name on both sides.
  if position(' ' in v_typed) = 0 or position(' ' in v_listed) = 0 then return null; end if;
  v_first := split_part(v_typed, ' ', 1);
  v_last := (regexp_match(v_typed, '(\S+)$'))[1];
  v_lf := split_part(v_listed, ' ', 1);
  v_ll := (regexp_match(v_listed, '(\S+)$'))[1];
  v_sim := similarity(v_typed, v_listed);
  if v_sim >= 0.55
    or (
      levenshtein(v_last, v_ll) <= greatest(1, length(v_ll) / 5)
      and (
        levenshtein(v_first, v_lf) <= 2
        or starts_with(v_lf, v_first)
        or starts_with(v_first, v_lf)
        or left(v_first, 3) = left(v_lf, 3)
      )
    )
  then
    return v_sim + 0.3;
  end if;
  return null;
end;
$$;

-- The best listed person for a typed name, and where they were listed. At most one row.
create or replace function match_known_person(p_name text) returns table (kind text, listed_name text, name_key text)
language plpgsql security definer set search_path = public, extensions stable as $$
begin
  return query
  select c.kind, c.listed_name, c.name_key
  from (
    select 'member'::text as kind, r.name as listed_name, null::text as name_key, 1 as pri from roster r where nullif(trim(r.name), '') is not null
    union all
    select 'intern', ir.name, null, 2 from intern_roster ir where nullif(trim(ir.name), '') is not null
    union all
    select 'intern_name', n.name, n.name_key, 3 from intern_name_roster n where n.claimed_at is null
    union all
    select 'alumni', pe.name, null, 4 from people pe where pe.status = 'Alumni' and nullif(trim(pe.name), '') is not null
  ) c
  where name_match_score(p_name, c.listed_name) is not null
  order by name_match_score(p_name, c.listed_name) desc, c.pri
  limit 1;
end;
$$;
revoke all on function name_match_score(text, text) from public;
revoke all on function match_known_person(text) from public;

create or replace function known_name_available(p_name text) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from match_known_person(p_name));
$$;
revoke all on function known_name_available(text) from public;

create or replace function can_sign_up_with_name(check_email text, check_name text) returns boolean
language sql security definer set search_path = public stable as $$
  select can_sign_up(check_email) or known_name_available(check_name);
$$;
grant execute on function can_sign_up_with_name(text, text) to anon, authenticated;

-- The same person under a different spelling is still the same person: compare against the LISTED name when the typed one matches one.
create or replace function signup_name_taken(check_email text, check_name text) returns boolean
language plpgsql security definer set search_path = public stable as $$
declare
  v_listed text;
  v_key text;
begin
  select m.listed_name into v_listed from match_known_person(check_name) m limit 1;
  v_key := account_name_key(check_email, coalesce(v_listed, check_name));
  if v_key = '' then return false; end if;
  if exists (
    select 1 from auth.users u join profiles pr on pr.id = u.id join multi_account_owners m on m.user_id = u.id
    where account_name_key(u.email::text, pr.full_name) = v_key
  ) then return false; end if;
  return exists (
    select 1 from auth.users u join profiles pr on pr.id = u.id
    where lower(trim(u.email::text)) <> lower(trim(check_email))
      and account_name_key(u.email::text, pr.full_name) = v_key
  );
end;
$$;

create or replace function reject_non_roster_signup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from account_emails where email = lower(trim(new.email))) then
    raise exception 'UC_EMAIL_IN_USE: % is already attached to an account', new.email;
  end if;
  if not can_sign_up(new.email) and not known_name_available(new.raw_user_meta_data ->> 'full_name') then
    raise exception 'UC_ROSTER_REJECTED: % is not on the UC roster', new.email;
  end if;
  if signup_name_taken(new.email, new.raw_user_meta_data ->> 'full_name') then
    raise exception 'UC_NAME_TAKEN: an account already exists under this name';
  end if;
  return new;
end;
$$;

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_member_status text := 'current_member';
  v_full_name text := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');
  v_pronouns text := nullif(left(trim(new.raw_user_meta_data ->> 'pronouns'), 60), '');
  v_gender text := nullif(left(trim(new.raw_user_meta_data ->> 'gender'), 60), '');
  v_name_key text;
  v_phone text;
  v_kind text;
  v_listed text;
  v_listed_key text;
begin
  if exists (select 1 from people where lower(trim(email)) = lower(trim(new.email)) and status = 'Alumni') then
    v_member_status := 'alumni';
  elsif not exists (select 1 from roster where lower(trim(email)) = lower(trim(new.email))) then
    if exists (select 1 from intern_roster where lower(trim(email)) = lower(trim(new.email))) then
      v_member_status := 'intern';
      select phone, match_intern_name(coalesce(v_full_name, name)) into v_phone, v_name_key
      from intern_roster where lower(trim(email)) = lower(trim(new.email));
      if v_name_key is null then v_name_key := match_intern_name(v_full_name); end if;
    else
      -- Not listed by this email: found by name instead.
      select m.kind, m.listed_name, m.name_key into v_kind, v_listed, v_listed_key from match_known_person(v_full_name) m limit 1;
      if v_kind is not null then
        v_member_status := case v_kind when 'member' then 'current_member' when 'alumni' then 'alumni' else 'intern' end;
        if v_kind = 'intern_name' then
          v_name_key := v_listed_key;
        elsif v_kind = 'intern' then
          -- An intern listed by email who used another address: take their phone number and use up their name entry too.
          select ir.phone into v_phone from intern_roster ir where name_letters(ir.name) = name_letters(v_listed) limit 1;
          v_name_key := match_intern_name(v_listed);
        end if;
      end if;
    end if;
  end if;

  insert into public.profiles (id, member_status, full_name, phone, pronouns, gender)
  values (
    new.id,
    v_member_status,
    coalesce(v_listed, case when v_name_key is not null then (select name from intern_name_roster where name_key = v_name_key) end),
    nullif(trim(v_phone), ''),
    v_pronouns,
    v_gender
  );

  if v_name_key is not null then
    update intern_name_roster set claimed_at = now(), claimed_by = new.id, claimed_as = v_full_name
    where name_key = v_name_key and claimed_at is null;
  end if;

  begin
    perform deliver_pending_messages(new.id, new.email);
  exception when others then
    raise warning 'deliver_pending_messages failed for %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;
