-- UC Job Engine — initial schema (Stage 1 per JOB_ENGINE_ARCHITECTURE.md Part 7).
-- Ready to push to a real Supabase project (`supabase db push`) once one is
-- linked; not yet applied anywhere. Implements §3.1 (data model), §3.7
-- (source governance), and the §8.3 fix (contributing_sources as a proper
-- join table rather than a single source_id, so a merged job can retain
-- every source that ever pointed to it).

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Source governance (§3.7) — the gate every ingested job passes through.
-- ---------------------------------------------------------------------------

create type source_type as enum ('admin', 'member', 'employer_api', 'feed', 'licensed_provider');
create type authorization_status as enum ('approved', 'approved_with_restrictions', 'requires_review', 'not_approved', 'disabled');

create table sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  type source_type not null,
  authorization_status authorization_status not null default 'requires_review',
  terms_reviewed_at timestamptz,
  terms_reviewed_by text,
  api_available boolean not null default false,
  rate_limits text,
  attribution_required boolean not null default false,
  storage_restrictions text,          -- e.g. "do not store full description text" — enforced in application code (§8.3 US-56 fix), this column only records it
  redistribution_restricted boolean not null default false,
  retention_requirement text,
  config jsonb not null default '{}', -- source-specific settings (endpoint, auth ref, etc.)
  enabled boolean not null default true,
  last_reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

comment on table sources is 'Job-listing sources only. Reference/taxonomy sources like O*NET (Part 10) are not modeled here — they never contribute a job record.';

-- ---------------------------------------------------------------------------
-- Taxonomies (§3.2) — versioned lookup tables, editable without a deploy.
-- Seeded from data/careerOptions.js's industry list in the seed script.
-- ---------------------------------------------------------------------------

create table industries (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0
);

create table job_functions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0
);

-- ---------------------------------------------------------------------------
-- Jobs (§3.1)
-- ---------------------------------------------------------------------------

create type employment_type as enum ('internship', 'full_time', 'part_time', 'fellowship', 'co_op', 'apprenticeship');
create type remote_type as enum ('remote', 'hybrid', 'in_person');
create type job_status as enum ('active', 'expiring_soon', 'potentially_expired', 'expired', 'removed');
create type compensation_type as enum ('hourly', 'salary', 'unspecified');
-- classification_method: 'source_stated' means the source itself provided the
-- value (a fact); everything else is the system's own inference, and must be
-- presented in the UI as such (US-28).
create type classification_method as enum ('source_stated', 'rule', 'onet_occupation', 'llm', 'human');

create table jobs (
  id uuid primary key default gen_random_uuid(),

  -- core, required to display and apply to a job
  company text not null,
  title text not null,
  employment_type employment_type not null,
  application_url text not null,

  -- core, optional — degrade gracefully, never reject a job for missing these
  description text,          -- only populated when every contributing source's restrictions permit storing it
  department text,
  job_function_id uuid references job_functions(id),

  city text,
  state text,
  country text,
  remote_type remote_type,

  salary_min numeric,
  salary_max numeric,
  salary_currency text not null default 'USD',
  compensation_type compensation_type not null default 'unspecified',
  compensation_text text,     -- original as-seen text, kept even after normalization

  posted_date date,
  updated_date date,
  application_deadline date,

  graduation_years int[],           -- normalized eligible grad years, e.g. {2027,2028}
  required_skills text[],
  preferred_skills text[],
  qualifications_text text,

  relevant_industries text[],
  relevant_roles text[],
  uc_recruiting_notes text,  -- Careers Committee-authored, never source data

  -- provenance / governance (system-managed)
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_verified_at timestamptz,
  active boolean not null default true,
  status job_status not null default 'active',
  confidence_score real,
  quality_score real,
  classification_method classification_method not null default 'rule',

  search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(company, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(qualifications_text, '')), 'C')
  ) stored,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index jobs_search_idx on jobs using gin (search_vector);
create index jobs_status_idx on jobs (status) where active;
create index jobs_deadline_idx on jobs (application_deadline);
create index jobs_employment_type_idx on jobs (employment_type);
create index jobs_grad_years_idx on jobs using gin (graduation_years);

-- ---------------------------------------------------------------------------
-- Provenance — many-to-many so a merged job (US-19) keeps every contributing
-- source rather than collapsing to one (§8.3 fix). is_primary marks which
-- source's restrictions govern the merged record's storage/display/
-- redistribution behavior — always the MOST restrictive applicable source,
-- never the least (see §8.3's compliance note on merges).
-- ---------------------------------------------------------------------------

create table job_sources (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  source_id uuid not null references sources(id),
  source_job_id text,        -- the source's own ID for this job, for re-fetch matching
  source_url text not null,
  is_primary boolean not null default true,
  first_seen_at timestamptz not null default now(),
  last_retrieved_at timestamptz not null default now(),
  unique (source_id, source_job_id)
);

create index job_sources_job_idx on job_sources (job_id);

-- ---------------------------------------------------------------------------
-- Duplicate review queue (US-18) — the 70-89 confidence band from §3.3
-- lands here for a human decision; <70 is never recorded, >=90 auto-merges
-- and never reaches this table at all.
-- ---------------------------------------------------------------------------

create type duplicate_review_status as enum ('pending', 'confirmed_duplicate', 'not_duplicate', 'merged');

create table duplicate_candidates (
  id uuid primary key default gen_random_uuid(),
  job_id_a uuid not null references jobs(id) on delete cascade,
  job_id_b uuid not null references jobs(id) on delete cascade,
  score real not null,
  signals jsonb not null,     -- which signals matched and their individual scores, for admin review context
  status duplicate_review_status not null default 'pending',
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Member-submitted opportunities (US-07/08/09) — extends the exact shape
-- already prototyped as data/store.jsx's opportunityQueue.
-- ---------------------------------------------------------------------------

create type opportunity_review_status as enum ('needs_review', 'live', 'rejected', 'expired');

create table opportunity_submissions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id),   -- set once approved and promoted into jobs
  submitted_by text,
  company text not null,
  role text not null,
  raw_payload jsonb not null,        -- exactly what the submitter entered; never auto-scraped
  status opportunity_review_status not null default 'needs_review',
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
