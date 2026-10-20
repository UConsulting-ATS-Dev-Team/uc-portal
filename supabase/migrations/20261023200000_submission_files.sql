-- A submission can carry several uploaded files, not just one. `files` is a list of {path, name}; file_path/file_name stay as the
-- first file so older rows and the clean-up code keep working. Existing single files are copied into the list.
alter table accelerator_submissions add column if not exists files jsonb not null default '[]'::jsonb;

update accelerator_submissions
set files = jsonb_build_array(jsonb_build_object('path', file_path, 'name', coalesce(file_name, 'File')))
where file_path is not null and files = '[]'::jsonb;

-- Changing the work (text, files or link) on an incomplete submission sends it back to review; `files` counts as work now.
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
     and (new.body is distinct from old.body or new.file_path is distinct from old.file_path or new.link_url is distinct from old.link_url
          or new.files is distinct from old.files) then
    new.status := null;
    new.graded_at := null;
  else
    new.status := old.status;
    new.graded_at := old.graded_at;
  end if;
  return new;
end;
$$;
