-- One-time cleanup of the duplicate_candidates review queue, alongside the
-- same day's dedupe-scoring threshold fix (server/src/dedupe.ts and its
-- Deno mirror, supabase/functions/_shared/pipeline/dedupe.ts). A live audit
-- found 380 pending candidates, all from one bulk scoring event, all
-- scoring exactly 75 (the review band), and 0 of the 380 had matching
-- titles -- every single one was two genuinely different real postings at
-- the same company/location, caught by the old 0.6 title-similarity
-- threshold being fooled by shared title-template scaffolding (see that
-- migration/comment for the full "Lead Analytics Engineer" vs "Lead AI
-- Engineer" example).
--
-- Distribution of the real 380 (titleSimilarity, extracted from each
-- candidate's own stored `signals` JSONB -- the same field the admin UI
-- itself displays):
--   354 scored below 0.80 (median cluster at 0.60/0.67) -- every sample
--     manually reviewed was confirmed a false positive. Dismissed below,
--     `not_duplicate`, same resolution and fields
--     (status/reviewed_by/reviewed_at) supabase/functions/
--     resolve-duplicate-candidate/index.ts's own "not_duplicate: no data
--     changes, just records the review" path would set for a one-by-one
--     admin dismissal -- this is that same action, applied in bulk rather
--     than one Edge Function call per row, since duplicate_candidates'
--     "admin_all" RLS policy already permits a direct admin write and
--     not_duplicate never touches jobs/job_sources.
--   26 reached 0.80-0.83 -- a genuinely mixed band on manual review (some
--     still clearly distinct roles -- differing by "Internship" vs
--     full-time, or a specific sub-team vs a generic req -- but a few
--     plausible near-duplicates, e.g. "Spacecraft Thermal Engineer I/II"
--     vs "Spacecraft Thermal Engineer II"). Deliberately LEFT PENDING,
--     not dismissed -- this is exactly the band the raised
--     REVIEW_TITLE_SIMILARITY (0.8) is now tuned to keep in front of a
--     human, so leaving these pending is the consistent choice, not an
--     oversight.
--
-- reviewed_by is the account that performed this review (real admin,
-- jflowenberg@gmail.com) -- same field, same meaning as a one-by-one
-- dismissal would record, not a system/service actor.
update duplicate_candidates
set status = 'not_duplicate',
    reviewed_by = '55935627-667d-4ca7-82bf-3c078efdc9ad',
    reviewed_at = now()
where status = 'pending'
  and coalesce(
    (
      select (regexp_match(sig ->> 'detail', 'titleSimilarity=([\d.]+)'))[1]::numeric
      from jsonb_array_elements(signals) sig
      where sig ->> 'name' = 'company_title_location'
    ),
    0
  ) < 0.8;
