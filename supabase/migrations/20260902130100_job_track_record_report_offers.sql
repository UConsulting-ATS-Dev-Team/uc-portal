-- Extends job_track_record_report() (20260831230000) to also return a real
-- offer count/rate now that tracked_applications has a genuine `outcome`
-- column (previous migration, 20260902130000) -- this is the actual gap
-- closure the odds-model's UC-track-record factor's own writeup named:
-- "the tracker doesn't record final offer outcomes yet, so this measures
-- interview-stage progress rather than offers." data/realOddsModel.js
-- switches to prefer this real offer_count when there's enough of it (see
-- that file's own change for the sparse-data threshold reasoning), falling
-- back to the existing interview-count proxy otherwise -- exactly the same
-- "real data wins the moment it exists, thin data is honestly labeled
-- rather than hidden" principle CLAUDE.md's decision already established
-- for the job-vs-company scope split and the industry-baseline prior.
--
-- `create or replace` can't add a new output column to an existing `returns
-- table (...)` function -- Postgres treats that as a return-type change --
-- so this drops and recreates rather than replacing in place. Re-grants
-- execute afterward since a drop does not carry the old grant forward.
--
-- offer_count counts distinct members whose row has outcome = 'offer',
-- independent of stage -- in practice that's always a Closed row (the only
-- place the real UI captures an outcome), but the aggregate itself doesn't
-- need to assume that to stay correct.
drop function if exists job_track_record_report(text, text);

create function job_track_record_report(target_job_id text, target_company text)
returns table (scope text, applicant_count bigint, interview_count bigint, offer_count bigint)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  job_applicants bigint;
  job_interviews bigint;
  job_offers bigint;
  company_applicants bigint;
  company_interviews bigint;
  company_offers bigint;
begin
  select count(distinct member_id),
         count(distinct member_id) filter (where stage in ('First round', 'Final round')),
         count(distinct member_id) filter (where outcome = 'offer')
    into job_applicants, job_interviews, job_offers
  from tracked_applications
  where job_id = target_job_id;

  if coalesce(job_applicants, 0) > 0 then
    return query select 'job'::text, job_applicants, job_interviews, coalesce(job_offers, 0);
    return;
  end if;

  -- Company-level fallback. job_id holds either a real job's uuid (as
  -- text) or one of data/mockJobs.js's readable slugs -- only rows that
  -- actually look like a uuid can join to jobs.id, so the regex guard
  -- below is required, not optional (a bare ::uuid cast on a slug like
  -- "bain-consulting-intern" would raise and abort the whole query).
  select count(distinct ta.member_id),
         count(distinct ta.member_id) filter (where ta.stage in ('First round', 'Final round')),
         count(distinct ta.member_id) filter (where ta.outcome = 'offer')
    into company_applicants, company_interviews, company_offers
  from tracked_applications ta
  join jobs j on j.id = ta.job_id::uuid
  where ta.job_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and j.company = target_company;

  return query select 'company'::text, coalesce(company_applicants, 0), coalesce(company_interviews, 0), coalesce(company_offers, 0);
end;
$$;

grant execute on function job_track_record_report(text, text) to authenticated;
