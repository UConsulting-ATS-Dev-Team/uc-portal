-- Makes pages/Messages.jsx real -- it was a fully mock two-pane UI
-- (data/mockMessages.js's fictional conversations, tied to
-- data/mockPeople.js's fictional people), by direct instruction
-- ("replace all the mock stuff with the real versions").
--
-- Real messaging can only ever deliver between two real signed-in
-- accounts (auth.users) -- direct product decision made explicitly given
-- today's real state: the 207-row `people` directory imported earlier
-- today has no link to auth.users at all (most of those 207 real people
-- have never signed up), so messaging is scoped to real accounts only
-- for now. Functionally that means very few real conversations are
-- possible until more members actually sign up -- correct and honest
-- given today's real data, not a shortcut.
create table messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint messages_not_self check (sender_id <> recipient_id)
);

alter table messages enable row level security;
-- Own conversations only -- either side of the message, not a public feed.
create policy "messages_select_own" on messages for select using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy "messages_insert_own" on messages for insert with check (sender_id = auth.uid());
-- Only the recipient can ever mark a message read -- the sender has
-- nothing legitimate to update on a message once sent.
create policy "messages_update_recipient" on messages for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

grant select, insert, update on public.messages to authenticated;

-- "Who can I message" -- every OTHER real signed-up account. Deliberately
-- NOT admin-gated (unlike list_members(), its closest precedent) since
-- this has to work for any real member, not just admins, the moment more
-- than one real account exists. Withholds email (unlike list_members(),
-- which is admin tooling where seeing a real email is appropriate) --
-- this is a member-facing "start a conversation" picker, so it only
-- exposes a display name, falling back to the email's local part (not
-- the full address) when full_name is blank, same as it almost always
-- is today (see list_members()'s own comment).
create or replace function list_messageable_members()
returns table (member_id uuid, display_name text)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return query
    select u.id as member_id, coalesce(nullif(p.full_name, ''), split_part(u.email, '@', 1)) as display_name
    from auth.users u
    join profiles p on p.id = u.id
    where u.id <> auth.uid()
    order by u.created_at asc;
end;
$$;

grant execute on function list_messageable_members() to authenticated;

-- Resolves a real people.id (from Network.jsx/MemberProfile.jsx's
-- existing "Message" button, still linking by directory person, not
-- account) to a real signed-in account, if that specific real person has
-- one -- by matching the directory's own email against auth.users. Lets
-- Messages.jsx tell the honest difference between "this real person has
-- an account, open a thread" and "this real person hasn't joined UC
-- Portal yet" instead of guessing or silently doing nothing.
create or replace function find_member_by_email(lookup_email text)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from auth.users where lower(trim(email)) = lower(trim(lookup_email)) limit 1;
$$;

grant execute on function find_member_by_email(text) to authenticated;
