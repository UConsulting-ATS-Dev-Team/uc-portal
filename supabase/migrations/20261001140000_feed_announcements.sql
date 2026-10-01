-- Real "Post announcement" -- direct ask ("should actually bring
-- something up to post announcements and make them stay like a real
-- announcement would"). Reuses the real feed_posts table/pipeline
-- (same real insert/select/RLS this app already has) with a new
-- post_type rather than inventing a parallel announcements table --
-- an announcement is a real post, just one only admins can create and
-- that the UI pins to the top.
alter table feed_posts drop constraint feed_posts_post_type_check;
alter table feed_posts add constraint feed_posts_post_type_check
  check (post_type in ('UC-posted job', 'Interview write-up', 'Advice', 'Event', 'Announcement'));

-- DB-level guard, not just a UI that hides the option from non-admins --
-- same "defense in depth" precedent prevent_role_self_escalation()
-- already set for a different column. feed_posts_insert_own's own RLS
-- only checks author_id = auth.uid(), with no restriction on post_type,
-- so without this a non-admin could still post an "Announcement" via a
-- direct API call even though the real UI never offers that option.
create or replace function prevent_non_admin_announcement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.post_type = 'Announcement' and not is_admin() then
    raise exception 'Only admins can post an Announcement';
  end if;
  return new;
end;
$$;

create trigger feed_posts_announcement_guard
  before insert on feed_posts
  for each row
  execute function prevent_non_admin_announcement();
