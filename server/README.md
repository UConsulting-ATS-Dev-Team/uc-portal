# UC Job Engine — Stage 1

Plain, database-agnostic TypeScript implementing the pipeline described in
[JOB_ENGINE_ARCHITECTURE.md](../JOB_ENGINE_ARCHITECTURE.md) (Parts 1, 3, 8,
10). This is **Stage 1** of that document's Part 7 sequence: prove the
pipeline against a synthetic dataset before any real source or live database
exists. No Supabase project is connected here — see
[supabase/migrations/20260821120000_init_schema.sql](../supabase/migrations/20260821120000_init_schema.sql)
for the schema this will eventually run against (Part 9).

## Layout

```
server/
  src/
    types.ts              -- mirrors the SQL schema; the shared vocabulary every module below uses
    normalize.ts           -- US-10/11/12/13/24/25/27/28: RawJob -> NormalizedJob
    dedupe.ts               -- US-16/17/18/19: duplicate scoring, tiering, merging
    quality.ts               -- US-14/15: required-field validation + quality score
    match.ts                  -- US-32/33/34: hard-constraint eligibility + explainable soft-preference score
    rank.ts                    -- US-40/41/42/43: weighted ranking formula + anti-domination cap
    taxonomy/
      employmentTypes.ts        -- exact-match lookup
      locations.ts                -- known-city lookup + "City, ST" regex fallback
      compensation.ts               -- regex-based comp parsing
      eligibility.ts                  -- graduation-year/class-standing extraction
      occupationTaxonomy.ts            -- STUB standing in for the real O*NET Web Services API (Part 10) -- see the file's header comment before assuming it has real occupation coverage
  synthetic/
    generateSyntheticJobs.ts  -- seeded synthetic dataset generator (100-500 jobs, deliberately duplicated/malformed)
  tests/                       -- one file per module, plus pipeline.test.ts for the full end-to-end proof
```

## Running it

```bash
npm run test:server       # 44 tests, ~6-8s (the two full-dataset pipeline
                           # tests are the slow part -- O(n^2) dedup over
                           # ~250 synthetic jobs, repeated per merge; fine
                           # for a test suite, not yet optimized for a hot
                           # ingestion path)
npm run typecheck:server   # tsc --noEmit, no test runner involved
```

## What's real vs. stubbed right now

- **Real**: every normalization rule, the dedup scoring/tiering logic, the
  quality/validation checks, the match/rank formulas, and the anti-domination
  cap -- these are the actual algorithms, not placeholders, and the test
  suite exercises real edge cases (title-similarity-alone must never
  auto-merge, a malformed URL must never falsely collide with another
  malformed URL, ranking must respect hard constraints, etc.).
- **Stubbed, deliberately**: `taxonomy/occupationTaxonomy.ts` is a small hand-curated
  stand-in for O*NET's real occupation crosswalk + skills API, shaped
  exactly like what the real API returns. There's no live API key yet
  (Part 10 -- needs a developer registration). Swapping its two functions
  for real `fetch()` calls to `services.onetcenter.org` is the only change
  Stage 2+ needs; nothing else in the pipeline depends on how that data was
  produced.
- **Not built yet**: anything requiring a live database (the Supabase
  schema exists as migration SQL but isn't applied anywhere), real admin/
  member submission forms, and any automated source adapter. That's Stage 2
  and beyond, per Part 7.

## A few things worth knowing if you extend this

- `NormalizedJob.employmentType` is nullable even though the SQL schema
  marks the column `NOT NULL` -- when title-based classification can't
  confidently determine it, the honest result is "unknown," caught by
  `validateJob()`, not a guessed default. A real ingestion step would need
  to route an unclassifiable job to manual review rather than insert it.
- The dedup test suite found two real bugs worth remembering if you touch
  `dedupe.ts`: (1) a URL that fails to parse must never be compared as
  literal text against another failed parse -- two unrelated malformed
  records can otherwise look like a canonical-URL match; (2) validation
  must run *before* dedup in any pipeline that uses these functions
  together (Part 1's documented order), since dedup has nothing meaningful
  to compare on an invalid record.
- The anti-domination cap in `rank.ts` only works when there's enough
  company diversity in the input to actually demonstrate a cap -- 10 jobs
  from one company and nothing else can't be capped down to 3 in the top
  20, because there's nothing else to fill the remaining slots. This isn't
  a bug, just worth remembering when writing a test or reading a small
  result set.
