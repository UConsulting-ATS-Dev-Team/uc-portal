insert into resource_guide_files (resource_id, file_path, file_name)
values ('*', 'default/placeholder-guide.pdf', 'placeholder-guide.pdf')
on conflict (resource_id) do update set file_path = excluded.file_path, file_name = excluded.file_name;
