-- Closes a real gap found during an audit, direct requester ask to fix:
-- My Profile's Personal tab (name, grad year, major, committee, LinkedIn,
-- resume-attached flag) and onboardingComplete both only ever lived in
-- localStorage -- never in this real `profiles` table (which only had
-- full_name/role) -- so a member signing into their real account on a
-- different browser or device would be sent through onboarding again
-- from scratch, with no memory of anything they'd entered. Every other
-- piece of member state (preferences, tracked applications, saved jobs,
-- network connections) already has this exact real-sync treatment; this
-- was the one piece of real identity that never got it.
--
-- No new RLS policy needed -- profiles_update_own (id = auth.uid()) from
-- 20260821130000 already covers writes to these new columns. The self-
-- escalation trigger only guards the `role` column specifically (`new.role
-- is distinct from old.role`), so it doesn't touch or block updates to
-- anything added here.
alter table profiles
  add column class_year integer,
  add column majors text,
  add column uc_committee text,
  add column linkedin text,
  add column resume_file_name text,
  add column onboarding_complete boolean not null default false,
  add column profile_last_updated timestamptz;
