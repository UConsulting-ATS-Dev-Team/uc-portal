-- Two different things were both called "class": when someone joined UC (their admit class, e.g. "Winter 2026") and when they
-- graduate from UCLA (a year, e.g. 2029). The directory already keeps the admit class as text (people.admit_class); profiles only
-- had the graduation year (profiles.class_year). This adds the admit class to profiles so a member can set it, and exposes both to
-- other members as basic profile info (like the avatar), never for interns, who are not members yet.

alter table profiles add column if not exists admit_class text check (admit_class is null or char_length(admit_class) <= 40);
comment on column profiles.admit_class is 'When the member joined UC, e.g. "Winter 2026". Distinct from class_year, the year they graduate. Entered by the member, prefilled from the directory.';

-- Signed-up members and alumni with a graduation year or admit class set, keyed by email so directory rows can be matched.
create or replace function list_member_class_info()
returns table (email text, class_year integer, admit_class text)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return query
    select u.email::text, p.class_year, p.admit_class
    from auth.users u
    join profiles p on p.id = u.id
    where p.member_status in ('current_member', 'alumni')
      and p.deactivated_at is null
      and (p.class_year is not null or p.admit_class is not null);
end;
$$;
grant execute on function list_member_class_info() to authenticated;

-- The admin list of pronouns and gender also carries the admit class now (an admin sees it on the account card).
drop function if exists admin_list_identity();
create function admin_list_identity()
returns table (member_id uuid, pronouns text, gender text, admit_class text)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not is_admin() then
    raise exception 'admin access required';
  end if;
  return query select p.id, p.pronouns, p.gender, p.admit_class from profiles p where p.pronouns is not null or p.gender is not null or p.admit_class is not null;
end;
$$;
grant execute on function admin_list_identity() to authenticated;
