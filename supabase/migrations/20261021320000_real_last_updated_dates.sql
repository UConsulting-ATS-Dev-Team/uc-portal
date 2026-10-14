-- "Last updated" has to mean something. Two things made it meaningless:
--  1. member_preferences.updated_at was rewritten by the app's background sync on every sign-in, even when nothing changed, so it
--     only ever said "last time they opened the site". It now only moves when a saved value actually changes.
--  2. profiles.profile_last_updated started from a made-up placeholder date (2026-08-02) in the app and was saved back for everyone
--     who opened their profile. That exact value is cleared; real saves carry their own timestamps.

create or replace function keep_updated_at_when_unchanged()
returns trigger language plpgsql as $$
begin
  if (to_jsonb(new) - 'updated_at') = (to_jsonb(old) - 'updated_at') then
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;

drop trigger if exists member_preferences_keep_updated_at on member_preferences;
create trigger member_preferences_keep_updated_at
  before update on member_preferences
  for each row execute function keep_updated_at_when_unchanged();

update profiles set profile_last_updated = null where profile_last_updated = timestamptz '2026-08-02 12:00:00+00';
