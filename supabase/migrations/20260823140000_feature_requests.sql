-- Lets a member request a feature through the portal instead of texting
-- someone and hoping it's remembered, and gives admins a real queue to
-- triage and track it through to done -- explicitly NOT anonymized/
-- aggregated like company_demand_report or member_preferences: the whole
-- point here is admins see exactly who asked for what, so the identity
-- fields are real, not a privacy boundary to enforce.
--
-- submitted_by_name is denormalized (captured from the submitter's own
-- data/mockUser.js currentUser at submission time, the same prototype
-- identity-display convention MyProfile's Personal tab already uses)
-- rather than joined from profiles.full_name, which nothing in this app
-- populates yet -- this avoids a bigger identity-plumbing project just to
-- show a name in an admin list.

create type feature_request_status as enum ('pending', 'approved', 'in_progress', 'done', 'declined');

create table feature_requests (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references auth.users(id),
  submitted_by_name text not null,
  title text not null,
  description text not null,
  category text,
  status feature_request_status not null default 'pending',
  admin_notes text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table feature_requests enable row level security;
-- A member can submit and see their own requests -- lets them check back
-- on status rather than only firing-and-forgetting.
create policy "feature_requests_insert_own" on feature_requests for insert with check (submitted_by = auth.uid());
create policy "feature_requests_select_own" on feature_requests for select using (submitted_by = auth.uid());
-- Admins see and triage every request -- this is the actual point of the
-- feature, not a boundary to work around like the demand-report function.
create policy "feature_requests_select_admin" on feature_requests for select using (is_admin());
create policy "feature_requests_update_admin" on feature_requests for update using (is_admin());

-- Same gap every other table in this project has hit -- explicit grants
-- required even for roles RLS would otherwise allow through.
grant select, insert on public.feature_requests to authenticated;
grant update on public.feature_requests to authenticated;
