-- Real headshots for the Directory (`people`) rows, sourced from the
-- club's own official public team page (uconsultingla.com/team) --
-- separate from, and additional to, profiles.avatar_url (a signed-in
-- member's own self-upload). Most people in `people` have no account yet,
-- so the self-upload path alone would leave the directory almost entirely
-- text-initials for a long time; this closes that gap using photos the
-- club itself already publishes with each person's name attached, a real
-- consent signal distinct from an unconsented photo pulled from nowhere
-- (CLAUDE.md's original People avatars note). Precedence when a member
-- has both: their own self-upload wins (data/realPeople.js), since it's
-- the more current, directly-chosen one.
alter table people add column avatar_url text;

-- Admin-only write path for this specific prefix -- an admin is uploading
-- on OTHERS' behalf (matching them by name against the team page), unlike
-- the existing self-upload policies (own-auth.uid()-folder only), so it
-- needs its own broader-than-own-folder grant, scoped by both the fixed
-- 'people/' prefix and is_admin() together.
create policy "Admins can manage people headshots"
on storage.objects for all
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = 'people' and is_admin())
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = 'people' and is_admin());
