-- The profile gets the name exactly as the admin listed it, not as it was typed at sign-up.
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
