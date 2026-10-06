-- User management: deactivating accounts, an optional phone number (for exec iMessages), and one admin call that returns
-- everything the Members page and the audience builder need about each account.

alter table profiles
  add column deactivated_at timestamptz,
  add column deactivated_by uuid references profiles(id) on delete set null,
  add column phone text;
comment on column profiles.deactivated_at is 'Set when an admin deactivates the account (the sign-in itself is also disabled, see the admin-user-management function). Null = active.';
comment on column profiles.phone is 'Optional, entered by the member. Only used so an exec can text them from their own phone (iMessage); admins can read it, members cannot read each other''s.';

-- Only an admin changes deactivation: same rule as role and member_status (the sign-in itself is also disabled by the
-- admin-user-management function, this just stops the flag being edited from a session that is still alive).
create or replace function prevent_role_self_escalation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not is_admin() then
    new.role := old.role;
  end if;
  if new.member_status is distinct from old.member_status and auth.uid() is not null and not is_admin() then
    new.member_status := old.member_status;
  end if;
  if auth.uid() is not null and not is_admin() then
    new.deactivated_at := old.deactivated_at;
    new.deactivated_by := old.deactivated_by;
  end if;
  return new;
end;
$$;

-- profiles can only be read by the account itself or an admin (profiles_select_own / profiles_select_admin), so the phone
-- column is private to the member and admins.

-- The shared body, used by the admin page (through admin_list_accounts) and by the send function with the service role.
-- Not callable by anyone but the service role.
create function comm_accounts_internal()
returns table (
  member_id uuid,
  display_name text,
  email text,
  role member_role,
  member_status text,
  created_at timestamptz,
  class_year integer,
  avatar_url text,
  phone text,
  deactivated_at timestamptz,
  last_active_at timestamptz,
  views_30d integer
)
language sql
security definer
set search_path = public
stable
as $$
  select
    u.id,
    coalesce(nullif(p.full_name, ''), dir.name, u.email)::text,
    u.email::text,
    p.role,
    p.member_status,
    u.created_at,
    p.class_year,
    p.avatar_url,
    p.phone,
    p.deactivated_at,
    la.last_active_at,
    coalesce(v.views, 0)::integer
  from auth.users u
  join profiles p on p.id = u.id
  left join lateral (
    select pe.name from people pe where lower(trim(pe.email)) = lower(trim(u.email)) limit 1
  ) dir on true
  left join lateral (
    select greatest(
      u.last_sign_in_at,
      (select max(mp.updated_at) from member_preferences mp where mp.id = u.id),
      (select max(ta.updated_at) from tracked_applications ta where ta.member_id = u.id),
      (select max(sj.saved_at) from saved_jobs sj where sj.member_id = u.id),
      (select max(nc.updated_at) from network_connections nc where nc.member_id = u.id),
      (select max(ae.occurred_at) from analytics_events ae where ae.user_id = u.id)
    ) as last_active_at
  ) la on true
  left join lateral (
    select count(*) as views from analytics_events ae where ae.user_id = u.id and ae.occurred_at >= now() - interval '30 days'
  ) v on true
  order by u.created_at asc;
$$;
revoke all on function comm_accounts_internal() from public, anon, authenticated;
grant execute on function comm_accounts_internal() to service_role;

create function admin_list_accounts()
returns table (
  member_id uuid,
  display_name text,
  email text,
  role member_role,
  member_status text,
  created_at timestamptz,
  class_year integer,
  avatar_url text,
  phone text,
  deactivated_at timestamptz,
  last_active_at timestamptz,
  views_30d integer
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
  return query select * from comm_accounts_internal();
end;
$$;
grant execute on function admin_list_accounts() to authenticated;
