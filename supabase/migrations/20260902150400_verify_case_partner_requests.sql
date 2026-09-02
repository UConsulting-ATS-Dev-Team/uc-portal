-- Self-contained, self-cleaning live verification of the previous
-- migration's RLS enforcement -- same "temporary migration" pattern this
-- repo already uses (20260831230100, 20260902130200), taken one step
-- further here: those tests ran entirely as the migration's own superuser
-- role, which bypasses RLS and so could only verify function OUTPUT, not
-- the RLS boundary itself. This test genuinely switches to the
-- `authenticated` Postgres role and impersonates two real, existing
-- auth.users (never fabricated -- same "reuse an existing seeded user"
-- convention 20260831230100 established) via the same
-- request.jwt.claims/sub GUC PostgREST itself sets per request, so the
-- policies below are exercised for real, not just read as SQL text.
--
-- Discovered via a throwaway diagnostic (dropped by the next migration)
-- that this project's migration connection logs in as a low-privilege
-- `cli_login_postgres` role and only gains real privileges via an
-- implicit `SET ROLE postgres` before the migration body runs -- so
-- `RESET ROLE` (which reverts to session_user, i.e. cli_login_postgres)
-- does NOT restore privileges the way it would on a normal superuser
-- login. Every role hand-back below uses `set local role postgres`
-- explicitly instead of `reset role` for exactly this reason.
--
-- This is the actual proof behind CLAUDE.md's "opt-in flow, never
-- automatic pairing" requirement: it demonstrates a request cannot be
-- inserted pre-accepted, the requester cannot accept their own request,
-- and only the recipient's own, separate action can ever produce
-- 'accepted'.
do $$
declare
  user_a uuid;
  user_b uuid;
  req_id uuid;
  candidate_count integer;
  blocked boolean;
begin
  select id into user_a from auth.users order by created_at limit 1;
  select id into user_b from auth.users where id <> user_a order by created_at limit 1;
  if user_a is null or user_b is null then
    raise notice 'Fewer than 2 auth.users rows exist -- skipping case partner live RLS test.';
    return;
  end if;

  -- Clear any residue from a previous failed run before starting.
  delete from case_partner_requests where requester_id in (user_a, user_b) and recipient_id in (user_a, user_b);
  delete from case_partner_pool where member_id in (user_a, user_b);

  -- Step 1: user_a opts themselves in -- their own explicit action.
  perform set_config('request.jwt.claims', json_build_object('sub', user_a::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into case_partner_pool (member_id) values (user_a);
  set local role postgres;

  -- Attempt: user_a tries to opt user_b into the pool on b's behalf --
  -- must be blocked by case_partner_pool_insert_own.
  perform set_config('request.jwt.claims', json_build_object('sub', user_a::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  blocked := false;
  begin
    insert into case_partner_pool (member_id) values (user_b);
  exception when insufficient_privilege then
    blocked := true;
  end;
  set local role postgres;
  if not blocked then
    delete from case_partner_pool where member_id = user_b;
    raise exception 'RLS did not block user_a from opting user_b into the pool on their behalf';
  end if;

  -- Step 2: user_b opts themselves in -- their own explicit action.
  perform set_config('request.jwt.claims', json_build_object('sub', user_b::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into case_partner_pool (member_id) values (user_b);
  set local role postgres;

  -- Step 3: user_a should now see user_b via case_partner_candidates().
  perform set_config('request.jwt.claims', json_build_object('sub', user_a::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into candidate_count from case_partner_candidates() where member_id = user_b;
  set local role postgres;
  if candidate_count <> 1 then
    raise exception 'case_partner_candidates() did not surface the opted-in counterpart: count=%', candidate_count;
  end if;

  -- Step 4: user_a sends a request to user_b -- must land 'pending'.
  perform set_config('request.jwt.claims', json_build_object('sub', user_a::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into case_partner_requests (requester_id, recipient_id, note)
    values (user_a, user_b, 'live verification row -- deleted before commit')
    returning id into req_id;
  set local role postgres;

  if (select status from case_partner_requests where id = req_id) <> 'pending' then
    raise exception 'New request did not start pending';
  end if;

  -- Attempt: insert a request that starts already-accepted (reverse
  -- direction b->a, a distinct pair from a->b above, so this isolates the
  -- with-check test from the unique-pair index) -- must be blocked.
  perform set_config('request.jwt.claims', json_build_object('sub', user_b::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  blocked := false;
  begin
    insert into case_partner_requests (requester_id, recipient_id, status) values (user_b, user_a, 'accepted');
  exception when insufficient_privilege then
    blocked := true;
  end;
  set local role postgres;
  if not blocked then
    delete from case_partner_requests where requester_id = user_b and recipient_id = user_a;
    raise exception 'RLS allowed inserting an already-accepted request row directly';
  end if;

  -- Attempt: the requester (a) tries to accept their own pending request
  -- -- must be blocked (only the recipient's own update path may accept).
  perform set_config('request.jwt.claims', json_build_object('sub', user_a::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  blocked := false;
  begin
    update case_partner_requests set status = 'accepted' where id = req_id;
  exception when insufficient_privilege then
    blocked := true;
  end;
  set local role postgres;
  if not blocked and (select status from case_partner_requests where id = req_id) <> 'pending' then
    raise exception 'Requester was able to self-accept their own request (status=%)', (select status from case_partner_requests where id = req_id);
  end if;

  -- Step 5: the recipient (b) accepts -- the only path that can ever
  -- produce 'accepted'.
  perform set_config('request.jwt.claims', json_build_object('sub', user_b::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update case_partner_requests set status = 'accepted', responded_at = now() where id = req_id;
  set local role postgres;

  if (select status from case_partner_requests where id = req_id) <> 'accepted' then
    raise exception 'Recipient accept did not take effect';
  end if;

  raise notice 'case_partner live RLS test passed: own-row-only opt-in, insert forced to pending, self-accept blocked, recipient-only accept succeeded.';

  -- Cleanup (back on the postgres role at this point) -- removes every
  -- row this test created so nothing is left behind on success.
  delete from case_partner_requests where requester_id in (user_a, user_b) and recipient_id in (user_a, user_b);
  delete from case_partner_pool where member_id in (user_a, user_b);

  if exists (select 1 from case_partner_requests where requester_id in (user_a, user_b) and recipient_id in (user_a, user_b))
     or exists (select 1 from case_partner_pool where member_id in (user_a, user_b)) then
    raise exception 'Test cleanup left residue';
  end if;

  raise notice 'All case_partner_pool/case_partner_requests live RLS tests passed and left zero residue.';
end $$;
