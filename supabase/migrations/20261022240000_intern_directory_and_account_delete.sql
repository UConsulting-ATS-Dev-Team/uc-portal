-- 1. Interns are visible to other members. They are not in the alumni/member directory (`people`), so a member could never find
--    one. This lists the active intern accounts with the basic profile info they chose to enter (never an email address). Any
--    signed-in member may read it, the same way they can read the directory.
create or replace function list_intern_directory()
returns table (member_id uuid, name text, avatar_url text, class_year integer, admit_class text, majors text, linkedin text)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return query
    select p.id,
           coalesce(nullif(trim(p.full_name), ''), (select nullif(trim(ir.name), '') from intern_roster ir where lower(trim(ir.email)) = lower(trim(u.email))), 'Intern')::text,
           p.avatar_url, p.class_year, p.admit_class, p.majors, p.linkedin
    from profiles p
    join auth.users u on u.id = p.id
    where p.member_status = 'intern' and p.deactivated_at is null
    order by 2;
end;
$$;
grant execute on function list_intern_directory() to authenticated;

-- 2. The admin account list carries the admit class for EVERY account, falling back to the directory's when the member hasn't set
--    their own, and whether the account has ever signed in (only an account that never has can be deleted from the page).
drop function if exists admin_list_identity();
create function admin_list_identity()
returns table (member_id uuid, pronouns text, gender text, admit_class text, signed_in boolean)
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
    select p.id,
           p.pronouns,
           p.gender,
           coalesce(p.admit_class, (select pe.admit_class from people pe where lower(trim(pe.email)) = lower(trim(u.email)) and pe.admit_class is not null limit 1)),
           u.last_sign_in_at is not null
    from profiles p
    join auth.users u on u.id = p.id;
end;
$$;
grant execute on function admin_list_identity() to authenticated;
