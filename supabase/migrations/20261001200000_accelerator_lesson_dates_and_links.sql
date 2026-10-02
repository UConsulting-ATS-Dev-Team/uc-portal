-- Real ask: lessons were entered by a manual "week #" that collided with
-- the club's own quarter numbering (the accelerator's real week 1 lands in
-- the quarter's week 3), which read as confusing. Replaced with a real
-- calendar date per lesson (lesson_date) -- the actual date that week's
-- content/assignment goes live and is due -- with "Accelerator Week N" now
-- computed client-side from chronological order instead of hand-entered,
-- so it can never again disagree with the real calendar. Backfills any
-- existing rows from their old week_number before dropping it, so this is
-- safe whether the table has 0 or N rows.
alter table accelerator_lessons add column lesson_date date;
update accelerator_lessons
  set lesson_date = (current_date + (week_number - 1) * interval '7 days')::date
  where lesson_date is null;
alter table accelerator_lessons alter column lesson_date set not null;
alter table accelerator_lessons drop column week_number;

-- Real ask: a place to attach a link (not just an uploaded file) to a
-- lesson, alongside file uploads -- some real prep material (a Google
-- Slides deck, an article) isn't a file to upload at all. file_name stays
-- the shared display label for either kind (a link's own chosen title, or
-- an uploaded file's real filename); exactly one of file_path/link_url is
-- ever set.
alter table accelerator_materials alter column file_path drop not null;
alter table accelerator_materials add column link_url text;
alter table accelerator_materials add constraint accelerator_materials_file_or_link check (
  (file_path is not null and link_url is null) or
  (file_path is null and link_url is not null)
);
