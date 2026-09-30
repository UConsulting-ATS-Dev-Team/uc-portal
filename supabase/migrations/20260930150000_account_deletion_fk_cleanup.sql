-- Groundwork for real self-service account deletion. Investigated every
-- FK referencing auth.users/profiles before touching anything (see
-- CLAUDE.md's dated entry for the full transcript) -- a naive "just call
-- auth.admin.deleteUser()" would have hit a real, silent failure mode:
-- three tables (feature_requests, opportunity_submissions,
-- interview_writeups) have `submitted_by uuid not null` with no cascade
-- behavior set at all, so deleting the account of anyone who's ever
-- posted a job, requested a feature, or shared a write-up would throw a
-- raw foreign-key-violation error. A separate, more consequential one:
-- messages.sender_id/recipient_id already CASCADE -- deleting your own
-- account would silently delete the *other* member's copy of every
-- conversation too, the exact problem this app already solved once for
-- message archiving (see that migration's own comment).
--
-- messages: intentionally drops the FK constraints entirely rather than
-- SET NULL. data/messagesSync.js#fetchConversations() already derives
-- each conversation's identity from the raw sender_id/recipient_id
-- *value* (to group messages by counterpart) before ever trying to
-- resolve a display name -- nulling the id would break that grouping
-- outright. The columns stay `not null uuid`, just no longer
-- FK-enforced against auth.users, so a departed member's old messages
-- can keep the same id going forward, with the display layer's own
-- already-existing `nameById.get(counterpartId) ?? "Former member"`
-- fallback (list_messageable_members() naturally excludes a deleted
-- account) handling the rest -- confirmed this fallback already existed
-- before writing this, not built new for it.
alter table messages drop constraint messages_sender_id_fkey;
alter table messages drop constraint messages_recipient_id_fkey;

-- feature_requests/opportunity_submissions/interview_writeups: real
-- club content (a feature idea, a job posting, an interview experience)
-- outlives the member who submitted it -- keep the row, null the
-- identity link. Confirmed both feature_requests and interview_writeups
-- already display from a denormalized submitted_by_name snapshot
-- (captured at submission time, unaffected by this), not a live join --
-- so this has zero display-layer impact on either. opportunity_
-- submissions' admin queue never displays submitter identity at all
-- (confirmed directly in pages/AdminDashboard.jsx) -- also zero impact.
alter table feature_requests alter column submitted_by drop not null;
alter table feature_requests drop constraint feature_requests_submitted_by_fkey;
alter table feature_requests add constraint feature_requests_submitted_by_fkey
  foreign key (submitted_by) references auth.users(id) on delete set null;

alter table opportunity_submissions alter column submitted_by drop not null;
alter table opportunity_submissions drop constraint opportunity_submissions_submitted_by_fkey;
alter table opportunity_submissions add constraint opportunity_submissions_submitted_by_fkey
  foreign key (submitted_by) references auth.users(id) on delete set null;

alter table interview_writeups alter column submitted_by drop not null;
alter table interview_writeups drop constraint interview_writeups_submitted_by_fkey;
alter table interview_writeups add constraint interview_writeups_submitted_by_fkey
  foreign key (submitted_by) references auth.users(id) on delete set null;

-- Admin-attribution columns (who reviewed/graded/created/uploaded/added
-- something) -- already nullable, just switching the delete behavior
-- from the default NO ACTION (which would block deletion) to SET NULL.
-- Covers the case where an admin, or someone who once held admin
-- privileges, deletes their own account -- lower-traffic than the
-- member-facing tables above, but cheap to close correctly while here.
alter table sources drop constraint sources_terms_reviewed_by_fkey;
alter table sources add constraint sources_terms_reviewed_by_fkey
  foreign key (terms_reviewed_by) references auth.users(id) on delete set null;

alter table duplicate_candidates drop constraint duplicate_candidates_reviewed_by_fkey;
alter table duplicate_candidates add constraint duplicate_candidates_reviewed_by_fkey
  foreign key (reviewed_by) references auth.users(id) on delete set null;

alter table opportunity_submissions drop constraint opportunity_submissions_reviewed_by_fkey;
alter table opportunity_submissions add constraint opportunity_submissions_reviewed_by_fkey
  foreign key (reviewed_by) references auth.users(id) on delete set null;

alter table feature_requests drop constraint feature_requests_reviewed_by_fkey;
alter table feature_requests add constraint feature_requests_reviewed_by_fkey
  foreign key (reviewed_by) references auth.users(id) on delete set null;

alter table roster drop constraint roster_added_by_fkey;
alter table roster add constraint roster_added_by_fkey
  foreign key (added_by) references profiles(id) on delete set null;

alter table access_requests drop constraint access_requests_reviewed_by_fkey;
alter table access_requests add constraint access_requests_reviewed_by_fkey
  foreign key (reviewed_by) references profiles(id) on delete set null;

alter table intern_roster drop constraint intern_roster_added_by_fkey;
alter table intern_roster add constraint intern_roster_added_by_fkey
  foreign key (added_by) references profiles(id) on delete set null;

alter table accelerator_lessons drop constraint accelerator_lessons_created_by_fkey;
alter table accelerator_lessons add constraint accelerator_lessons_created_by_fkey
  foreign key (created_by) references profiles(id) on delete set null;

alter table accelerator_materials drop constraint accelerator_materials_uploaded_by_fkey;
alter table accelerator_materials add constraint accelerator_materials_uploaded_by_fkey
  foreign key (uploaded_by) references profiles(id) on delete set null;

alter table accelerator_submissions drop constraint accelerator_submissions_graded_by_fkey;
alter table accelerator_submissions add constraint accelerator_submissions_graded_by_fkey
  foreign key (graded_by) references profiles(id) on delete set null;

alter table client_error_reports drop constraint client_error_reports_account_id_fkey;
alter table client_error_reports add constraint client_error_reports_account_id_fkey
  foreign key (account_id) references auth.users(id) on delete set null;
