-- Master communications: mass email, Slack and iMessage from the admin pages, with templates, drafts, scheduling, an audience
-- builder, a delivery log, an imported mailing list, and an unsubscribe list. Modeled on the UConsulting ATS.
--
-- Everything is admin-only. Nothing here sends anything by itself: sending happens only when an admin presses Send (or a
-- scheduled message comes due) and only through the send/process functions, which refuse to run until an email or Slack
-- provider has credentials (supabase/functions/_shared/comms/providers.ts). Until then the pages work for everything else:
-- audiences, previews, templates, drafts, the mailing list, and iMessage hand-offs.

-- ---- Mailing list: people an admin deliberately imported who don't have a portal account ---------------------------
create table mailing_list_contacts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  tags text[] not null default '{}',
  subscribed boolean not null default true,
  source text not null default 'import',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint mailing_list_contacts_email_lower check (email = lower(trim(email)))
);
create unique index mailing_list_contacts_email_key on mailing_list_contacts (email);

-- ---- Addresses we must never email again (an unsubscribe, a bounce, a complaint, or an admin's call) -----------------
create table comm_suppressions (
  email text primary key,
  reason text not null check (reason in ('unsubscribed', 'bounced', 'complained', 'manual')),
  note text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint comm_suppressions_email_lower check (email = lower(trim(email)))
);

-- ---- Templates, drafts and saved audiences -----------------------------------------------------------------------
create table comm_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text not null check (channel in ('email', 'slack', 'imessage')),
  subject text,
  body text not null default '',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table comm_saved_audiences (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  audience jsonb not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table comm_drafts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text not null check (channel in ('email', 'slack', 'imessage')),
  subject text,
  body text not null default '',
  audience jsonb not null default '{"match":"all","groups":[{"match":"all","conditions":[]}]}'::jsonb,
  slack_target text,
  scheduled_for timestamptz,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---- What was sent, to whom, and how it went ---------------------------------------------------------------------
create table comm_messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('email', 'slack', 'imessage')),
  subject text,
  body text not null,
  audience jsonb not null default '{}'::jsonb,
  audience_label text,
  slack_target text,
  status text not null check (status in ('scheduled', 'queued', 'sending', 'sent', 'partial', 'failed', 'cancelled')),
  is_test boolean not null default false,
  scheduled_for timestamptz,
  template_id uuid references comm_templates(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0
);
create index comm_messages_created_idx on comm_messages (created_at desc);
create index comm_messages_due_idx on comm_messages (scheduled_for) where status = 'scheduled';

create table comm_recipients (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references comm_messages(id) on delete cascade,
  person_key text not null,
  profile_id uuid references profiles(id) on delete set null,
  contact_id uuid references mailing_list_contacts(id) on delete set null,
  name text,
  email text,
  phone text,
  -- handed_off: an iMessage the admin opened in their own Messages app (the portal can't know it was sent)
  -- Automatic emails differ per person (their own assignment, their own digest): the text is rendered when queued and kept here.
  subject_override text,
  body_override text,
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed', 'skipped', 'handed_off')),
  error text,
  provider_message_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index comm_recipients_message_idx on comm_recipients (message_id);
create index comm_recipients_queue_idx on comm_recipients (created_at) where status = 'queued';

-- ---- Automatic (system) emails: which are on, and any edits to their wording --------------------------------------
-- The list of automatic emails and their default wording live in the app. A row here only exists once an admin has changed
-- something, and `enabled` defaults to off: no automatic email goes out until an admin turns that one on.
create table auto_email_settings (
  key text primary key,
  enabled boolean not null default false,
  subject text,
  body text,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Which automatic email went to whom for what (a lesson, a meeting, a week), so a daily run never sends the same one twice.
create table auto_email_log (
  key text not null,
  profile_id uuid not null references profiles(id) on delete cascade,
  ref text not null,
  queued_at timestamptz not null default now(),
  primary key (key, profile_id, ref)
);

-- ---- Access: admins only, everywhere ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['mailing_list_contacts', 'comm_suppressions', 'comm_templates', 'comm_saved_audiences', 'comm_drafts', 'comm_messages', 'comm_recipients', 'auto_email_settings', 'auto_email_log']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for all using (is_admin()) with check (is_admin())', t || '_admin_all', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;

-- ---- Delivery queue, used only by the process-comm-queue function (service role) --------------------------------
-- Takes up to p_limit queued recipients of messages that are due (only for the channels that can actually send right now),
-- marks them 'sending', and returns them with the message they belong to. skip locked lets overlapping runs (pg_net can deliver a cron call twice) take different rows instead of
-- sending the same person twice.
create function claim_comm_recipients(p_limit integer default 25, p_channels text[] default array['email', 'slack'])
returns table (
  recipient_id uuid,
  message_id uuid,
  channel text,
  subject text,
  body text,
  slack_target text,
  is_test boolean,
  person_key text,
  name text,
  email text,
  phone text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    with picked as (
      select r.id
      from comm_recipients r
      join comm_messages m on m.id = r.message_id
      where r.status = 'queued' and m.status in ('queued', 'sending') and m.channel = any(p_channels)
      order by r.created_at
      limit p_limit
      for update of r skip locked
    ),
    marked as (
      update comm_recipients r set status = 'sending' from picked where r.id = picked.id returning r.*
    )
    select r.id, r.message_id, m.channel, coalesce(r.subject_override, m.subject), coalesce(r.body_override, m.body), m.slack_target, m.is_test, r.person_key, r.name, r.email, r.phone
    from marked r join comm_messages m on m.id = r.message_id;
end;
$$;
revoke all on function claim_comm_recipients(integer, text[]) from public, anon, authenticated;
grant execute on function claim_comm_recipients(integer, text[]) to service_role;

-- Recomputes a message's counters and final status from its recipients.
create function refresh_comm_message(p_message uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sent integer;
  v_failed integer;
  v_open integer;
  v_total integer;
begin
  select
    count(*) filter (where status = 'sent'),
    count(*) filter (where status = 'failed'),
    count(*) filter (where status in ('queued', 'sending')),
    count(*)
  into v_sent, v_failed, v_open, v_total
  from comm_recipients where message_id = p_message;

  update comm_messages set
    sent_count = v_sent,
    failed_count = v_failed,
    recipient_count = v_total,
    status = case
      when status = 'cancelled' then status
      when v_open > 0 then 'sending'
      when v_failed = 0 then 'sent'
      when v_sent = 0 then 'failed'
      else 'partial'
    end,
    finished_at = case when v_open = 0 and status <> 'cancelled' then now() else finished_at end
  where id = p_message;
end;
$$;
revoke all on function refresh_comm_message(uuid) from public, anon, authenticated;
grant execute on function refresh_comm_message(uuid) to service_role;

-- ---- Cron: deliver the queue and release scheduled messages, every minute ----------------------------------------
-- Like the other scheduled functions this reads its secret from Vault and is guarded by the same X-Cron-Secret header. It does
-- nothing while no provider is configured.
select cron.unschedule('process-comm-queue') where exists (select 1 from cron.job where jobname = 'process-comm-queue');
select cron.schedule(
  'process-comm-queue',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://cfwbtzajnaodgqilgkqn.supabase.co/functions/v1/process-comm-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmd2J0emFqbmFvZGdxaWxna3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MTk3NTQsImV4cCI6MjEwNDQ5NTc1NH0.pMdJ5vEZXrBaVQqkqXJycjGVOF116hTvusYUsagSc7w',
      'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ---- Cron: the automatic emails, once a day at 9 AM Pacific (16:00 UTC; an hour earlier in winter) --------------------
-- Each automatic email is off until an admin turns it on, and sends nothing while email isn't connected.
select cron.unschedule('run-automatic-emails') where exists (select 1 from cron.job where jobname = 'run-automatic-emails');
select cron.schedule(
  'run-automatic-emails',
  '0 16 * * *',
  $$
  select net.http_post(
    url := 'https://cfwbtzajnaodgqilgkqn.supabase.co/functions/v1/run-automatic-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmd2J0emFqbmFvZGdxaWxna3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MTk3NTQsImV4cCI6MjEwNDQ5NTc1NH0.pMdJ5vEZXrBaVQqkqXJycjGVOF116hTvusYUsagSc7w',
      'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
