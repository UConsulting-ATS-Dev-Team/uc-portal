-- Admins can pin and unpin any post later. A security-definer function does the change so admins don't need general edit
-- rights on other people's posts, and a trigger keeps everyone else from changing the pin on their own post directly.
create or replace function set_feed_post_pinned(p_id uuid, p_pinned boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Only admins can pin or unpin a post';
  end if;
  update feed_posts set pinned = p_pinned where id = p_id;
end;
$$;
grant execute on function set_feed_post_pinned(uuid, boolean) to authenticated;

create or replace function prevent_non_admin_pin_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.pinned is distinct from old.pinned and not is_admin() then
    raise exception 'Only admins can pin or unpin a post';
  end if;
  return new;
end;
$$;

create trigger feed_posts_pin_guard
  before update on feed_posts
  for each row
  execute function prevent_non_admin_pin_change();
