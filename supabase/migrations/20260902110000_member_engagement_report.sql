-- Real member-engagement visibility for Admin Dashboard, replacing the
-- "illustrative mock figures" CLAUDE.md's own build notes admit the
-- engagement numbers there have always been. PROJECT_PLAN.md's own user
-- story asks for exactly this: "As an Exec member, I want to see which
-- members haven't engaged with the platform at all, so that I can nudge
-- them before they disengage from UC entirely."
--
-- This is a DIFFERENT, narrower carve-out from the standing "admins see
-- aggregate only, never an individual's data" rule that company_demand_
-- report() and job_track_record_report() both enforce -- this story
-- explicitly wants individual identity ("which members"), since the
-- whole point is enabling individual outreach. What it must NOT expose
-- is *what* a member did -- not their tracked applications, not their
-- preferences content, not their saved jobs. Only presence/absence of
-- activity: a name/email and a single last-active timestamp. A security
-- definer function is still the right mechanism (same reasoning as the
-- other two reports) -- it can read every activity table internally,
-- but its return shape is fixed to identity + one timestamp, so no
-- query against it can ever get application/preference *content* back
-- out, unlike opening RLS access to those tables directly.
--
-- "Last active" is computed as the max of every real activity signal
-- this app actually has: auth.users.last_sign_in_at (did they even log
-- in), member_preferences.updated_at (Onboarding/My Profile edits),
-- tracked_applications.updated_at (tracker use), saved_jobs.saved_at,
-- network_connections.updated_at (coffee chats / saved connections).
-- Any one of these firing counts as "active" that day; none of them
-- individually is exposed, only the max.
--
-- Identity resolution: matched by email against the real `people` table
-- (the real UConsulting Directory import) when possible, since
-- profiles.full_name is usually empty (members rarely fill in My
-- Profile's Personal tab) -- falls back to profiles.full_name, then to
-- the account's own email, never to a fabricated name.

create or replace function member_engagement_report(inactive_threshold_days integer default 14)
returns table (
  member_id uuid,
  display_name text,
  email text,
  last_active_at timestamptz,
  days_inactive integer,
  is_disengaged boolean
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
      coalesce(p.name, prof.full_name, u.email) as display_name,
      u.email,
      la.last_active_at,
      case when la.last_active_at is null then null
           else (extract(day from now() - la.last_active_at))::integer
      end as days_inactive,
      coalesce(la.last_active_at < now() - make_interval(days => inactive_threshold_days), true) as is_disengaged
    from auth.users u
    left join profiles prof on prof.id = u.id
    left join people p on lower(trim(p.email)) = lower(trim(u.email))
    left join lateral (
      select greatest(
        u.last_sign_in_at,
        (select max(mp.updated_at) from member_preferences mp where mp.id = u.id),
        (select max(ta.updated_at) from tracked_applications ta where ta.member_id = u.id),
        (select max(sj.saved_at) from saved_jobs sj where sj.member_id = u.id),
        (select max(nc.updated_at) from network_connections nc where nc.member_id = u.id)
      ) as last_active_at
    ) la on true
    order by la.last_active_at asc nulls first;
end;
$$;

grant execute on function member_engagement_report(integer) to authenticated;
