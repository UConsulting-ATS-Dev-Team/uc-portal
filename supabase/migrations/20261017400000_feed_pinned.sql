-- An announcement is no longer always pinned: admins choose whether to pin it to the top of the feed. Announcements that
-- were already posted were pinned (that was the old behavior), so they stay pinned.
alter table feed_posts add column pinned boolean not null default false;
update feed_posts set pinned = true where post_type = 'Announcement';

create or replace function prevent_non_admin_announcement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.post_type = 'Announcement' or new.pinned) and not is_admin() then
    raise exception 'Only admins can post an Announcement or pin a post';
  end if;
  return new;
end;
$$;
