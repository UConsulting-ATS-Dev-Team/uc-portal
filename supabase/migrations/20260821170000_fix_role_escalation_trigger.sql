-- Fixes a bug in the previous migration's own fix: prevent_role_self_escalation()
-- checked `not is_admin()`, but is_admin() depends on auth.uid(), which is
-- NULL when SQL runs from the dashboard's SQL Editor (no PostgREST/user
-- session context there) -- so is_admin() evaluated false and the trigger
-- silently blocked even a legitimate dashboard-run "make this account an
-- admin" update, not just a client-side self-escalation attempt. The fix:
-- only block the role change when there IS an authenticated client session
-- attempting it (auth.uid() is not null) and that session isn't already an
-- admin. A NULL auth.uid() means this is running outside PostgREST entirely
-- (the SQL Editor, a service_role script) -- exactly the legitimate
-- first-admin bootstrap path -- so it's left alone.

create or replace function prevent_role_self_escalation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;
