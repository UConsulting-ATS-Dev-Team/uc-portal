-- Cleans up the first fetch-greenhouse-stripe run, which hit a real bug in
-- dedupe.ts's normalizeUrl() (fixed in this same commit): it stripped query
-- strings before comparing URLs, and every one of Stripe's 575 Greenhouse
-- postings shares the identical path (stripe.com/jobs/search), differing
-- only by a ?gh_jid=<id> query param -- so all 575 looked like the same
-- canonical URL and 574 of them auto-merged into whichever job happened to
-- be processed first ("Account Executive, AI Startups (Hunter)").
--
-- That one job's own data is fine -- it's a real posting, not corrupted --
-- it just incorrectly accumulated 574 other postings' job_sources rows.
-- Deleting all of them (rather than trying to sort out which one was
-- "really" its match) is correct: the fixed function will reprocess the
-- full feed cleanly, including correctly re-matching gh_jid=8130725 back
-- onto this same job via a genuine (not falsely-collided) URL match.

delete from job_sources
where source_id = (select id from sources where name = 'Stripe (Greenhouse Job Board API)');
