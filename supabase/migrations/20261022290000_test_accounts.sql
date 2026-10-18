-- Accounts that exist only for testing (the site builder's own intern account, say). They are real accounts and still show on User
-- Management, but they are left out of everything that would make a real person look like they're falling behind: the accelerator's
-- progress, attendance and coffee chat lists for admins, the accelerator reports, and the Interns tab members see. Filled in by
-- hand; no policies, so only the database owner can read or write the table directly.
create table if not exists test_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade
);
comment on table test_accounts is 'Accounts used only for testing. Hidden from accelerator lists and the member-facing intern directory. Filled in by hand; no policies.';
alter table test_accounts enable row level security;

create or replace function admin_list_test_accounts()
returns table (member_id uuid)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not is_admin() then
    raise exception 'admin access required';
  end if;
  return query select t.user_id from test_accounts t;
end;
$$;
grant execute on function admin_list_test_accounts() to authenticated;

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
      and not exists (select 1 from test_accounts t where t.user_id = p.id)
    order by 2;
end;
$$;
grant execute on function list_intern_directory() to authenticated;
