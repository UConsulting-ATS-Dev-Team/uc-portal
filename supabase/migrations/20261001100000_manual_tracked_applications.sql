-- Real functionality for Add Application's "Paste a link" / "Enter
-- manually" tabs -- direct ask ("i want those to be working"), closing
-- the gap AddApplicationModal.jsx's own copy used to admit honestly
-- ("this isn't wired up yet, so nothing will actually be saved").
--
-- job_id on tracked_applications is a loosely-typed `text`, not an FK to
-- jobs(id) -- it already has to resolve against either a real job row or
-- a mock-job slug at display time, so adding a third kind (an id this
-- app invents for an external/manual posting, never a real jobs row) is
-- a natural extension of a pattern that already exists, not a new one.
-- These three columns carry the only facts a manual/external entry can
-- ever have -- no odds model, no UC recruiting intelligence, no real
-- `jobs` row backing it, by definition.
alter table tracked_applications add column manual_company text;
alter table tracked_applications add column manual_role text;
alter table tracked_applications add column manual_url text;
