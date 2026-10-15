-- Optional pronouns and gender on a profile, filled in at sign-up or any time on My Profile. Both are free text, never required,
-- and private like the rest of the profile: profiles can only be read by the account itself and admins (profiles_select_own /
-- profiles_select_admin), so other members never see either. Admins get a read-only list through admin_list_identity().

alter table profiles add column if not exists pronouns text check (pronouns is null or char_length(pronouns) <= 60);
alter table profiles add column if not exists gender text check (gender is null or char_length(gender) <= 60);
comment on column profiles.pronouns is 'Optional, entered by the member (sign-up or My Profile), e.g. she/her. Readable by the member and admins only.';
comment on column profiles.gender is 'Optional, entered by the member (sign-up or My Profile), free text. Readable by the member and admins only.';

-- Sign-up passes both in the new user's metadata (the account may have no session yet when email confirmation is on), so the
-- profile row created here picks them up. Same function as before plus the two columns.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_member_status text := 'current_member';
  v_full_name text := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');
  v_pronouns text := nullif(left(trim(new.raw_user_meta_data ->> 'pronouns'), 60), '');
  v_gender text := nullif(left(trim(new.raw_user_meta_data ->> 'gender'), 60), '');
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

  insert into public.profiles (id, member_status, full_name, phone, pronouns, gender)
  values (new.id, v_member_status, case when v_name_key is not null then (select name from intern_name_roster where name_key = v_name_key) end, nullif(trim(v_phone), ''), v_pronouns, v_gender);

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

-- Admin-only read of every account's pronouns and gender, joined to the account list client-side (the main account-list function is
-- shared with the mass-message audience builder, which has no use for either).
create or replace function admin_list_identity()
returns table (member_id uuid, pronouns text, gender text)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not is_admin() then
    raise exception 'admin access required';
  end if;
  return query select p.id, p.pronouns, p.gender from profiles p where p.pronouns is not null or p.gender is not null;
end;
$$;
grant execute on function admin_list_identity() to authenticated;
