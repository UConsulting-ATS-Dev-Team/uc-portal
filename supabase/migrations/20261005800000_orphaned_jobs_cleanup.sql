-- One-time, reversible cleanup of "orphaned" jobs: active jobs with no job_sources row.
--
-- Why they exist: the fetchers used to write a run's new jobs and their
-- job_sources rows as two separate requests, and a run stopped between them (the
-- pg_net duplicate-delivery race; the all-at-once run being killed by the Edge
-- Function resource limit) left jobs with no source row. The next run finds
-- existing jobs only through job_sources, so it re-inserted them. Expiry
-- (mark_jobs_missed) and the per-company caps only act on tracked jobs, so the
-- orphans never expired and were never capped: 5,317 of 10,762 active jobs on
-- 2026-10-03. (insert_jobs_with_sources(), 20261005700000, stops new ones.)
--
-- What this does, per orphan (matched to other jobs by application_url):
--   * a tracked, ACTIVE twin exists      -> it is a live duplicate: deactivate
--                                           the orphan (status 'removed')
--   * only an INACTIVE tracked twin      -> a zombie that outlived its twin's cap
--                                           or expiry: deactivate it (status 'expired')
--   * no twin                            -> re-adopt it: create its job_sources
--                                           row from the id in its URL (Greenhouse
--                                           gh_jid / job id, Lever posting uuid)
--                                           against the enabled source for that
--                                           company, so normal refresh, expiry and
--                                           caps apply to it from the next fetch.
--                                           If that source id is already taken by
--                                           another job (or by an earlier orphan in
--                                           this run) it is a duplicate: deactivate.
--   * anything with no matching source or no parsable id is left untouched.
--
-- Nothing is deleted. Every change is recorded in orphan_cleanup_backup, and
-- revert_orphan_cleanup() undoes it (re-activates the deactivated jobs with
-- their prior status, removes the job_sources rows this created).
do $$
begin
  create table orphan_cleanup_backup (
    job_id uuid primary key,
    action text not null check (action in ('deactivated_duplicate', 'deactivated_zombie', 'adopted')),
    prior_active boolean not null,
    prior_status job_status not null,
    adopted_source_id uuid,
    adopted_source_job_id text,
    cleaned_at timestamptz not null default now()
  );
  -- No policies: only the service role / migrations can read or write this.
  alter table orphan_cleanup_backup enable row level security;

  create temp table orph on commit drop as
    select j.id, j.company, j.application_url, j.status, j.created_at,
      exists (select 1 from jobs t join job_sources ts on ts.job_id = t.id
              where t.application_url = j.application_url and t.id <> j.id and t.active) as twin_active,
      exists (select 1 from jobs t join job_sources ts on ts.job_id = t.id
              where t.application_url = j.application_url and t.id <> j.id and not t.active) as twin_inactive
    from jobs j
    where j.active and not exists (select 1 from job_sources js where js.job_id = j.id);

  -- For the no-twin orphans: which source, and which source_job_id, they would be re-adopted under.
  create temp table adopt_candidates on commit drop as
    select distinct on (o.id)
      o.id as job_id, s.id as source_id,
      case when o.application_url ~* 'lever\.co'
           then substring(o.application_url from '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')
           else coalesce(substring(o.application_url from 'gh_jid=(\d+)'), substring(o.application_url from '/jobs/(\d+)'))
      end as source_job_id
    from orph o
    join sources s
      on s.type = 'employer_api' and s.enabled
     and s.config->>'company' = o.company
     and s.config->>'platform' = case when o.application_url ~* 'lever\.co' then 'lever' else 'greenhouse' end
    where not o.twin_active and not o.twin_inactive
    order by o.id, s.created_at;

  create temp table adopt_ranked on commit drop as
    select c.*,
      exists (select 1 from job_sources js where js.source_id = c.source_id and js.source_job_id = c.source_job_id) as already_taken,
      row_number() over (partition by c.source_id, c.source_job_id order by o.created_at desc, c.job_id) as rn
    from adopt_candidates c join orph o on o.id = c.job_id
    where c.source_job_id is not null;

  create temp table plan on commit drop as
    select o.id as job_id, o.status,
      case
        when o.twin_active then 'deactivated_duplicate'
        when o.twin_inactive then 'deactivated_zombie'
        when a.job_id is null then 'skip'
        when a.already_taken or a.rn > 1 then 'deactivated_duplicate'
        else 'adopted'
      end as action,
      a.source_id, a.source_job_id, o.application_url
    from orph o left join adopt_ranked a on a.job_id = o.id;

  insert into orphan_cleanup_backup (job_id, action, prior_active, prior_status, adopted_source_id, adopted_source_job_id)
    select p.job_id, p.action, true, p.status,
           case when p.action = 'adopted' then p.source_id end,
           case when p.action = 'adopted' then p.source_job_id end
    from plan p where p.action <> 'skip';

  insert into job_sources (job_id, source_id, source_job_id, source_url, is_primary)
    select p.job_id, p.source_id, p.source_job_id, p.application_url, true
    from plan p where p.action = 'adopted';

  update jobs j
     set active = false,
         status = (case p.action when 'deactivated_zombie' then 'expired' else 'removed' end)::job_status,
         updated_at = now()
    from plan p
   where j.id = p.job_id and p.action in ('deactivated_duplicate', 'deactivated_zombie');
end;
$$;

create or replace function revert_orphan_cleanup()
returns table (reactivated integer, unlinked integer)
language plpgsql
as $$
declare r integer; u integer;
begin
  delete from job_sources js
   using orphan_cleanup_backup b
   where b.action = 'adopted' and js.job_id = b.job_id
     and js.source_id = b.adopted_source_id and js.source_job_id = b.adopted_source_job_id;
  get diagnostics u = row_count;

  update jobs j
     set active = b.prior_active, status = b.prior_status, updated_at = now()
    from orphan_cleanup_backup b
   where j.id = b.job_id and b.action in ('deactivated_duplicate', 'deactivated_zombie');
  get diagnostics r = row_count;

  reactivated := r; unlinked := u;
  return next;
end;
$$;
revoke all on function revert_orphan_cleanup() from public, anon, authenticated;
