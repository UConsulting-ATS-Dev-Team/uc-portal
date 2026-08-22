-- Found by testing the live Approve flow: 20260821130000's
-- "profiles_update_own" policy lets a member update their own profiles row,
-- but its USING clause only checks `id = auth.uid()` -- nothing stops that
-- same update from also changing `role` to 'admin'. A column-scoped RLS
-- policy can't express "this column, but not that one" on its own, so this
-- needs a trigger: silently reverts any change to `role` unless the person
-- making the change is already an admin (an admin promoting someone else
-- still goes through this table normally).

create function prevent_role_self_escalation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role and not is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_self_escalation
  before update on profiles
  for each row execute function prevent_role_self_escalation();
