-- Events get an end time as well as a start time. Optional, because existing events have none; the form asks for it.
alter table accelerator_events add column if not exists end_time time;
alter table accelerator_events add constraint accelerator_events_end_after_start check (end_time is null or start_time is null or end_time > start_time);
