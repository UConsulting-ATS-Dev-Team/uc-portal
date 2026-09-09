-- Closes a real gap: 20260821130000's profiles_update_own policy only
-- lets a member update their OWN row (id = auth.uid()), and no other
-- policy ever let an admin target someone else's. The self-escalation
-- trigger (20260821160000/20260821170000) already anticipated this --
-- its own comment says "an admin promoting someone else still goes
-- through this table normally" -- but the RLS policy that "normally"
-- depends on never actually existed. Direct requester ask: "if it
-- doesn't already exist, make it so admins can promote other accounts
-- to admin."
create policy "profiles_update_admin" on profiles for update using (is_admin()) with check (is_admin());

-- The Members admin page needs to show *who* it's promoting -- profiles
-- has no email column (auth.users isn't reachable from the client, by
-- design), and full_name is almost always empty (nobody fills in My
-- Profile's Personal tab, same reasoning member_engagement_report()'s
-- own header comment already documents). Same security definer pattern
-- as that function and company_demand_report()/job_track_record_report():
-- admin-gated internally, fixed return shape (identity + role only, no
-- activity/application content), rather than opening RLS on auth.users
-- directly.
create or replace function list_members()
returns table (
  member_id uuid,
  display_name text,
  email text,
  role member_role,
  created_at timestamptz
)
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
    select
      u.id as member_id,
      coalesce(nullif(p.full_name, ''), u.email) as display_name,
      u.email,
      p.role,
      u.created_at
    from auth.users u
    join profiles p on p.id = u.id
    order by u.created_at asc;
end;
$$;

grant execute on function list_members() to authenticated;
