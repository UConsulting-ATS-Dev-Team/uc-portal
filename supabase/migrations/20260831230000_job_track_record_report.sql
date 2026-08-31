-- Real "UC track record" signal for the odds model on real job postings
-- (pages/RealJobDetail.jsx), see JOB_ENGINE_ARCHITECTURE.md's odds-model
-- entry for the full design writeup. The mock odds model
-- (data/oddsModel.js, wireframe 1e) reads a fictional per-job
-- pastCycleApplicants/pastCycleOffers pair straight off data/mockJobs.js.
-- Real jobs have no such field -- the closest real signal is
-- tracked_applications, which is RLS'd to member_id = auth.uid() with
-- deliberately no admin bypass (CLAUDE.md's Admin Dashboard section: admins
-- see aggregate recruiting data only, never an individual's own application
-- list). Any cross-member aggregate has to go through a security definer
-- function the same way company_demand_report already does -- not because
-- this specific data is admin-only (every member already sees the mock
-- version's pastCycleApplicants/pastCycleOffers on Job detail), but because
-- there is no other RLS-safe way to count *other members'* rows at all.
--
-- Honest scope note: tracked_applications' stage taxonomy (Interested ->
-- ... -> Final round -> Closed, data/trackerUtils.js) has no "received an
-- offer" outcome -- "Closed" is ambiguous (could mean offer-and-accepted,
-- rejected, or withdrawn). Reusing "Closed" as a stand-in for "offer" would
-- fabricate data that doesn't exist, which is exactly what CLAUDE.md's
-- "every number traceable" principle rules out. Instead this reports how
-- many UC members reached an interview stage (First round or Final round)
-- out of how many tracked the job at all -- a real, defensible, traceable
-- signal, just a different (and honestly different) one than "offer rate."
-- data/realOddsModel.js labels this explicitly as "reached an interview,"
-- never as "received an offer."
--
-- Falls back from job-level to company-level when the specific posting has
-- zero tracked applicants (the common case -- a single real posting will
-- rarely have UC members tracking that exact listing yet). The caller is
-- told which scope was actually used (`scope`) so the UI can visibly label
-- a company-level number as company-wide rather than presenting it as this
-- specific job's own track record, per this feature's own design brief.
--
-- Privacy: RETURNS ONLY aggregate counts, never a row per member and never
-- takes a member_id as input -- there is no query against this function
-- that gets an individual's identity back out, same guarantee
-- company_demand_report's own comment describes for the same reason.
create or replace function job_track_record_report(target_job_id text, target_company text)
returns table (scope text, applicant_count bigint, interview_count bigint)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  job_applicants bigint;
  job_interviews bigint;
  company_applicants bigint;
  company_interviews bigint;
begin
  select count(distinct member_id),
         count(distinct member_id) filter (where stage in ('First round', 'Final round'))
    into job_applicants, job_interviews
  from tracked_applications
  where job_id = target_job_id;

  if coalesce(job_applicants, 0) > 0 then
    return query select 'job'::text, job_applicants, job_interviews;
    return;
  end if;

  -- Company-level fallback. job_id holds either a real job's uuid (as
  -- text) or one of data/mockJobs.js's readable slugs -- only rows that
  -- actually look like a uuid can join to jobs.id, so the regex guard
  -- below is required, not optional (a bare ::uuid cast on a slug like
  -- "bain-consulting-intern" would raise and abort the whole query).
  select count(distinct ta.member_id),
         count(distinct ta.member_id) filter (where ta.stage in ('First round', 'Final round'))
    into company_applicants, company_interviews
  from tracked_applications ta
  join jobs j on j.id = ta.job_id::uuid
  where ta.job_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    and j.company = target_company;

  return query select 'company'::text, coalesce(company_applicants, 0), coalesce(company_interviews, 0);
end;
$$;

grant execute on function job_track_record_report(text, text) to authenticated;
