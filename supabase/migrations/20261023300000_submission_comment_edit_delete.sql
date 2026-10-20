-- Comments on assignments can be edited and deleted. The author can edit or delete their own; an admin can also delete anyone's
-- (to take down something that shouldn't be there). An edited comment is marked with when it was edited.
alter table accelerator_submission_comments add column if not exists edited_at timestamptz;

create policy "accelerator_submission_comments_update_own" on accelerator_submission_comments
  for update using (author_id = auth.uid()) with check (author_id = auth.uid());

create policy "accelerator_submission_comments_delete" on accelerator_submission_comments
  for delete using (author_id = auth.uid() or is_admin());

grant update (body) on accelerator_submission_comments to authenticated;
grant delete on accelerator_submission_comments to authenticated;

create or replace function accelerator_comment_mark_edited()
returns trigger
language plpgsql
as $$
begin
  if new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists accelerator_comment_mark_edited on accelerator_submission_comments;
create trigger accelerator_comment_mark_edited before update on accelerator_submission_comments
  for each row execute function accelerator_comment_mark_edited();
