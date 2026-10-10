-- Four admin features that share one migration because they share one helper (the audit log):
--   1. Sender presets for email: who a message says it is from, and where replies go.
--   2. Mailing-list helpers: tag many contacts at once, and when each contact was last emailed.
--   3. The audit log: a record of what admins did (role changes, deactivations, sends, imports, ...).
--   4. Class rollover: move a graduating class from current member to alumni in one reviewed step, and aggregate application counts.
-- Everything is admin-only, re-checked in the database (is_admin()), never just hidden in the page.

-- ---- 1. Sender presets -----------------------------------------------------------------------------------------------
create table comm_sender_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  from_name text not null,
  reply_to text,
  is_default boolean not null default false,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint comm_sender_presets_reply_to_shape check (reply_to is null or reply_to ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);
create unique index comm_sender_presets_one_default on comm_sender_presets (is_default) where is_default;
alter table comm_sender_presets enable row level security;
create policy comm_sender_presets_admin_all on comm_sender_presets for all using (is_admin()) with check (is_admin());
grant select, insert, update, delete on comm_sender_presets to authenticated;

-- The sender a message went out with is copied onto the message, so changing or deleting a preset later never rewrites history.
alter table comm_messages add column from_name text;
alter table comm_messages add column reply_to text;

-- The delivery queue hands the worker the message's sender along with the text.
drop function claim_comm_recipients(integer, text[]);
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
  phone text,
  from_name text,
  reply_to text
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
    select r.id, r.message_id, m.channel, coalesce(r.subject_override, m.subject), coalesce(r.body_override, m.body), m.slack_target, m.is_test, r.person_key, r.name, r.email, r.phone, m.from_name, m.reply_to
    from marked r join comm_messages m on m.id = r.message_id;
end;
$$;
revoke all on function claim_comm_recipients(integer, text[]) from public, anon, authenticated;
grant execute on function claim_comm_recipients(integer, text[]) to service_role;

-- ---- 3 (first, the helpers below call it). The audit log ---------------------------------------------------------------
create table admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  actor_id uuid references profiles(id) on delete set null,
  actor_name text,
  action text not null,
  target_type text,
  target_id text,
  target_label text,
  details jsonb not null default '{}'::jsonb
);
create index admin_audit_log_at_idx on admin_audit_log (at desc);
create index admin_audit_log_action_idx on admin_audit_log (action, at desc);
alter table admin_audit_log enable row level security;
create policy admin_audit_log_select_admin on admin_audit_log for select using (is_admin());
-- No insert, update or delete grant: rows are only ever written by log_admin_action() below, and never changed.
grant select on admin_audit_log to authenticated;

create function log_admin_action(p_action text, p_target_type text, p_target_id text, p_target_label text, p_details jsonb default '{}'::jsonb, p_actor uuid default auth.uid())
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  select coalesce(nullif(trim(p.full_name), ''), split_part(u.email::text, '@', 1)) into v_name
  from profiles p join auth.users u on u.id = p.id where p.id = p_actor;
  insert into admin_audit_log (actor_id, actor_name, action, target_type, target_id, target_label, details)
  values (p_actor, v_name, p_action, p_target_type, p_target_id, p_target_label, coalesce(p_details, '{}'::jsonb));
end;
$$;
revoke all on function log_admin_action(text, text, text, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function log_admin_action(text, text, text, text, jsonb, uuid) to service_role;

-- A person's label for the log: their name, else the part of their email before the @.
create function audit_person_label(p_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(trim(p.full_name), ''), split_part(u.email::text, '@', 1)) from profiles p join auth.users u on u.id = p.id where p.id = p_id;
$$;
revoke all on function audit_person_label(uuid) from public, anon, authenticated;

-- Triggers record an action only when a signed-in admin did it from their own session. Work done with the service role (the
-- Edge Functions) has no auth.uid(), so those functions write their own audit rows. A bulk operation that logs one summary row
-- sets uc.audit_skip so its per-row changes aren't logged twice.
create function audit_skip() returns boolean language sql stable as $$ select coalesce(current_setting('uc.audit_skip', true), '') = '1' $$;

create function audit_profiles_change() returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_fields text[] := '{}';
begin
  if v_actor is null or audit_skip() or not is_admin() then return new; end if;
  if new.role is distinct from old.role then
    perform log_admin_action('role_changed', 'account', new.id::text, audit_person_label(new.id), jsonb_build_object('from', old.role, 'to', new.role), v_actor);
  end if;
  if new.member_status is distinct from old.member_status then
    perform log_admin_action('membership_changed', 'account', new.id::text, audit_person_label(new.id), jsonb_build_object('from', old.member_status, 'to', new.member_status), v_actor);
  end if;
  -- Name, class year and phone edits made to someone else's account: which fields changed, never the values.
  if new.id <> v_actor then
    if new.full_name is distinct from old.full_name then v_fields := v_fields || 'name'; end if;
    if new.class_year is distinct from old.class_year then v_fields := v_fields || 'class year'; end if;
    if new.phone is distinct from old.phone then v_fields := v_fields || 'phone'; end if;
    if cardinality(v_fields) > 0 then
      perform log_admin_action('account_edited', 'account', new.id::text, audit_person_label(new.id), jsonb_build_object('fields', to_jsonb(v_fields)), v_actor);
    end if;
  end if;
  return new;
end;
$$;
create trigger audit_profiles_change after update on profiles for each row execute function audit_profiles_change();

create function audit_message_created() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_test or new.created_by is null then return new; end if;
  perform log_admin_action(
    case when new.channel = 'imessage' then 'imessage_logged' when new.status = 'scheduled' then 'message_scheduled' else 'message_sent' end,
    'message', new.id::text, coalesce(new.subject, left(new.body, 60)),
    jsonb_build_object('channel', new.channel, 'audience', new.audience_label, 'recipients', new.recipient_count, 'scheduledFor', new.scheduled_for),
    new.created_by
  );
  return new;
end;
$$;
create trigger audit_message_created after insert on comm_messages for each row execute function audit_message_created();

create function audit_message_cancelled() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and is_admin() then
    perform log_admin_action('message_cancelled', 'message', new.id::text, coalesce(new.subject, left(new.body, 60)), jsonb_build_object('channel', new.channel, 'recipients', new.recipient_count), auth.uid());
  end if;
  return new;
end;
$$;
create trigger audit_message_cancelled after update of status on comm_messages for each row when (new.status = 'cancelled' and old.status = 'scheduled') execute function audit_message_cancelled();

-- Contact imports and removals are statement-level, so a 500-row import is one log row, not 500.
create function audit_contacts_added() returns trigger language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  select count(*) into n from new_rows;
  if n > 0 and auth.uid() is not null and not audit_skip() and is_admin() then
    perform log_admin_action('contacts_imported', 'mailing_list', null, 'Mailing list', jsonb_build_object('count', n), auth.uid());
  end if;
  return null;
end;
$$;
create trigger audit_contacts_added after insert on mailing_list_contacts referencing new table as new_rows for each statement execute function audit_contacts_added();

create function audit_contacts_removed() returns trigger language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  select count(*) into n from old_rows;
  if n > 0 and auth.uid() is not null and not audit_skip() and is_admin() then
    perform log_admin_action('contacts_removed', 'mailing_list', null, 'Mailing list', jsonb_build_object('count', n), auth.uid());
  end if;
  return null;
end;
$$;
create trigger audit_contacts_removed after delete on mailing_list_contacts referencing old table as old_rows for each statement execute function audit_contacts_removed();

create function audit_suppression_change() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not is_admin() then return coalesce(new, old); end if;
  if tg_op = 'INSERT' then
    perform log_admin_action('suppression_added', 'unsubscribe', new.email, new.email, jsonb_build_object('reason', new.reason), auth.uid());
    return new;
  end if;
  perform log_admin_action('suppression_removed', 'unsubscribe', old.email, old.email, jsonb_build_object('reason', old.reason), auth.uid());
  return old;
end;
$$;
create trigger audit_suppression_change after insert or delete on comm_suppressions for each row execute function audit_suppression_change();

create function audit_auto_email_change() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not is_admin() then return new; end if;
  if tg_op = 'INSERT' or new.enabled is distinct from old.enabled then
    if tg_op = 'INSERT' and not new.enabled and new.subject is null and new.body is null then return new; end if;
    if tg_op = 'UPDATE' or new.enabled then
      perform log_admin_action(case when new.enabled then 'automatic_email_on' else 'automatic_email_off' end, 'automatic_email', new.key, new.key, '{}'::jsonb, auth.uid());
    end if;
  end if;
  if (tg_op = 'INSERT' and (new.subject is not null or new.body is not null)) or (tg_op = 'UPDATE' and (new.subject is distinct from old.subject or new.body is distinct from old.body)) then
    perform log_admin_action('automatic_email_reworded', 'automatic_email', new.key, new.key, '{}'::jsonb, auth.uid());
  end if;
  return new;
end;
$$;
create trigger audit_auto_email_change after insert or update on auto_email_settings for each row execute function audit_auto_email_change();

create function audit_sender_preset_change() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not is_admin() then return coalesce(new, old); end if;
  if tg_op = 'INSERT' then
    perform log_admin_action('sender_added', 'sender', new.id::text, new.name, jsonb_build_object('fromName', new.from_name), auth.uid());
    return new;
  end if;
  perform log_admin_action('sender_removed', 'sender', old.id::text, old.name, '{}'::jsonb, auth.uid());
  return old;
end;
$$;
create trigger audit_sender_preset_change after insert or delete on comm_sender_presets for each row execute function audit_sender_preset_change();

-- ---- 2. Mailing-list helpers -----------------------------------------------------------------------------------------
create function admin_contacts_tag(p_ids uuid[], p_add text[] default '{}', p_remove text[] default '{}')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  update mailing_list_contacts c
  set tags = coalesce(
    (select array_agg(distinct t order by t) from unnest(c.tags || coalesce(p_add, '{}')) as t where t <> all (coalesce(p_remove, '{}'))),
    '{}'
  )
  where c.id = any (p_ids);
  get diagnostics n = row_count;
  perform log_admin_action('contacts_tagged', 'mailing_list', null, 'Mailing list', jsonb_build_object('count', n, 'added', to_jsonb(coalesce(p_add, '{}')), 'removed', to_jsonb(coalesce(p_remove, '{}'))), auth.uid());
  return n;
end;
$$;
revoke all on function admin_contacts_tag(uuid[], text[], text[]) from public, anon;
grant execute on function admin_contacts_tag(uuid[], text[], text[]) to authenticated;

-- When each imported contact was last emailed (a real send, not a test), and how many times.
create function admin_contacts_last_emailed()
returns table (contact_id uuid, last_emailed_at timestamptz, times_emailed integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return query
    select r.contact_id, max(r.sent_at), count(*)::integer
    from comm_recipients r join comm_messages m on m.id = r.message_id
    where r.contact_id is not null and r.status = 'sent' and not m.is_test and m.channel = 'email'
    group by r.contact_id;
end;
$$;
revoke all on function admin_contacts_last_emailed() from public, anon;
grant execute on function admin_contacts_last_emailed() to authenticated;

-- ---- 4. Class rollover, and aggregate application counts ------------------------------------------------------------
-- Moves the chosen current members of one graduating class to alumni. Only people who are still current members of that class
-- are touched, so a stale list can't change someone else. One audit row summarizes it (the per-account trigger is silenced).
create function admin_class_rollover_apply(p_ids uuid[], p_class_year integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  perform set_config('uc.audit_skip', '1', true);
  update profiles set member_status = 'alumni'
  where id = any (p_ids) and member_status = 'current_member' and class_year = p_class_year;
  get diagnostics n = row_count;
  perform set_config('uc.audit_skip', '', true);
  perform log_admin_action('class_rollover', 'class', p_class_year::text, 'Class of ' || p_class_year, jsonb_build_object('moved', n, 'selected', cardinality(p_ids)), auth.uid());
  return n;
end;
$$;
revoke all on function admin_class_rollover_apply(uuid[], integer) from public, anon;
grant execute on function admin_class_rollover_apply(uuid[], integer) to authenticated;

-- How many tracked applications sit at each stage, by class year. Counts only: no member, job or company is named. A class year
-- with fewer than 3 members tracking anything is folded into one "other" row (class_year null) so a count can't point at a person.
create function admin_application_stage_counts()
returns table (stage text, class_year integer, applications integer, members integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return query
    with per_class as (
      select ta.stage as st, p.class_year as cy, count(*) as apps, count(distinct ta.member_id) as mems
      from tracked_applications ta join profiles p on p.id = ta.member_id
      where p.member_status = 'current_member'
      group by ta.stage, p.class_year
    )
    select st, case when mems >= 3 then cy end as cy2, sum(apps)::integer, sum(mems)::integer
    from per_class
    group by st, case when mems >= 3 then cy end
    order by st, cy2 nulls last;
end;
$$;
revoke all on function admin_application_stage_counts() from public, anon;
grant execute on function admin_application_stage_counts() to authenticated;
