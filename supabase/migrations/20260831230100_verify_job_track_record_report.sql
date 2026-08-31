-- Self-contained, self-cleaning live verification of
-- job_track_record_report() (20260831230000) against real data -- same
-- "temporary migration" verification pattern this repo has used elsewhere
-- (e.g. the expiration-state-machine RPC, resolve-duplicate-candidate's
-- fabricated test pair). Runs as a single transaction: any RAISE EXCEPTION
-- below aborts and rolls back automatically, so a failed assertion can
-- never leave scratch data behind. On success, the temporary
-- tracked_applications rows it inserts are deleted before the transaction
-- commits -- there is nothing left over to clean up in a follow-up
-- migration, unlike test data other migrations in this repo left behind
-- on purpose to inspect via the app afterward.
do $$
declare
  target_user uuid;
  target_job_id uuid;
  target_company text;
  fallback_job_id uuid;
  before_job record;
  after_job record;
  before_company record;
  after_company record;
begin
  select id into target_user from auth.users order by created_at limit 1;
  if target_user is null then
    raise notice 'No auth.users rows exist -- skipping job_track_record_report live test.';
    return;
  end if;

  select id, company into target_job_id, target_company from jobs where active = true limit 1;
  if target_job_id is null then
    raise notice 'No active jobs exist -- skipping job_track_record_report live test.';
    return;
  end if;

  -- Job-scope path.
  select * into before_job from job_track_record_report(target_job_id::text, target_company);

  insert into tracked_applications (member_id, job_id, stage, stage_history)
  values (target_user, target_job_id::text, 'First round', '[]'::jsonb);

  select * into after_job from job_track_record_report(target_job_id::text, target_company);

  if after_job.scope <> 'job' then
    raise exception 'Expected job scope, got %', after_job.scope;
  end if;
  if after_job.applicant_count <> before_job.applicant_count + 1 then
    raise exception 'applicant_count did not increment: before=% after=%', before_job.applicant_count, after_job.applicant_count;
  end if;
  if after_job.interview_count <> before_job.interview_count + 1 then
    raise exception 'interview_count did not increment for a First round stage: before=% after=%', before_job.interview_count, after_job.interview_count;
  end if;
  raise notice 'Job-scope test passed: scope=%, applicants=%, interviews=%', after_job.scope, after_job.applicant_count, after_job.interview_count;

  delete from tracked_applications where member_id = target_user and job_id = target_job_id::text;

  select * into after_job from job_track_record_report(target_job_id::text, target_company);
  if after_job.applicant_count <> before_job.applicant_count then
    raise exception 'cleanup did not restore applicant_count: before=% after=%', before_job.applicant_count, after_job.applicant_count;
  end if;

  -- Company-scope fallback path: track a different active job at the same
  -- company, then confirm target_job's OWN report (still zero rows of its
  -- own) falls back to a company-wide count that reflects the other job.
  select id into fallback_job_id from jobs
    where active = true and company = target_company and id <> target_job_id
    limit 1;

  if fallback_job_id is not null then
    select * into before_company from job_track_record_report(target_job_id::text, target_company);

    insert into tracked_applications (member_id, job_id, stage, stage_history)
    values (target_user, fallback_job_id::text, 'Applied', '[]'::jsonb);

    select * into after_company from job_track_record_report(target_job_id::text, target_company);

    if after_company.scope <> 'company' then
      raise exception 'Expected company scope fallback, got %', after_company.scope;
    end if;
    if after_company.applicant_count <> before_company.applicant_count + 1 then
      raise exception 'company applicant_count did not increment: before=% after=%', before_company.applicant_count, after_company.applicant_count;
    end if;
    if after_company.interview_count <> before_company.interview_count then
      raise exception 'company interview_count changed for an Applied-stage row (should not count as an interview): before=% after=%', before_company.interview_count, after_company.interview_count;
    end if;
    raise notice 'Company-scope fallback test passed: scope=%, applicants=%, interviews=%', after_company.scope, after_company.applicant_count, after_company.interview_count;

    delete from tracked_applications where member_id = target_user and job_id = fallback_job_id::text;
  else
    raise notice 'No second active job at company % -- fallback path not exercised this run.', target_company;
  end if;

  if exists (
    select 1 from tracked_applications
    where member_id = target_user
      and job_id in (target_job_id::text, coalesce(fallback_job_id::text, '00000000-0000-0000-0000-000000000000'))
  ) then
    raise exception 'Test cleanup left residue in tracked_applications';
  end if;

  raise notice 'All job_track_record_report() live tests passed and left zero residue.';
end $$;
