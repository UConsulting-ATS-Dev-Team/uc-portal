-- Real resume upload + parsing. Unlike avatars, a resume is genuinely
-- sensitive real PII (address/phone on many templates, full work and
-- education history) -- private bucket, own-folder-only RLS for every
-- operation (read included), no public/cross-member access at all. Nothing
-- in this app shows another member's resume, so there's no admin or
-- cross-member read path to add here (unlike people.avatar_url).
-- A Storage path, not a fetchable URL -- the bucket is private, so a real
-- download needs a short-lived signed URL generated on demand (see
-- data/resumeSync.js#getResumeSignedUrl).
alter table profiles add column resume_path text;

insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

create policy "Members can read their own resume"
on storage.objects for select
to authenticated
using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Members can upload their own resume"
on storage.objects for insert
to authenticated
with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Members can replace their own resume"
on storage.objects for update
to authenticated
using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Members can delete their own resume"
on storage.objects for delete
to authenticated
using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
