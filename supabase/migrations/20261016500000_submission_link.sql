-- Interns do their work in Google Docs, Sheets or Slides (or Word, Excel, PowerPoint files), so a submission can be a link to
-- the work, not only typed text or an upload. Changing the link on an incomplete submission sends it back to review, like the
-- other work fields do.
alter table accelerator_submissions add column if not exists link_url text;
alter table accelerator_submissions add constraint accelerator_submissions_link_is_web check (link_url is null or link_url ~* '^https?://');

create or replace function accelerator_submission_guard()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null or is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := null;
    new.feedback := null;
    new.graded_by := null;
    new.graded_at := null;
    return new;
  end if;

  new.feedback := old.feedback;
  new.graded_by := old.graded_by;
  if old.status = 'incomplete'
     and (new.body is distinct from old.body or new.file_path is distinct from old.file_path or new.link_url is distinct from old.link_url) then
    new.status := null;
    new.graded_at := null;
  else
    new.status := old.status;
    new.graded_at := old.graded_at;
  end if;
  return new;
end;
$$;
