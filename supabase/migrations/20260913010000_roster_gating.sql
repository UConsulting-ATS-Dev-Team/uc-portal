-- Real roster-gating -- closes the gap flagged in a pre-production audit
-- (2026-09-13): pages/SignIn.jsx's "not on the roster" / "access pending"
-- states were pure UI simulation (its own header comment: "there's no real
-- roster data source yet"), and supabase.auth.signUp() had zero real
-- restriction -- literally anyone who could complete Supabase's own email
-- confirmation got a real account with full member access to private club
-- data (the real alumni directory, real interview write-ups with names
-- attached, etc.). That directly contradicts CLAUDE.md's own stated
-- purpose ("private, members-only... invite only").
--
-- Deliberately NOT built against the existing `people` table (the real
-- UConsulting Directory import target) -- confirmed live that table is
-- still empty on this paid project (the directory migration is a separate,
-- already-known-pending task, waiting on the user switching the Supabase
-- CLI back to their personal account). Gating real signups on an empty
-- table would lock out every real member today. `roster` is a small,
-- dedicated, independently-populatable email allowlist -- "who's allowed
-- to create an account" is a genuinely different question from "the
-- browsable member/alumni directory," even though the same 52 real
-- current members (Sept 2026) will eventually appear in both.
--
-- Design: reject at signup, not "create then restrict." A rejected email
-- never gets an auth.users/profiles row at all -- much smaller blast
-- radius than an "approved" flag every existing RLS policy across the app
-- would otherwise need to check, and it matches the wireframe's original
-- "not on the roster" state exactly: an honest, immediate answer, not a
-- fake account sitting around in a restricted state.
create table roster (
  email text primary key,
  name text,
  class_year integer,
  added_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
comment on table roster is 'Real email allowlist gating account creation -- see this migration''s own header comment for why it''s separate from the (currently empty) people table.';

alter table roster enable row level security;
create policy "roster_admin_all" on roster for all using (is_admin()) with check (is_admin());
-- Deliberately NO select-for-authenticated policy -- the roster itself
-- (who's allowed in) isn't something a regular member needs to browse;
-- only is_on_roster() below needs to read it, and that function is
-- security definer so RLS doesn't block its own internal query.

-- "Alumni -- request access" (reachable from the sign-in screen before any
-- account exists, so this has to accept an anonymous insert -- there is no
-- auth.uid() yet to scope it to, unlike feature_requests' "insert your own,
-- read your own" pattern). Admin-reviewable queue, same shape as
-- feature_requests: pending -> approved/declined.
create table access_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  message text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz
);

alter table access_requests enable row level security;
-- Basic sanity check only (non-empty email) -- real anti-abuse (rate
-- limiting a public anonymous-insert endpoint) is a known, documented
-- limitation, not attempted here; low realistic risk for a small club
-- tool, but worth remembering if this ever needs hardening.
create policy "access_requests_insert_anon" on access_requests for insert to anon, authenticated with check (email is not null and length(trim(email)) > 0);
create policy "access_requests_select_admin" on access_requests for select using (is_admin());
create policy "access_requests_update_admin" on access_requests for update using (is_admin());

-- Case/whitespace-insensitive match -- real signup emails won't always be
-- typed with the exact casing/whitespace a roster entry was added with.
create or replace function is_on_roster(check_email text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from roster where lower(trim(email)) = lower(trim(check_email))
  );
$$;

-- The actual enforcement point. BEFORE INSERT (not AFTER, unlike the
-- existing handle_new_user() profile-creation trigger) so raising an
-- exception here aborts the whole auth.users insert transactionally --
-- supabase.auth.signUp() surfaces this as a real error to the client, and
-- no auth.users/profiles row is ever created for a rejected email. A
-- distinctive, literal exception message (not a generic Postgres error)
-- so the frontend can reliably distinguish "not on the roster" from any
-- other real signup failure (a malformed email, a duplicate account, a
-- network error) rather than guessing from Postgres's own wording.
create or replace function reject_non_roster_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_on_roster(new.email) then
    raise exception 'UC_ROSTER_REJECTED: % is not on the UC roster', new.email;
  end if;
  return new;
end;
$$;

create trigger before_auth_user_created
  before insert on auth.users
  for each row execute function reject_non_roster_signup();

-- Seeds the one real, already-verified email this session confirmed as a
-- real admin account (jflowenberg@gmail.com) -- harmless/no-op for that
-- account specifically, since it already has a real auth.users row from
-- before this trigger existed (this only gates NEW signups) -- included so
-- a future fresh signup attempt under this same email (e.g. if the
-- account were ever recreated) isn't rejected. Every other real member's
-- email still needs to be added by the user directly or via the new
-- admin approval queue (pages/AdminDashboard.jsx) -- this migration
-- deliberately does not invent or guess any other real person's email.
insert into roster (email, name) values ('jflowenberg@gmail.com', 'Admin (seed)');
