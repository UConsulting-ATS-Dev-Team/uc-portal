-- "Late" is judged by when work was FIRST handed in. A resubmission after the committee returned comments or marked it incomplete
-- must not turn an on-time submission late, so the first time is kept separately and never changes.
alter table accelerator_submissions add column if not exists first_submitted_at timestamptz;

-- Existing rows: the time of the latest submit, or earlier if the committee had already commented on it (a comment proves it was
-- handed in before then).
update accelerator_submissions s
set first_submitted_at = least(
  s.submitted_at,
  coalesce((select min(c.created_at) from accelerator_submission_comments c
            join profiles p on p.id = c.author_id
            where c.submission_id = s.id and p.role = 'admin'), s.submitted_at)
)
where first_submitted_at is null;

alter table accelerator_submissions alter column first_submitted_at set default now();
alter table accelerator_submissions alter column first_submitted_at set not null;

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
    new.first_submitted_at := now();
    return new;
  end if;

  new.first_submitted_at := old.first_submitted_at;
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
