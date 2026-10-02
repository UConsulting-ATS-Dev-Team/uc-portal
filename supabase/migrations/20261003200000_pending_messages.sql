-- Messages to directory people who haven't signed up yet. Real messaging
-- (messages table) only works between two real accounts, so before this a
-- "Message" button on someone without an account was a dead end. A pending
-- message is addressed to a people-directory row instead of an account; the
-- moment an account is created for that person's email (self sign-up, or the
-- admin pre-create-accounts tool), handle_new_user() converts it into a real
-- message from the original sender, with its original timestamp, and removes
-- the pending row. Nothing is delivered anywhere before then, and only the
-- sender can see their own pending messages.
create table pending_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_person_id uuid not null references people(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index pending_messages_recipient_idx on pending_messages (recipient_person_id);

alter table pending_messages enable row level security;
create policy "pending_messages_select_own" on pending_messages for select to authenticated using (sender_id = auth.uid());
create policy "pending_messages_insert_own" on pending_messages for insert to authenticated with check (sender_id = auth.uid());
create policy "pending_messages_delete_own" on pending_messages for delete to authenticated using (sender_id = auth.uid());
grant select, insert, delete on public.pending_messages to authenticated;

-- Light anti-spam: a sender can have at most 5 undelivered messages waiting
-- for any one person.
create or replace function limit_pending_messages()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from pending_messages
      where sender_id = new.sender_id and recipient_person_id = new.recipient_person_id) >= 5 then
    raise exception 'You already have 5 messages waiting for this person to join.';
  end if;
  return new;
end;
$$;
create trigger pending_messages_limit before insert on pending_messages
  for each row execute function limit_pending_messages();

-- Moves every pending message addressed to this email's directory row into
-- the real messages table. Only ever called from handle_new_user().
create or replace function deliver_pending_messages(p_user_id uuid, p_email text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into messages (sender_id, recipient_id, body, created_at)
  select pm.sender_id, p_user_id, pm.body, pm.created_at
  from pending_messages pm
  join people pe on pe.id = pm.recipient_person_id
  where lower(trim(pe.email)) = lower(trim(p_email))
    and pm.sender_id <> p_user_id
  order by pm.created_at;

  delete from pending_messages pm
  using people pe
  where pe.id = pm.recipient_person_id
    and lower(trim(pe.email)) = lower(trim(p_email));
end;
$$;
revoke all on function deliver_pending_messages(uuid, text) from public, anon, authenticated;

-- Same body as the intern_accelerator version, plus delivery. Delivery is
-- wrapped so a problem there can never block someone from signing up.
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

  begin
    perform deliver_pending_messages(new.id, new.email);
  exception when others then
    raise warning 'deliver_pending_messages failed for %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;
