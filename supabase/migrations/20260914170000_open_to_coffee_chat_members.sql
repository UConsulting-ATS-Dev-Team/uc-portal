-- Surfaces who's real-opted-in to coffee chats -- closes the last "still
-- mock" pocket: pages/Home.jsx's "Meet X at [followed company]" nudge and
-- pages/Feed.jsx's "Alumni active this week" rail were still reading
-- data/mockPeople.js's 13 fictional people (filtered by a mock
-- openToCoffeeChats flag that real people always default false, per
-- data/realPeopleAdapter.js's own comment -- "no real source data...
-- rather than fabricating a specific claim"). The real source already
-- exists and is already synced: MyProfile.jsx's Recruiting Settings tab's
-- "Open to coffee chat requests from members" toggle writes to
-- member_preferences.recruiting_settings->>'openToCoffeeChatRequests'
-- (20260821200000) -- it just had no cross-member read path, since
-- member_preferences' own RLS is deliberately own-row-only (personal
-- career preferences, never visible to another member).
--
-- Same security-definer pattern as list_messageable_members() -- exposes
-- only what's needed to show/greet someone (id, display name), nothing
-- about their actual preferences/job search.
create or replace function list_open_to_coffee_chat_members()
returns table (member_id uuid, display_name text)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return query
    select u.id as member_id, coalesce(nullif(p.full_name, ''), split_part(u.email, '@', 1)) as display_name
    from auth.users u
    join profiles p on p.id = u.id
    join member_preferences mp on mp.id = u.id
    where u.id <> auth.uid()
      and coalesce((mp.recruiting_settings->>'openToCoffeeChatRequests')::boolean, false) = true
    order by u.created_at asc;
end;
$$;

grant execute on function list_open_to_coffee_chat_members() to authenticated;
