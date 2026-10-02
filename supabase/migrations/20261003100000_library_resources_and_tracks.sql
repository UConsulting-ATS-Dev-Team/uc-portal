-- Real, admin-managed Career Resources library and learning tracks --
-- replaces data/mockResources.js's static RESOURCES / LEARNING_TRACKS,
-- which carried fabricated authors ("Demo Alum A"), view/completion counts,
-- "2.4x higher advance rate" outcome claims, and fake workshop dates.
-- Nothing here is UC-specific data a browser could compute, so it is plain
-- admin-authored content: readable by any signed-in member, writable only
-- by admins (same shape as accelerator_lessons / resource_guide_files).
-- An uploaded guide file for a resource still lives in resource_guide_files,
-- keyed by this table's id (as text).
create table library_resources (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  category text not null,
  format text not null default 'Guide',
  description text not null default '' check (char_length(description) <= 2000),
  -- Ordered checklist entries shown on the resource page (may be empty).
  sections text[] not null default '{}',
  -- Optional external link ("Open guide" target when no file is uploaded).
  link_url text,
  -- Optional admin-written note shown as "UC-specific notes".
  notes text check (notes is null or char_length(notes) <= 2000),
  author_name text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table learning_tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  category text not null,
  summary text not null default '' check (char_length(summary) <= 500),
  -- [{ "title": text, "type": text, "detail": text, "url": text|null, "hours": number|null }]
  steps jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table library_resources enable row level security;
alter table learning_tracks enable row level security;

create policy "library_resources_select_authenticated" on library_resources for select to authenticated using (true);
create policy "library_resources_admin_write" on library_resources for all to authenticated using (is_admin()) with check (is_admin());
create policy "learning_tracks_select_authenticated" on learning_tracks for select to authenticated using (true);
create policy "learning_tracks_admin_write" on learning_tracks for all to authenticated using (is_admin()) with check (is_admin());

-- One real starter track built only from third-party courses that already
-- appear (with verified URLs) in data/certifications.js -- no UC-specific
-- claims, so nothing here needs to be invented.
insert into learning_tracks (title, category, summary, steps)
select
  'Excel, SQL & Finance Fundamentals',
  'Excel & modeling',
  'Free third-party courses, in a sensible order',
  jsonb_build_array(
    jsonb_build_object('title', 'Excel Skills for Business', 'type', 'Course', 'detail', 'Coursera (Macquarie University, audit free)', 'url', 'https://www.coursera.org/specializations/excel', 'hours', 20),
    jsonb_build_object('title', 'SQL Tutorial', 'type', 'Course', 'detail', 'Mode Analytics', 'url', 'https://mode.com/sql-tutorial/', 'hours', 8),
    jsonb_build_object('title', 'Introduction to 3-Statement Financial Modeling', 'type', 'Course', 'detail', 'Corporate Finance Institute (free preview)', 'url', 'https://corporatefinanceinstitute.com/course/intro-3-statement-modeling/', 'hours', 15)
  )
where not exists (select 1 from learning_tracks where title = 'Excel, SQL & Finance Fundamentals');
