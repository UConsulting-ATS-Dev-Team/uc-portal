-- Real back-and-forth comments on an accelerator submission, separate
-- from the existing score/feedback fields on accelerator_submissions
-- (that single `feedback` column is the official one-shot grading note;
-- this is a real multi-message thread for clarifying questions either
-- side wants to ask -- the actual gap flagged auditing this feature
-- against a Google-Classroom checklist). Readable/writable by the
-- submission's own intern or any admin -- nobody else's business.
create table accelerator_submission_comments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references accelerator_submissions(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
comment on table accelerator_submission_comments is 'Real multi-message comment thread per submission, between the intern and admins -- separate from the single official score/feedback fields on accelerator_submissions.';

alter table accelerator_submission_comments enable row level security;

create policy "accelerator_submission_comments_select" on accelerator_submission_comments
  for select using (
    is_admin() or exists (
      select 1 from accelerator_submissions s
      where s.id = submission_id and s.profile_id = auth.uid()
    )
  );

create policy "accelerator_submission_comments_insert" on accelerator_submission_comments
  for insert with check (
    author_id = auth.uid() and (
      is_admin() or exists (
        select 1 from accelerator_submissions s
        where s.id = submission_id and s.profile_id = auth.uid()
      )
    )
  );
