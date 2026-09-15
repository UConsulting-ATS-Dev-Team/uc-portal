-- Real profile pictures -- closes CLAUDE.md's "People avatars" note: real
-- members stayed text-initials specifically because sourcing a photo for
-- them without consent would be worse than not having one. The fix is
-- exactly that consent path: a member can upload their own photo (nobody
-- else's), and it's then visible to every other member, matching the
-- "everyone in the club already has access to the same real data" access
-- model this app's org-transfer decision already established.

alter table profiles add column avatar_url text;

-- Storage bucket for avatar images. Public bucket (not RLS-gated reads):
-- avatars are voluntarily self-uploaded, not sensitive the way email/major/
-- mentor is, and a public bucket keeps rendering a plain <img src>, same as
-- every other real asset in this app (company logos, the bear mark) rather
-- than introducing a new signed-URL pattern solely for this. Write access
-- is still real RLS -- own-folder-only, matching the standard Supabase
-- avatar-bucket convention (storage.foldername(name))[1] = auth.uid()).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Avatar images are publicly readable"
on storage.objects for select
using (bucket_id = 'avatars');

create policy "Members can upload their own avatar"
on storage.objects for insert
to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Members can replace their own avatar"
on storage.objects for update
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Members can delete their own avatar"
on storage.objects for delete
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Cross-member read path -- profiles' own RLS only lets a member read their
-- own row, so Network/RealMemberProfile/Messages need a real way to resolve
-- someone ELSE's avatar_url. Same security-definer shape as
-- list_open_to_coffee_chat_members(): exposes only what's needed to show a
-- photo (id, email for matching against the people directory / message
-- counterpart ids, avatar_url), nothing else about the account. Only rows
-- with a real uploaded photo are returned -- the vast majority of real
-- Directory people (no account yet, or an account with no photo) simply
-- aren't in the result, same "no photo without consent" default.
create or replace function list_member_avatars()
returns table (member_id uuid, email text, avatar_url text)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return query
    select u.id as member_id, u.email, p.avatar_url
    from auth.users u
    join profiles p on p.id = u.id
    where p.avatar_url is not null;
end;
$$;

grant execute on function list_member_avatars() to authenticated;
