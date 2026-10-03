-- Every place a job is open in, so a member's location preferences can match a
-- posting that lists several ("San Francisco, CA | New York, NY | Seattle, WA")
-- instead of only the first one.
--
-- `jobs.city` held a single place and was null for about 76% of the live board
-- (3,579 of 4,710 active jobs on 2026-10-03), because the location parser only
-- understood "City, ST". The parser was rewritten (taxonomy/locations.ts, both
-- copies); `locations` is its list of every resolved place, formatted
-- "Austin, TX" / "London, United Kingdom" / "Canada". NULL means "not worked out
-- yet", an empty array means "worked out, and nothing in the text names a place".
alter table jobs add column if not exists locations text[];

-- Existing jobs keep the place they were inserted with, and the raw feed text was
-- never stored, so the fetchers re-derive it from each fetch (the feed carries the
-- location for every job still on the board) and send it here. Only rows whose
-- `locations` is still NULL are touched, so each job is corrected once and later
-- fetches change nothing.
--
-- p_rows: [{ "id": uuid, "city": text|null, "state": text|null, "country": text|null,
--            "remote_type": text|null, "locations": text[] }]
--
-- Service role only (called from the Edge Functions), like insert_jobs_with_sources().
create or replace function apply_job_locations(p_rows jsonb)
returns integer
language plpgsql
as $$
declare
  n integer;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    return 0;
  end if;

  with incoming as (
    select
      (e->>'id')::uuid as id,
      e->>'city' as city,
      e->>'state' as state,
      e->>'country' as country,
      nullif(e->>'remote_type', '')::remote_type as remote_type,
      coalesce(array(select jsonb_array_elements_text(e->'locations')), '{}'::text[]) as locations
    from jsonb_array_elements(p_rows) e
  )
  update jobs j
     set locations = i.locations,
         -- Never wipe what is already known with a blank: only fill, or replace a
         -- place the old parser got wrong when the new one found a real city.
         city = case when i.city is not null then i.city else j.city end,
         state = case when i.city is not null then i.state else j.state end,
         country = coalesce(i.country, j.country),
         remote_type = coalesce(i.remote_type, j.remote_type)
    from incoming i
   where j.id = i.id
     and j.locations is null;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function apply_job_locations(jsonb) from public, anon, authenticated;
