-- Real per-viewer message archiving -- closes the gap flagged while
-- scoping gesture nav: Messages had no way to hide/archive a
-- conversation at all. Conversations are shared rows (the `messages`
-- table), so a real archive can't be a delete -- deleting would remove
-- the other participant's copy of the conversation too. Instead this is
-- a small, own-row-only table recording "this account archived this
-- counterpart" -- existence of a row is the signal, same pattern
-- data/store.jsx's savedJobIds/savedConnections already use for a
-- similar per-viewer toggle, just server-side since Messages already
-- syncs across devices.
create table archived_conversations (
  account_id uuid not null references auth.users(id) on delete cascade,
  counterpart_id uuid not null references auth.users(id) on delete cascade,
  archived_at timestamptz not null default now(),
  primary key (account_id, counterpart_id)
);
comment on table archived_conversations is 'Per-viewer conversation archiving -- a row means account_id archived their view of the thread with counterpart_id. Never deletes the underlying messages.';

alter table archived_conversations enable row level security;
create policy "archived_conversations_select_own" on archived_conversations for select using (account_id = auth.uid());
create policy "archived_conversations_insert_own" on archived_conversations for insert with check (account_id = auth.uid());
create policy "archived_conversations_delete_own" on archived_conversations for delete using (account_id = auth.uid());

-- A new message from someone you'd archived un-archives your view of
-- that thread -- same real-world expectation Gmail's own "archive"
-- already sets (a reply brings a thread back), so a member can't
-- silently miss a real new message just because they tidied an old,
-- dead conversation away at some point.
create or replace function unarchive_on_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from archived_conversations
  where account_id = new.recipient_id and counterpart_id = new.sender_id;
  return new;
end;
$$;

create trigger messages_unarchive_recipient
after insert on messages
for each row execute function unarchive_on_new_message();
