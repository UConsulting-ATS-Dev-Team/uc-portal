-- Support for pre-creating accounts for directory alumni and inviting
-- everyone with an unclaimed account to claim it.
--
-- Accounts created by the pre-provision tool exist in auth.users but have
-- never signed in (last_sign_in_at is null) until a real person claims one
-- via "Forgot your password?". This migration adds:
--   * claim_invites: when each unclaimed account was last sent a claim
--     email (written only by the send-claim-emails Edge Function).
--   * list_unclaimed_accounts(): admin view of never-signed-in accounts.
--   * unclaimed_account_emails(): service-role-only filter the Edge
--     Function uses so a claim email can only ever go to an account that
--     exists and has never signed in.
--   * list_messageable_members(): now prefers the real directory name, so a
--     pre-created alumni account shows as "Jane Doe" in the new-message
--     picker instead of the local part of their email.
--   * member_engagement_report(): excludes alumni accounts, so ~150
--     unclaimed alumni don't swamp the "who should we nudge" list.

create table claim_invites (
  email text primary key,
  last_sent_at timestamptz not null default now(),
  send_count integer not null default 1,
  last_sent_by uuid references auth.users(id) on delete set null
);
alter table claim_invites enable row level security;
-- No client policies on purpose: only the Edge Function (service role) writes
-- it and only security-definer functions below read it.
grant all privileges on public.claim_invites to service_role;

create or replace function list_unclaimed_accounts()
returns table (
  member_id uuid,
  display_name text,
  email text,
  member_status text,
  created_at timestamptz,
  last_invited_at timestamptz,
  invite_count integer
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not is_admin() then
    raise exception 'admin access required';
  end if;

  return query
    select
      u.id as member_id,
      coalesce(nullif(prof.full_name, ''), pe.name, u.email)::text as display_name,
      u.email::text as email,
      prof.member_status,
      u.created_at,
      ci.last_sent_at as last_invited_at,
      coalesce(ci.send_count, 0) as invite_count
    from auth.users u
    join profiles prof on prof.id = u.id
    left join people pe on lower(trim(pe.email)) = lower(trim(u.email))
    left join claim_invites ci on lower(ci.email) = lower(u.email)
    where u.last_sign_in_at is null
    order by display_name asc;
end;
$$;
grant execute on function list_unclaimed_accounts() to authenticated;

create or replace function unclaimed_account_emails(p_emails text[])
returns table (email text)
language sql
security definer
set search_path = public
stable
as $$
  select u.email::text
  from auth.users u
  where u.last_sign_in_at is null
    and lower(u.email) in (select lower(trim(e)) from unnest(p_emails) as e);
$$;
revoke all on function unclaimed_account_emails(text[]) from public, anon, authenticated;
grant execute on function unclaimed_account_emails(text[]) to service_role;

create or replace function list_messageable_members()
returns table (member_id uuid, display_name text)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return query
    select
      u.id as member_id,
      coalesce(nullif(p.full_name, ''), pe.name, split_part(u.email, '@', 1))::text as display_name
    from auth.users u
    join profiles p on p.id = u.id
    left join people pe on lower(trim(pe.email)) = lower(trim(u.email))
    where u.id <> auth.uid()
    order by u.created_at asc;
end;
$$;
grant execute on function list_messageable_members() to authenticated;

create or replace function member_engagement_report(inactive_threshold_days integer default 14)
returns table (
  member_id uuid,
  display_name text,
  email text,
  last_active_at timestamptz,
  days_inactive integer,
  is_disengaged boolean
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not is_admin() then
    raise exception 'admin access required';
  end if;

  return query
    select
      u.id as member_id,
      coalesce(p.name, prof.full_name, u.email)::text as display_name,
      u.email::text as email,
      la.last_active_at,
      case when la.last_active_at is null then null
           else (extract(day from now() - la.last_active_at))::integer
      end as days_inactive,
      coalesce(la.last_active_at < now() - make_interval(days => inactive_threshold_days), true) as is_disengaged
    from auth.users u
    left join profiles prof on prof.id = u.id
    left join people p on lower(trim(p.email)) = lower(trim(u.email))
    left join lateral (
      select greatest(
        u.last_sign_in_at,
        (select max(mp.updated_at) from member_preferences mp where mp.id = u.id),
        (select max(ta.updated_at) from tracked_applications ta where ta.member_id = u.id),
        (select max(sj.saved_at) from saved_jobs sj where sj.member_id = u.id),
        (select max(nc.updated_at) from network_connections nc where nc.member_id = u.id)
      ) as last_active_at
    ) la on true
    where coalesce(prof.member_status, 'current_member') <> 'alumni'
    order by la.last_active_at asc nulls first;
end;
$$;
