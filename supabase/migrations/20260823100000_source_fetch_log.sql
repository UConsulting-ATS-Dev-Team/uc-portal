-- US-51 (source-health admin panel), narrowed to what actually exists right
-- now: one scheduled adapter (fetch-greenhouse-stripe) running unattended
-- via pg_cron with zero record of whether any given run succeeded. A
-- silent failure (network blip, Greenhouse API change, another resource
-- limit) would be invisible until someone happened to notice stale data --
-- exactly the "small, rotating student team" maintenance risk Part 6
-- already names. This is the log every future scheduled adapter writes to,
-- not just Stripe's.

create table source_fetch_log (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references sources(id) on delete cascade,
  started_at timestamptz not null,
  completed_at timestamptz,
  status text not null check (status in ('success', 'failed', 'skipped')),
  summary jsonb,  -- the fetcher's own stats object on success, {error} on failed, {reason} on skipped
  created_at timestamptz not null default now()
);

create index source_fetch_log_source_idx on source_fetch_log (source_id, created_at desc);

alter table source_fetch_log enable row level security;
create policy "source_fetch_log_admin_all" on source_fetch_log for all using (is_admin()) with check (is_admin());

-- Same gap 20260821150000/20260822110000 already found for other tables --
-- explicit grants required even for roles RLS would otherwise allow through.
grant select on public.source_fetch_log to authenticated;
grant all privileges on public.source_fetch_log to service_role;
