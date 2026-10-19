-- An assignment is normally due at the next accelerator meeting after its week starts. A lesson can now carry its own due date
-- (and optionally a time) when the committee wants it in earlier, e.g. to leave time for grading. Both are null by default, which
-- keeps the old rule.
alter table accelerator_lessons
  add column if not exists due_date date,
  add column if not exists due_time time;
comment on column accelerator_lessons.due_date is 'Optional override of when the assignment is due. Null = the next accelerator meeting after the week starts.';
comment on column accelerator_lessons.due_time is 'Optional time of day for due_date. Null = the weekly meeting time (or end of day if none is set).';
