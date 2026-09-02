-- Self-contained, self-cleaning live verification of the new offer_count
-- column on job_track_record_report() (previous migration) -- same pattern
-- as 20260831230100's own live test of the job/company scope split, run
-- again here because that migration only exercised applicant_count/
-- interview_count, not the new field. Any RAISE EXCEPTION below rolls the
-- whole transaction back automatically -- nothing is left behind on either
-- success or failure.
do $$
declare
  target_user uuid;
  target_job_id uuid;
  target_company text;
  before_job record;
  after_job record;
begin
  select id into target_user from auth.users order by created_at limit 1;
  if target_user is null then
    raise notice 'No auth.users rows exist -- skipping job_track_record_report offer-count live test.';
    return;
  end if;

  select id, company into target_job_id, target_company from jobs where active = true limit 1;
  if target_job_id is null then
    raise notice 'No active jobs exist -- skipping job_track_record_report offer-count live test.';
    return;
  end if;

  select * into before_job from job_track_record_report(target_job_id::text, target_company);

  -- A rejected row should NOT count as an offer.
  insert into tracked_applications (member_id, job_id, stage, stage_history, outcome)
  values (target_user, target_job_id::text, 'Closed', '[]'::jsonb, 'rejected');

  select * into after_job from job_track_record_report(target_job_id::text, target_company);
  if after_job.offer_count <> coalesce(before_job.offer_count, 0) then
    raise exception 'offer_count changed for a rejected-outcome row: before=% after=%', before_job.offer_count, after_job.offer_count;
  end if;
  if after_job.applicant_count <> before_job.applicant_count + 1 then
    raise exception 'applicant_count did not increment: before=% after=%', before_job.applicant_count, after_job.applicant_count;
  end if;

  delete from tracked_applications where member_id = target_user and job_id = target_job_id::text;

  -- A real offer-outcome row should increment offer_count by exactly one.
  insert into tracked_applications (member_id, job_id, stage, stage_history, outcome)
  values (target_user, target_job_id::text, 'Closed', '[]'::jsonb, 'offer');

  select * into after_job from job_track_record_report(target_job_id::text, target_company);
  if after_job.offer_count <> coalesce(before_job.offer_count, 0) + 1 then
    raise exception 'offer_count did not increment for an offer-outcome row: before=% after=%', before_job.offer_count, after_job.offer_count;
  end if;
  if after_job.scope <> 'job' then
    raise exception 'Expected job scope, got %', after_job.scope;
  end if;
  raise notice 'Offer-outcome test passed: scope=%, applicants=%, interviews=%, offers=%', after_job.scope, after_job.applicant_count, after_job.interview_count, after_job.offer_count;

  delete from tracked_applications where member_id = target_user and job_id = target_job_id::text;

  select * into after_job from job_track_record_report(target_job_id::text, target_company);
  if after_job.offer_count <> coalesce(before_job.offer_count, 0) or after_job.applicant_count <> before_job.applicant_count then
    raise exception 'cleanup did not restore report to baseline: applicant_count before=% after=%, offer_count before=% after=%', before_job.applicant_count, after_job.applicant_count, before_job.offer_count, after_job.offer_count;
  end if;

  if exists (select 1 from tracked_applications where member_id = target_user and job_id = target_job_id::text) then
    raise exception 'Test cleanup left residue in tracked_applications';
  end if;

  raise notice 'job_track_record_report() offer_count live test passed and left zero residue.';
end $$;
