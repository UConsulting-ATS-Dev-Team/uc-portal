-- More than one email per account. The account keeps its main (auth) email; a person can attach others and sign in with any of
-- them. Only the site's builder may have more than one ACCOUNT per name (multi_account_owners, filled in by hand); everyone else
-- gets one account and adds emails instead.

-- ---- Extra emails ---------------------------------------------------------------------------------------------------------
create table account_emails (
  email text primary key check (email = lower(trim(email))),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index account_emails_user_idx on account_emails (user_id);
comment on table account_emails is 'Extra sign-in emails for an account (its main email is auth.users.email). Written only through add_account_email / remove_account_email.';

alter table account_emails enable row level security;
create policy account_emails_select_own on account_emails for select to authenticated using (user_id = auth.uid());
create policy account_emails_admin_select on account_emails for select to authenticated using (is_admin());
grant select on account_emails to authenticated;

-- An email that already signs someone in (main or extra), or that belongs to a directory person who has not signed up yet,
-- can't be attached: otherwise anyone could squat on a teammate's address before they sign up.
create or replace function add_account_email(p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(p_email));
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'That does not look like an email address.'; end if;
  if exists (select 1 from auth.users where lower(email::text) = v_email)
     or exists (select 1 from account_emails where email = v_email) then
    raise exception 'That email is already used by an account.';
  end if;
  if exists (select 1 from roster where lower(trim(email)) = v_email)
     or exists (select 1 from people where lower(trim(coalesce(email, ''))) = v_email)
     or exists (select 1 from intern_roster where lower(trim(email)) = v_email) then
    raise exception 'That email belongs to someone on the UC lists. They sign up with it themselves.';
  end if;
  if (select count(*) from account_emails where user_id = auth.uid()) >= 5 then
    raise exception 'An account can have up to 5 extra emails.';
  end if;
  insert into account_emails (email, user_id) values (v_email, auth.uid());
end;
$$;
grant execute on function add_account_email(text) to authenticated;

create or replace function remove_account_email(p_email text) returns void
language sql security definer set search_path = public as $$
  delete from account_emails where email = lower(trim(p_email)) and user_id = auth.uid();
$$;
grant execute on function remove_account_email(text) to authenticated;

-- Sign-in and password reset: the account's main email when the typed one is an extra email, else null. Callable before
-- signing in, so it answers only that one question.
create or replace function resolve_login_email(p_email text) returns text
language sql security definer set search_path = public stable as $$
  select u.email::text
  from account_emails a join auth.users u on u.id = a.user_id
  where a.email = lower(trim(p_email));
$$;
grant execute on function resolve_login_email(text) to anon, authenticated;

-- A sign-up with an email that is already an extra email on someone's account is refused.
create or replace function reject_non_roster_signup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from account_emails where email = lower(trim(new.email))) then
    raise exception 'UC_EMAIL_IN_USE: % is already attached to an account', new.email;
  end if;
  if not can_sign_up(new.email) and not intern_name_available(new.raw_user_meta_data ->> 'full_name') then
    raise exception 'UC_ROSTER_REJECTED: % is not on the UC roster', new.email;
  end if;
  if signup_name_taken(new.email, new.raw_user_meta_data ->> 'full_name') then
    raise exception 'UC_NAME_TAKEN: an account already exists under this name';
  end if;
  return new;
end;
$$;

-- ---- Who may have several accounts ----------------------------------------------------------------------------------------
create table multi_account_owners (
  user_id uuid primary key references auth.users(id) on delete cascade
);
comment on table multi_account_owners is 'Accounts whose name may be reused by further accounts (the site builder, for testing). Filled in by hand; no policies, so only the database owner can read or write it.';
alter table multi_account_owners enable row level security;

-- Was: an admin's name is free to reuse. Now only an account listed in multi_account_owners frees its name.
create or replace function signup_name_taken(check_email text, check_name text) returns boolean
language plpgsql security definer set search_path = public stable as $$
declare
  v_key text := account_name_key(check_email, check_name);
begin
  if v_key = '' then return false; end if;
  if exists (
    select 1 from auth.users u join profiles pr on pr.id = u.id join multi_account_owners m on m.user_id = u.id
    where account_name_key(u.email::text, pr.full_name) = v_key
  ) then return false; end if;
  return exists (
    select 1 from auth.users u join profiles pr on pr.id = u.id
    where lower(trim(u.email::text)) <> lower(trim(check_email))
      and account_name_key(u.email::text, pr.full_name) = v_key
  );
end;
$$;
