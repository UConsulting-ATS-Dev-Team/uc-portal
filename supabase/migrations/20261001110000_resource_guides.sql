-- Real content behind Career Resources' "Open guide"/"Download PDF" --
-- direct ask ("filler document content... editable so that admins can
-- actually put in the slideshows we will be showing users"). Same real
-- admin-upload-content pattern already proven for
-- accelerator-materials: a public bucket (not sensitive, every real
-- member already sees the library itself) plus a small table mapping a
-- resource's own static id (data/mockResources.js's RESOURCES array,
-- still a static content list, not a DB table -- not worth converting
-- for this) to the real uploaded file. A row with resource_id = '*' is
-- the shared default/filler file shown for any resource an admin hasn't
-- uploaded something specific for yet.
create table resource_guide_files (
  resource_id text primary key,
  file_path text not null,
  file_name text not null,
  uploaded_by uuid references profiles(id) on delete set null,
  uploaded_at timestamptz not null default now()
);

alter table resource_guide_files enable row level security;
create policy "resource_guide_files_select_authenticated" on resource_guide_files for select to authenticated using (true);
create policy "resource_guide_files_admin_write" on resource_guide_files for all to authenticated using (is_admin()) with check (is_admin());

insert into storage.buckets (id, name, public)
values ('resource-guides', 'resource-guides', true)
on conflict (id) do nothing;

create policy "Admins can upload resource guides"
on storage.objects for insert
to authenticated
with check (bucket_id = 'resource-guides' and is_admin());

create policy "Admins can replace resource guides"
on storage.objects for update
to authenticated
using (bucket_id = 'resource-guides' and is_admin());

create policy "Admins can delete resource guides"
on storage.objects for delete
to authenticated
using (bucket_id = 'resource-guides' and is_admin());
