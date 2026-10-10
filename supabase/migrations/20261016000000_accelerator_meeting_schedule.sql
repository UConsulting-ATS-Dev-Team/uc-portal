-- When the accelerator meets each week. The coffee-chat count (3 a week) resets at that day and time, so the site needs to
-- know it. One row only (id is always true). No row means "not set yet": the app then falls back to the accelerator
-- meetings on the calendar. Weekday is 0 (Sunday) to 6 (Saturday); the time is local to whoever is looking, like the calendar.
create table if not exists accelerator_settings (
  id boolean primary key default true check (id),
  meeting_weekday smallint not null check (meeting_weekday between 0 and 6),
  meeting_time time not null,
  updated_at timestamptz not null default now()
);

alter table accelerator_settings enable row level security;

create policy accelerator_settings_select on accelerator_settings for select to authenticated using (true);
create policy accelerator_settings_admin_write on accelerator_settings for all to authenticated using (is_admin()) with check (is_admin());

grant select on accelerator_settings to authenticated;
grant insert, update, delete on accelerator_settings to authenticated;
