-- Two real buckets for the accelerator program:
-- accelerator-materials: admin-uploaded prep content (slideshows/PDFs/
-- Excel). Public, like avatars -- not sensitive, every authenticated
-- member can already see it via accelerator_materials' own select policy,
-- so a plain public URL avoids signed-URL machinery for no real gain.
-- accelerator-submissions: real assignment work interns upload. Private,
-- own-folder RLS (same shape as resumes) plus a real admin-read-all
-- policy so grading can actually open a submitted file.

insert into storage.buckets (id, name, public)
values ('accelerator-materials', 'accelerator-materials', true)
on conflict (id) do nothing;

create policy "Admins can upload accelerator materials"
on storage.objects for insert
to authenticated
with check (bucket_id = 'accelerator-materials' and is_admin());

create policy "Admins can replace accelerator materials"
on storage.objects for update
to authenticated
using (bucket_id = 'accelerator-materials' and is_admin());

create policy "Admins can delete accelerator materials"
on storage.objects for delete
to authenticated
using (bucket_id = 'accelerator-materials' and is_admin());

insert into storage.buckets (id, name, public)
values ('accelerator-submissions', 'accelerator-submissions', false)
on conflict (id) do nothing;

create policy "Interns can read their own submission files"
on storage.objects for select
to authenticated
using (bucket_id = 'accelerator-submissions' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Interns can upload their own submission files"
on storage.objects for insert
to authenticated
with check (bucket_id = 'accelerator-submissions' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Interns can replace their own submission files"
on storage.objects for update
to authenticated
using (bucket_id = 'accelerator-submissions' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Admins can read any accelerator submission file"
on storage.objects for select
to authenticated
using (bucket_id = 'accelerator-submissions' and is_admin());
