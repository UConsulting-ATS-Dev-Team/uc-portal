-- Names typed at sign-up don't have to match the intern list letter for letter: a typo, a nickname or a shortened first name
-- ("Joe" for "Joseph", "Emma Zhou" for "Emma Zhu") still gets in. The site is private and small, and an admin can see who claimed
-- each listed name (claimed_as keeps what they typed), so a wrong claim can be checked in person.
create extension if not exists pg_trgm with schema extensions;
create extension if not exists fuzzystrmatch with schema extensions;

alter table intern_name_roster add column if not exists claimed_as text;

-- Lowercase letters and single spaces only, so accents, dots and hyphens don't get in the way.
create or replace function name_letters(t text) returns text language sql immutable as $$
  select trim(regexp_replace(regexp_replace(lower(coalesce(t, '')), '[^a-z ]', '', 'g'), '\s+', ' ', 'g'));
$$;

-- The unclaimed listed name closest to what was typed (its name_key), or null when nothing is close enough.
create or replace function match_intern_name(p_name text) returns text
language plpgsql security definer set search_path = public, extensions stable as $$
declare
  v_typed text := name_letters(p_name);
  v_first text := split_part(v_typed, ' ', 1);
  v_last text := (regexp_match(v_typed, '(\S+)$'))[1];
  r record;
  v_listed text;
  v_lf text;
  v_ll text;
  v_sim real;
  v_ok boolean;
  v_best text := null;
  v_best_score real := 0;
begin
  if v_typed = '' then return null; end if;

  for r in select name_key from intern_name_roster where claimed_at is null loop
    v_listed := name_letters(r.name_key);
    if v_listed = v_typed then
      return r.name_key; -- exact
    end if;
    -- Fuzzy matching needs a first and a last name on both sides.
    if position(' ' in v_typed) = 0 or position(' ' in v_listed) = 0 then continue; end if;

    v_lf := split_part(v_listed, ' ', 1);
    v_ll := (regexp_match(v_listed, '(\S+)$'))[1];
    v_sim := similarity(v_typed, v_listed);

    v_ok := v_sim >= 0.55
      or (
        levenshtein(v_last, v_ll) <= greatest(1, length(v_ll) / 5)
        and (
          levenshtein(v_first, v_lf) <= 2
          or starts_with(v_lf, v_first)
          or starts_with(v_first, v_lf)
          or left(v_first, 3) = left(v_lf, 3)
        )
      );

    if v_ok and v_sim + 0.3 > v_best_score then
      v_best := r.name_key;
      v_best_score := v_sim + 0.3;
    end if;
  end loop;
  return v_best;
end;
$$;
revoke all on function match_intern_name(text) from public;

create or replace function intern_name_available(p_name text) returns boolean language sql security definer set search_path = public stable as $$
  select match_intern_name(p_name) is not null;
$$;

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_member_status text := 'current_member';
  v_full_name text := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');
  v_name_key text;
begin
  if exists (select 1 from people where lower(trim(email)) = lower(trim(new.email)) and status = 'Alumni') then
    v_member_status := 'alumni';
  elsif not exists (select 1 from roster where lower(trim(email)) = lower(trim(new.email))) then
    if exists (select 1 from intern_roster where lower(trim(email)) = lower(trim(new.email))) then
      v_member_status := 'intern';
    else
      v_name_key := match_intern_name(v_full_name);
      if v_name_key is not null then v_member_status := 'intern'; end if;
    end if;
  end if;

  insert into public.profiles (id, member_status, full_name)
  values (new.id, v_member_status, case when v_name_key is not null then (select name from intern_name_roster where name_key = v_name_key) end);

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
