-- Admins could never actually delete an accelerator file from Storage.
--
-- The accelerator-materials bucket had admin INSERT/UPDATE/DELETE policies but
-- no SELECT policy for authenticated users (the bucket is public, so reads by
-- URL never needed one). Storage's remove() runs a DELETE ... RETURNING, which
-- also needs the row to be visible, so for an admin it matched nothing and
-- returned an empty result with no error. The practical effect: "Remove" on a
-- lesson's prep material, and deleting a lesson, deleted the database row but
-- left the file behind -- still fetchable by its public URL after the admin
-- believed it was gone.
--
-- Public reads by URL are unaffected; this only lets an admin's own client see
-- the objects it is allowed to delete.
create policy "Admins can read accelerator materials"
  on storage.objects for select to authenticated
  using (bucket_id = 'accelerator-materials' and is_admin());

-- Deleting a lesson cascades its submission rows, but the interns' uploaded
-- files live in the private submissions bucket, where admins could read but not
-- delete. Without this they would be orphaned (and unreachable) forever.
create policy "Admins can delete accelerator submission files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'accelerator-submissions' and is_admin());
