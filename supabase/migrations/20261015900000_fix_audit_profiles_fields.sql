-- Fixes audit_profiles_change() from 20261015500000: `text[] || 'name'` reads the literal as an array and fails ("malformed array
-- literal"), which would have rejected an admin's edit of someone else's name, class year or phone. array_append() is unambiguous.
create or replace function audit_profiles_change() returns trigger language plpgsql security definer set search_path = public as $$
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
    if new.full_name is distinct from old.full_name then v_fields := array_append(v_fields, 'name'); end if;
    if new.class_year is distinct from old.class_year then v_fields := array_append(v_fields, 'class year'); end if;
    if new.phone is distinct from old.phone then v_fields := array_append(v_fields, 'phone'); end if;
    if cardinality(v_fields) > 0 then
      perform log_admin_action('account_edited', 'account', new.id::text, audit_person_label(new.id), jsonb_build_object('fields', to_jsonb(v_fields)), v_actor);
    end if;
  end if;
  return new;
end;
$$;
