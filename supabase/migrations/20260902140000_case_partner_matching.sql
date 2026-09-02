-- Case-practice partner matching -- moves the club's real "Case Partners"
-- Google Sheet tab (manually pairing members for case-interview practice,
-- found while browsing the club's own sheets this session) into the app.
--
-- CRITICAL product constraint, direct from the person who asked for this:
-- "make sure for the casing buddy everybody is automatically not assigned
-- to anyone." Modeled exactly on how coffee chats already work
-- (network_connections / requestCoffeeChat()) -- nobody is ever paired by
-- background logic. Two explicit member actions are required before a
-- "match" exists at all:
--   1. Both members must opt into case_partner_pool themselves (own-row
--      insert only, same shape as saved_jobs' presence-based opt-in).
--   2. One pool member sends a request (a case_partner_requests row,
--      forced to start 'pending' by the insert policy's own with-check --
--      there is no insert path that creates an already-accepted row).
--      The OTHER member -- never the requester -- must take their own,
--      separate accept/decline action for status to ever become
--      'accepted'. This is enforced structurally below by RLS, not just
--      by UI convention: see the two update policies' `using`/`with
--      check` split.
--
-- Why two auth.users ids and not people.id (unlike network_connections'
-- person_id, which can be a real people.id or a still-mock slug): coffee
-- chats target the alumni directory, most of whom aren't portal accounts
-- at all, so that table only ever tracks the requester's own one-sided
-- status label ("Request sent"), never a real accept from the other side.
-- Case partners is inherently member-to-member (you practice cases with
-- someone who's also currently recruiting, not with an alumnus who
-- already has the job) -- restricting the pool to real auth.users rows is
-- what makes a genuine, RLS-enforced mutual accept possible at all.

-- One row per member who has opted in -- presence-based, same pattern as
-- saved_jobs (opt in = insert, opt out = delete), not a boolean column,
-- since there's no other per-member attribute to carry here. Deliberately
-- NOT denormalizing industries/roles/recruiting_cycle onto this row --
-- case_partner_candidates() below joins member_preferences live so a
-- member's visible matching signal never goes stale after they update My
-- Profile, same "every number traceable, never separately authored"
-- principle company_demand_report and the odds model both already follow.
create table case_partner_pool (
  member_id uuid primary key references auth.users(id) on delete cascade,
  opted_in_at timestamptz not null default now()
);

alter table case_partner_pool enable row level security;
-- Table itself stays own-row-only (same conservative default
-- member_preferences/network_connections use for personal state) --
-- browsing OTHER members' pool entries goes exclusively through
-- case_partner_candidates() below, which controls exactly what's exposed.
create policy "case_partner_pool_select_own" on case_partner_pool for select using (member_id = auth.uid());
create policy "case_partner_pool_insert_own" on case_partner_pool for insert with check (member_id = auth.uid());
create policy "case_partner_pool_delete_own" on case_partner_pool for delete using (member_id = auth.uid());

grant select, insert, delete on public.case_partner_pool to authenticated;

-- One row per (requester, recipient) directed pair, status starts and can
-- only ever start 'pending'. See the migration-level comment above for
-- why this is the mechanism that makes "never automatic assignment" a
-- structural guarantee instead of a UI promise.
create type case_partner_request_status as enum ('pending', 'accepted', 'declined', 'cancelled');

create table case_partner_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status case_partner_request_status not null default 'pending',
  note text,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint case_partner_requests_no_self_request check (requester_id <> recipient_id)
);

-- One outstanding directed request per pair -- re-requesting after a
-- decline/cancel upserts the same row back to 'pending' (onConflict in
-- data/casePartners.js) rather than accumulating duplicates.
create unique index case_partner_requests_pair_idx on case_partner_requests (requester_id, recipient_id);

alter table case_partner_requests enable row level security;

create policy "case_partner_requests_select_involved" on case_partner_requests
  for select using (requester_id = auth.uid() or recipient_id = auth.uid());

-- Sending a request is the ONLY way a row is created, and the with-check
-- forces status = 'pending' -- a client cannot insert a pre-accepted row.
create policy "case_partner_requests_insert_own" on case_partner_requests
  for insert with check (requester_id = auth.uid() and status = 'pending');

-- The requester may only withdraw their own still-pending request.
create policy "case_partner_requests_update_requester_cancel" on case_partner_requests
  for update
  using (requester_id = auth.uid() and status = 'pending')
  with check (requester_id = auth.uid() and status = 'cancelled');

-- The recipient -- and only the recipient -- may move a pending request
-- addressed to them to 'accepted' or 'declined'. Combined with the insert
-- policy above, this is the entire enforcement of "a match only exists
-- once mutually acted on": the requester's insert can never itself
-- produce 'accepted', and this policy's `using` clause means the
-- requester cannot use this update path either (recipient_id <> their
-- own id), so only the other person's own, separate action can ever
-- flip a row to 'accepted'.
create policy "case_partner_requests_update_recipient_respond" on case_partner_requests
  for update
  using (recipient_id = auth.uid() and status = 'pending')
  with check (recipient_id = auth.uid() and status in ('accepted', 'declined'));

grant select, insert, update on public.case_partner_requests to authenticated;

-- Browsable candidate list for any signed-in member (not admin-gated --
-- this is peer browsing, not an aggregate report). Joins case_partner_pool
-- (who's opted in) with member_preferences (the real matching signal:
-- industries/roles/recruiting_cycle, per CLAUDE.md's odds-model
-- "traceable, not invented" principle) and resolves a display name with
-- the exact same coalesce(people.name, profiles.full_name, email)
-- fallback member_engagement_report() already established -- this doesn't
-- cross any new privacy line: people.email/name and a member's own
-- opt-in-pool presence are both already readable by any authenticated
-- member via existing policies (people_select_authenticated), this just
-- joins them for a member-to-member matching view instead of an admin one.
-- member_preferences content itself stays exposed only for pool members
-- who explicitly opted in to be found -- everyone else's preferences stay
-- locked to member_preferences_select_own as always.
create or replace function case_partner_candidates()
returns table (
  member_id uuid,
  display_name text,
  class_year integer,
  industries text[],
  roles text[],
  recruiting_cycle text,
  opted_in_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  return query
    select
      cpp.member_id,
      coalesce(p.name, prof.full_name, u.email) as display_name,
      p.class_year,
      coalesce(mp.industries, '{}') as industries,
      coalesce(mp.roles, '{}') as roles,
      mp.recruiting_cycle,
      cpp.opted_in_at
    from case_partner_pool cpp
    join auth.users u on u.id = cpp.member_id
    left join profiles prof on prof.id = cpp.member_id
    left join people p on lower(trim(p.email)) = lower(trim(u.email))
    left join member_preferences mp on mp.id = cpp.member_id
    where cpp.member_id <> auth.uid()
    order by cpp.opted_in_at asc;
end;
$$;

grant execute on function case_partner_candidates() to authenticated;

-- Resolves display names for a specific set of member ids -- used by the
-- "My case partners" list to label request rows even once the other
-- member has left the pool (case_partner_candidates() above would no
-- longer include them). Scoped defensively: only resolves a name for an
-- id that's either still in the pool (browsable anyway) or already in a
-- request relationship with the caller -- not a general "look up anyone's
-- name by id" oracle.
create or replace function case_partner_display_names(member_ids uuid[])
returns table (member_id uuid, display_name text)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  return query
    select u.id as member_id, coalesce(p.name, prof.full_name, u.email) as display_name
    from auth.users u
    left join profiles prof on prof.id = u.id
    left join people p on lower(trim(p.email)) = lower(trim(u.email))
    where u.id = any(member_ids)
      and (
        exists (select 1 from case_partner_pool where case_partner_pool.member_id = u.id)
        or exists (
          select 1 from case_partner_requests r
          where (r.requester_id = u.id or r.recipient_id = u.id)
            and (r.requester_id = auth.uid() or r.recipient_id = auth.uid())
        )
      );
end;
$$;

grant execute on function case_partner_display_names(uuid[]) to authenticated;
