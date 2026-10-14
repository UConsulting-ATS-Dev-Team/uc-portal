-- An intern listed by email can also be listed with a phone number (so an exec can text them from the iMessage tab). The number
-- lives on the roster row until the person signs up, then handle_new_user() copies it onto their profile. Admin-only table,
-- same as the rest of intern_roster. Also: an intern who signs up with a listed email claims their name-only entry too, so
-- the Approved Accounts list doesn't show them as unclaimed.

alter table intern_roster add column if not exists phone text;
comment on column intern_roster.phone is 'Optional, added by an admin. Copied to profiles.phone when the person signs up with this email.';

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_member_status text := 'current_member';
  v_full_name text := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');
  v_name_key text;
  v_phone text;
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
      v_name_key := match_intern_name(v_full_name);
      if v_name_key is not null then v_member_status := 'intern'; end if;
    end if;
  end if;

  insert into public.profiles (id, member_status, full_name, phone)
  values (new.id, v_member_status, case when v_name_key is not null then (select name from intern_name_roster where name_key = v_name_key) end, nullif(trim(v_phone), ''));

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
