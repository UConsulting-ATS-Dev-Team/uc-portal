-- Let a member read a job they have tracked or saved even after it has closed.
--
-- The only member-facing SELECT policy on jobs was "active rows only"
-- (jobs_select_active_authenticated). So the moment a job a member had added to
-- their Applications tracker, or saved, expired, was capped, or was deactivated by
-- a cleanup, it became invisible to them at the database level: the tracker row
-- and the Saved-tab entry silently disappeared instead of showing "closed", and
-- even opening /jobs/<id> directly came back "not found". No frontend change can
-- work around a row the database refuses to return.
--
-- This adds the narrow exception: a member can also read an inactive job if (and
-- only if) it appears in their OWN tracked_applications or saved_jobs. Every other
-- inactive job stays hidden from members, exactly as before.
--
-- Named so it sorts after the existing policies: Postgres ORs permissive
-- policies in name order and short-circuits, so for the common case (an active
-- row) the two extra lookups are never evaluated.
create policy "jobs_select_own_tracked_or_saved" on jobs for select
  using (
    auth.role() = 'authenticated'
    and (
      exists (select 1 from tracked_applications t where t.member_id = auth.uid() and t.job_id = jobs.id::text)
      or exists (select 1 from saved_jobs s where s.member_id = auth.uid() and s.job_id = jobs.id::text)
    )
  );
