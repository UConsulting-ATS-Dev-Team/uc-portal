# UC Job Discovery Engine — Architecture Recommendation

Pre-implementation architecture proposal for the job discovery/aggregation
system behind UC Portal. **This is a planning document, not implemented
code.** Nothing here has been built yet — it's for review before we start.

Optimization order, as directed: **legal safety > reliability >
maintainability > simplicity > scalability > sophistication.**

This document extends the existing UC Portal prototype (see
[PROJECT_PLAN.md](PROJECT_PLAN.md), [CLAUDE.md](CLAUDE.md)) — it does not
redesign the product, pages, or wireframes. Several pieces of the current
mock-data prototype (the Jobs board filter model, the Applications
tracker's stage taxonomy, `preferences` on My Profile, the Admin
Dashboard's opportunity queue) map directly onto real components of this
engine and are called out below where relevant.

---

## Part 1 — Recommended Architecture

```text
Authorized Job Sources (registry-gated)
        ↓
Source Adapters (standard interface, one per source)
        ↓
Raw Job Records (as-fetched, unmodified, kept for audit)
        ↓
Validation / Cleaning (required fields present, URL reachable, junk rejected)
        ↓
Normalization (titles/locations/comp/employment-type → shared taxonomies)
        ↓
Deduplication (multi-signal scoring against existing records)
        ↓
Enrichment / Classification (industry, function, grad-year eligibility, skills)
        ↓
UC Job Database (Postgres — single source of truth, full history kept)
        ↓
Search + Ranking (Postgres FTS + structured filters + weighted scoring)
        ↓
Member Personalization (hard constraints filter, soft preferences rank)
        ↓
UC Career Platform (existing React frontend)
```

**Why this shape:** every layer only knows about the layer immediately
before it — a source adapter doesn't know about ranking, ranking doesn't
know about ingestion. That's what lets a new source (or a source getting
disabled) never touch normalization/dedup/search/ranking code. It also
puts the compliance gate (the source registry) *before* any data enters
the pipeline, not as an afterthought — a disabled or unapproved source
physically cannot reach the database.

This is a fairly conventional "ETL into a queryable store" shape, not
anything exotic. That's deliberate: a small, rotating student team needs
an architecture they can understand by reading top to bottom, not one
that requires tribal knowledge to operate.

---

## Part 2 — Source Strategy

**The hard rule, restated:** "we can technically fetch this" is never
sufficient justification. Every source needs an affirmative answer to "we
are authorized to collect, store, process, and display this," recorded in
the source registry (Part 3.7) before it's enabled — not assumed from
"the page is public."

| Source type | Legal risk | Coverage | Effort | Verdict |
|---|---|---|---|---|
| **Admin submissions** (Careers Committee posts) | None | Low volume, high trust | Low | ✅ MVP — always-safe baseline |
| **UC member submissions** | Low (see note below) | Medium, long-tail roles automated sources miss | Low | ✅ MVP — this is UC's actual differentiator |
| **Employer ATS public job-board APIs** (Greenhouse, Lever, SmartRecruiters, Ashby, etc.) | Low, *if that deployment's API is confirmed public/intended for third-party use* | High, per company | Medium | ✅ Phase 2, one company at a time, each verified individually |
| **Public government/institutional feeds** (e.g. USAJobs API) | None — built for this | Low relevance to UC's target roles, but zero-risk | Low | ✅ Phase 2 if relevant |
| **RSS/XML/JSON feeds explicitly published for reuse** | None, if terms confirm reuse | Variable | Low–Medium | ✅ Phase 2, case-by-case |
| **Licensed third-party job-data providers** (paid APIs) | None — that's what the license is for | High, broad | Cost + procurement | 🔜 Later, once there's budget and the pipeline is proven |
| **Employer career-page automated collection** | **Requires case-by-case legal review** — most career pages do *not* explicitly permit automated collection even without a hard technical block | High | Medium–High | ⚠️ Only for a specific page after confirming its terms/robots.txt permit it; never a default |
| **Indeed / Handshake / LinkedIn / Jobright / similar** | **High** — ToS for these explicitly restrict automated collection | N/A | N/A | ❌ **Not a source.** Not scraped, not accessed via undocumented APIs, not touched. |

**Note on member submissions and copyright:** a member sharing a job
*link* is always fine. The gray area is *copying the full description
text* from a posting into our database. Recommendation: for
member/admin-submitted jobs, store only the facts the submitter
personally enters (title, company, deadline, a short factual summary in
their own words) plus the source URL — don't have the submission form
auto-scrape and store the employer's full posting text. Same rule for
automated sources unless that specific source's terms clearly permit
storing/displaying full description text; default to linking out for the
full description.

**Recommended implementation order:** admin submissions → member
submissions → (prove the pipeline against these two for the full MVP) →
first employer ATS API adapter, reviewed and piloted individually → more
ATS adapters → RSS/institutional feeds → licensed provider, only if still
needed.

I'd explicitly reject "fully API/feed-driven from day one" and "pay for a
licensed provider from day one" as MVP starting points — not because
they're unsafe, but because they either require partnership/procurement
lead time the club doesn't have yet, or cost money before the pipeline is
even proven. Manual submission is the only source that's simultaneously
zero-risk, zero-cost, and available today.

---

## Part 3 — Technical Design

### 3.1 Data model

```text
Job
  # Core (required)
  job_id                  UUID, PK
  source_id                FK → Source
  source_job_id             string, nullable  -- source's own ID, for re-fetch matching
  source_url                string, required
  company                  string, required
  title                    string, required
  employment_type           enum, required   -- Internship / Full-time / Part-time / Fellowship / Co-op / Apprenticeship

  # Core (optional)
  description               text, nullable   -- see copyright note above; often omitted, link out instead
  department                 string, nullable
  job_function               enum, nullable   -- see taxonomy below

  # Location
  city / state / country      string, nullable
  remote_type                enum             -- Remote / Hybrid / In-person

  # Compensation (all optional -- rarely present, never block on it)
  salary_min / salary_max      number, nullable
  salary_currency             string, default "USD"
  compensation_type            enum            -- Hourly / Salary / Unspecified
  compensation_text            string          -- original text, kept for audit even after normalization

  # Recruiting dates
  posted_date / updated_date    date, nullable
  application_deadline          date, nullable
  application_url               string, required

  # Requirements
  graduation_years             int[], nullable  -- normalized eligible grad years
  required_skills / preferred_skills  string[], nullable
  qualifications_text           text, nullable

  # UC-specific (owned by this system, not the CRM -- see 3.6)
  relevant_industries           string[]
  relevant_roles                string[]
  uc_recruiting_notes            text, nullable  -- Careers Committee-authored, not source data

  # Provenance / governance (required, system-managed)
  first_seen / last_seen         timestamp
  last_verified_at               timestamp
  retrieved_at                   timestamp
  active                        boolean
  status                        enum   -- Active / Expiring soon / Potentially expired / Expired / Removed
  confidence_score               float   -- classification confidence, see 3.4
  quality_score                  float   -- see 3.5
  classification_method          enum   -- rule / llm / human, per classified field ideally, or per-record as a simple default
```

**Required vs. optional, in one sentence:** anything needed to *display
and apply to* the job is required (title, company, employment type,
application URL); anything needed to *classify or enrich* it is optional
and degrades gracefully — a job with no salary or no graduation-year data
still shows up in search, just without those filters/badges. Never reject
a job for missing optional fields; flag it for lower quality score
instead (3.5).

### 3.2 Normalization

Deterministic, table-driven, in this order of preference:
1. **Exact-match lookup tables** for employment type, remote type, common
   title phrases → function (e.g. "Business Analyst Intern" → Consulting/
   Strategy). Cheap, fast, fully explainable to a future student debugging
   a bad classification.
2. **Regex/pattern rules** for structured-but-variable text: salary
   ranges (`$35–45/hour` → min 35, max 45, hourly), location strings
   (`NYC / Hybrid` → New York, Hybrid).
3. **LLM fallback**, only for free text that rules genuinely can't parse
   (a qualifications paragraph implying a grad-year requirement without
   ever saying "graduation year"). Every LLM-derived field is stored with
   `classification_method: "llm"` and a `confidence_score` — and is never
   treated as equivalent-confidence to a source-stated fact. This mirrors
   the existing odds model's "every number traceable" principle in
   [CLAUDE.md](CLAUDE.md) — extend the same discipline here: a reader
   should always be able to tell "the employer said this" from "our
   system guessed this."

**Taxonomies** (industries, functions, employment types) live as
versioned lookup tables in the database, not hardcoded in application
code — so an admin can add "Climate Tech" as an industry without a
deploy. Seed them from the existing `data/careerOptions.js` industry
list already in the prototype, extended with a `job_function` taxonomy
(Consulting, Strategy, Investment Banking, Private Equity, Product
Management, Marketing, Data/Analytics, Software Engineering, Operations,
Sales, Other).

### 3.3 Deduplication

**Signals, strongest to weakest:**
1. **Canonical application URL match** (same ATS job ID, e.g. two sources
   both point to the same `boards.greenhouse.io/company/jobs/12345`) —
   near-certain duplicate on its own.
2. **`source_job_id` match within the same source** — trivial re-fetch
   dedup, not cross-source.
3. **Company (normalized) + title similarity + location match** — strong
   combined signal, not individually sufficient.
4. **Posting-date proximity + salary match** — supporting signal only,
   never decisive alone.

**Scoring, three tiers** (adopting the shape you proposed, since it's the
right shape — auto-act on high confidence, queue the middle, ignore the
bottom):
- **≥90 — auto-merge.** Requires canonical-URL match, OR (company match +
  title similarity ≥0.85 + location match) — i.e. always at least one
  near-certain signal, never title-similarity alone.
- **70–89 — flag for admin review** in the same queue the Admin
  Dashboard's opportunity review already uses (this is a direct extension
  of `data/store.jsx`'s `opportunityQueue` / Approve-Edit-Remove pattern
  already prototyped — "merge" becomes a new action alongside those).
- **<70 — treated as separate jobs.** No action.

**False-positive guard:** title similarity is normalized-token based
(e.g. Jaccard over lowercased, stopword-stripped tokens), and two records
never auto-merge on title similarity alone — that's exactly the case that
would incorrectly merge "Marketing Intern at Bain" with "Marketing Intern
at BCG." **False-negative guard:** the review queue (70–89 band) exists
specifically to catch legitimate duplicates that don't hit auto-merge
confidence, so they're not silently dropped — an admin (or eventually a
member flagging "this looks like a dupe") resolves them.

Manual submissions run through the *same* dedup pipeline as automated
ones — a member submitting a role someone already added shouldn't create
a second listing, and this also becomes the safety net for anything an
automated source's dedup logic missed.

### 3.4 Freshness & expiration

States: `Active → Expiring soon (deadline within 7 days) → Potentially
expired (no re-fetch confirmation for N days, deadline passed, or 404 on
health check) → Expired (confirmed, e.g. deadline passed + no update) →
Removed (admin action)`.

**Never delete on a single failed fetch.** A source going temporarily
offline should degrade `last_verified_at` staleness, not data loss —
after 3+ consecutive failed fetches, move to "Potentially expired" and
surface it on the admin dashboard's "source health" panel, don't touch
the record. A job reappearing after being marked potentially-expired
should reactivate cleanly (match on `source_job_id`, don't create a
duplicate). A changed deadline is just a field update on the same record,
not a new job.

### 3.5 Quality scoring

Composite of: source reliability (rolling accuracy of that source's past
data), completeness (required + how many optional fields present),
application-URL health (periodic HEAD-request check), classification
confidence. Used as a **tie-breaker and floor**, not a primary ranking
factor — a low-quality record can still rank highly if it's a strong
relevance/match hit; quality mainly exists to keep broken links and
empty-shell listings from cluttering results, not to reorder good ones.

### 3.6 UC-specific relevance — CRM integration boundary

**Do not build a second alumni CRM inside the job engine.** Define a
narrow read contract instead:

- **The job engine requests from the CRM:** alumni count at company X,
  current-member count at company X, "does UC member Y have a connection
  at company X" — aggregate/relational facts only.
- **The job engine owns itself:** job postings, interview write-ups tied
  to a specific posting, recruiting-intelligence stats computed from
  *tracked applications* (UC applicants/offers per job — this is
  application-tracker data, not CRM data), and the UC-specific
  annotation text Careers Committee authors.

This is exactly the shape the current prototype already fakes with
`data/mockPeople.js`'s `peopleAt(company)` on Job detail's "UC members at
{company}" card — in the real system that function's body becomes a CRM
API call; nothing about the job engine's own schema needs to change.

### 3.7 Source governance (the layer that makes everything above
actually safe)

```text
Source
  source_id, source_name, source_type
  authorization_status   -- Approved / Approved with restrictions / Requires review / Not approved / Disabled
  terms_reviewed_at, terms_reviewed_by
  api_available          boolean
  rate_limits             text
  attribution_required     boolean
  storage_restrictions     text   -- e.g. "do not store full description text"
  redistribution_restricted boolean
  retention_requirement     text
  last_reviewed_at
  notes
```

Every adapter checks its `Source.authorization_status` before running.
`Disabled` or `Requires review` sources simply don't fetch — no code
change needed elsewhere, no risk of a stale adapter silently violating a
changed ToS. This table is the actual enforcement mechanism for
"legal safety first," not just documentation of intent.

### 3.8 Search

Structured filters + keyword search first (this is a direct extension of
the filter column already built on [pages/Jobs.jsx](pages/Jobs.jsx) —
same filter dimensions, backed by a real query instead of an in-memory
array). Postgres full-text search (`tsvector`/`tsquery`) is sufficient at
MVP scale (hundreds to low thousands of jobs) — no dedicated search
engine needed yet.

Natural-language search ("consulting internships in LA for juniors") is
a *later* layer on top of the same structured filters, not a separate
system: parse query → extract known entities (industry keywords, city
names, class-year phrases like "junior" → grad year) into the exact same
filter object the UI already produces from clicking chips. Start with
keyword/pattern extraction; only reach for an LLM parse on queries the
keyword extractor can't confidently map, same "deterministic first"
principle as normalization.

### 3.9 Matching & ranking

**Member profile:** reuse the `preferences` object already built in
`data/store.jsx` and edited on My Profile (`2g`) — industries, roles,
locations, `compTarget`, `recruitingCycle`, `opportunityType`. Don't
invent a second profile schema; this one already has a real edit UI.

**Hard constraints (filter out entirely, never just down-rank):**
graduation-year eligibility, employment-type mismatch (internship vs.
full-time, when the member's `opportunityType` isn't "Both").

**Soft preferences (affect score only):** industry, role, location,
company, compensation vs. `compTarget` — exactly the fields the existing
match-checklist on Job detail already checks.

**Ranking formula:**

```text
Final Score = w1·Relevance + w2·MemberMatch + w3·Freshness
            + w4·Quality + w5·DeadlineUrgency + w6·UCRelevance
```

Suggested starting weights (config values, not hardcoded — tune from real
engagement data once there is any): Relevance 30%, Member Match 30%,
UC Relevance 15%, Deadline Urgency 15%, Freshness 5%, Quality 5%. Member
match and text relevance should dominate; freshness/quality are meant to
break ties and filter junk, not override genuine fit.

**Anti-domination rules:** cap results per company (e.g. max 3 in the
top 20) so one large employer's posting volume can't crowd out smaller
or more relevant listings; apply a mild freshness decay so old postings
naturally fade without being deleted; never let personalization fully
hide a category the member hasn't explicitly excluded — soft preferences
narrow, they don't blind.

---

## Part 4 — Alternatives Considered

- **Full scraping of major job platforms.** Rejected outright — directly
  against the stated constraint, and the actual legal risk (ToS
  violation, account/IP bans, potential legal exposure to UC as an
  institution) is exactly the kind of thing "legal safety first" rules
  out regardless of technical feasibility.
- **Licensed data provider as the MVP foundation.** Rejected as a
  *starting point* (not rejected outright — it's in the Phase 2+ list).
  It costs money before the pipeline is proven, and it doesn't build
  UC's actual differentiator (alumni/member-sourced intelligence) — it
  would just make UC Portal a smaller Indeed. Better as a later coverage
  supplement.
- **Manual-only, forever.** Rejected as a permanent architecture — doesn't
  scale as the club and job market grow, and depends entirely on
  volunteer effort every cycle. Correct as the *MVP* starting point
  precisely because it's zero-risk and validates every downstream layer
  (dedup/search/ranking/matching) before any automated source exists.
- **LLM-classifies-everything from day one.** Rejected — costlier, less
  deterministic, harder for a future student to debug ("why did the AI
  classify this wrong?" vs. "which rule matched?"), and rule-based
  coverage is high enough for structured fields that AI isn't earning its
  complexity yet. Reserved for the genuine long tail.
- **Elasticsearch/Algolia-class search infrastructure from day one.**
  Rejected as premature — meaningful added ops burden (a service to run,
  monitor, and eventually hand off to freshmen) for a dataset size
  Postgres handles natively. Revisit only if relevance quality or dataset
  size genuinely outgrows Postgres FTS.

---

## Part 5 — MVP Recommendation

**Build first:**
- Postgres job database with the schema in 3.1
- Source registry (3.7) — even with only two sources (Admin, Member), the
  gate should exist from day one so adding source #3 later doesn't
  require retrofitting compliance
- Admin submission + Member submission adapters, sharing one pipeline
- Validation, rule-based normalization, rule-based deduplication
- Expiration tracking (deadline-based, no automated re-fetch needed yet
  since there's no automated source)
- Search: Postgres FTS + the filter set already built in the prototype's
  Jobs board
- Matching: hard-constraint filter + soft-preference scoring, reading the
  existing `preferences` object
- Admin review dashboard — this already exists in prototype form
  (`pages/AdminDashboard.jsx`'s opportunity queue); extend it rather than
  building a new one

**Explicitly cut from MVP** (not because they're bad ideas — because the
manual-submission pipeline needs to be proven correct before anything
automated depends on it):
- Any employer API/feed adapter
- LLM-based classification (rules only, first pass)
- Natural-language search
- CRM integration (keep mocking `peopleAt`-style data as the prototype
  does now)
- Licensed provider
- Any ML-based ranking (use the explicit weighted formula, tune manually)
- Dedicated search infrastructure

---

## Part 6 — Risks

**Technical:** an ATS changes its public API's response shape and breaks
an adapter silently — mitigate with per-source fetch monitoring/alerts,
never delete data on a failed fetch (3.4). Dedup false positives/
negatives — mitigate with the tiered confidence bands and a real review
queue, not fully automated merging.

**Legal/compliance:** the single biggest risk is treating "the API
responded" as equivalent to "we're authorized to use this" — the source
registry's `Requires review` default state exists specifically to force
a human decision before that happens. Second risk: storing full
copyrighted job-description text beyond what a specific source's terms
permit — default to link-out, not full-text storage, until a source is
confirmed otherwise. Third: member-submitted content needs a submission-
time acknowledgment that the submitter has the right to share it.

**Data quality:** free-text member submissions will be messy — the same
normalization/enrichment pipeline that handles automated sources should
run on submissions too, not a separate "trust the member" path.

**Maintenance:** a small, rotating student team is the actual long-term
constraint. Every design choice above that says "deterministic rules
over ML" or "Postgres over a dedicated service" is in service of this —
optimizing for "a sophomore can read this code and understand why a job
got classified the way it did," not for sophistication.

---

## Part 7 — Implementation Sequence

```text
Stage 0 (done)   Current mock-data prototype -- Jobs board, filters, store,
                 Admin opportunity queue. This already validates the UI/UX
                 and data shapes the real engine will serve.

Stage 1 (done)   Synthetic dataset (server/synthetic/generateSyntheticJobs.ts,
                 seeded/deterministic, deliberately duplicated/malformed) +
                 Supabase schema (supabase/migrations/20260821120000_init_schema.sql,
                 since applied to the live project, see Stage 2 below) +
                 normalization/dedup/quality/matching/ranking built as plain
                 TypeScript (server/src/) and proven against the synthetic
                 set -- 44 tests passing (`npm run test:server`). See
                 server/README.md.

Stage 2 (MVP,    Real Supabase project live (Part 9), schema + RLS + grants
done)            applied and verified end-to-end. Real auth (email/password,
                 Google deferred) replaces SignIn.jsx's simulated flow --
                 verified: sign-up, email confirmation, sign-in, and the
                 handle_new_user() trigger's profile creation all confirmed
                 against the live project. Member submission (Post an
                 opportunity) writes a real opportunity_submissions row;
                 admin Approve builds a real jobs row from it (simple field
                 mapping, not yet the full normalize/enrich pipeline) and
                 Reject marks it rejected. RLS-verified both ways: a
                 non-admin's Approve attempt was correctly blocked, and
                 testing that surfaced a real self-role-escalation gap in
                 the profiles update policy, now fixed with a trigger. The
                 10 mockJobs.js jobs are seeded into the real jobs table
                 (translated to the real schema, not copied verbatim -- see
                 20260821190000's header for what didn't carry over and
                 why), and data/jobSearch.js is real Postgres full-text
                 search against them (US-35), verified against live data:
                 keyword search with real stemming, company search, filter
                 combinations, graduation-year array filtering. Deliberately
                 standalone -- doesn't touch Jobs.jsx's UI yet.
                 data/jobMatch.js (US-32/33/34/40) ports server/src/match.ts
                 + rank.ts's logic to plain JS, running against real jobs
                 rows and the existing local `preferences` object -- same
                 hard-constraint/soft-preference split, same anti-domination
                 cap. Verified against live data: full-time jobs and the
                 externship correctly excluded entirely for an
                 internship-only preference (hard constraint), correct top
                 match, and freshness correctly breaking a tie between two
                 equal-scoring jobs.

                 Real jobs are now visible in the app, not just provable via
                 a console query: GlobalSearch.jsx's Jobs results come from
                 data/jobSearch.js instead of the mock substring search.
                 Verified in-browser: "consulting" returns the 3 correct
                 real jobs alongside the existing mock company/resource/
                 feed results.

                 pages/RealJobDetail.jsx gives a real job its own detail
                 view at the same /jobs/:jobId route the mock JobDetail
                 already uses -- JobDetail.jsx dispatches on whether the id
                 is a UUID (real) or a slug (mock), so there's one canonical
                 job-detail URL, not two parallel schemes, and the existing
                 mock page is untouched. Deliberately simpler than the mock
                 page (no odds model/UC connections/write-ups -- that needs
                 CRM/tracker data a real job doesn't have), but the match
                 checklist is genuinely real (data/jobMatch.js), reusing the
                 mock page's own CSS classes for visual consistency.
                 GlobalSearch's Jobs results now link here instead of
                 straight to application_url, closing the loop US-48
                 describes (apply from the detail page, not search results
                 directly). Verified in-browser: real match factors render
                 correctly (industry/location/compensation matched, role
                 honestly unmatched since no relevant_roles data exists
                 yet), Apply opens the real application_url, the real
                 company logo loads -- and neither existing path regressed
                 (a mock job still renders unchanged, a bogus slug still
                 shows "Job not found").

                 Member preferences now sync to Supabase in the background
                 (member_preferences, RLS-restricted to each member's own
                 row) -- data/memberPreferencesSync.js hydrates from the
                 remote row once on mount and syncs on every real change,
                 without touching Onboarding.jsx/MyProfile.jsx at all; they
                 keep reading/writing the same local `preferences` object
                 exactly as before. This was the last piece Part 3.9 called
                 for -- data/jobMatch.js can now eventually run server-side
                 against real preference data. Verified in the browser:
                 changing a preference landed in the real row within a
                 second, and simulating a fresh device (wiped local state,
                 reloaded, same session) correctly hydrated everything back,
                 with the UI's own profile-strength calculation reflecting
                 it correctly.

                 Jobs.jsx itself now reads real data too -- the piece
                 deferred three separate times until everything above was
                 individually proven. data/realJobAdapter.js maps a real job
                 row (+ its data/jobMatch.js result) into the exact shape
                 JobCard/jobUtils.js already expect, so neither needed a
                 rewrite -- JobCard renders real jobs completely unchanged.
                 Filters tied to fields a real job doesn't carry (UC
                 connections, UC-posted, referral available, company size)
                 are gone, not disabled -- that data belongs to the
                 still-mocked CRM/tracker boundary, and a checkbox that can
                 never honestly match anything is worse than not having it.
                 Verified extensively against the 11 live jobs: real match
                 scores, filters/sort/tabs all correct including several
                 genuine edge cases (missing comp, missing deadline,
                 unclassified industry) that rendered gracefully instead of
                 crashing, Save persists a real job's UUID correctly, and
                 neither the mock JobDetail path nor Home/Feed's mock
                 JobCard usage regressed.

                 The Approve action now runs the real pipeline server-side
                 too (supabase/functions/approve-submission), closing the
                 one gap the paragraph above used to flag: the "simplified
                 field mapping" AdminDashboard.jsx's Approve used to do
                 (data/opportunitySubmissionUtils.js, now deleted) is
                 replaced by an Edge Function that ports Stage 1's
                 normalize/dedup/quality pipeline (server/src/, 44 tests)
                 essentially unchanged -- same taxonomy modules, same
                 dedup scoring/tiering, only two adaptations for Deno:
                 explicit .ts import extensions, and crypto.randomUUID()
                 in place of node:crypto. The function re-derives and
                 checks the caller's admin status itself (service_role
                 bypasses RLS, so the client-side Approve button being
                 admin-gated is UX only, not the real boundary), then
                 normalizes the submission, validates required fields,
                 scores it against every active job for duplicates, and
                 branches on the same three tiers §3.3 defines: <70 inserts
                 a new job; 70-89 still goes live (the admin already
                 approved it) but is also flagged into duplicate_candidates
                 for review (US-18); >=90 doesn't create a second job at
                 all -- it attaches as an additional job_sources row on the
                 existing one, so two submissions of the same posting never
                 produce a visible duplicate. Full field-level merge
                 reconciliation (US-19) stays deferred, per Part 8.5's own
                 exclusion list. Source attribution (member vs. admin, for
                 job_sources' provenance) is resolved from the submitter's
                 own profiles.role at approval time, not from which UI
                 screen posted it -- PostOpportunityModal.jsx is shared
                 between both and never recorded that distinction itself.
                 Seeded via a new migration (20260822100000): two `sources`
                 rows, "UC Admin Submission" and "UC Member Submission",
                 both `approved` -- §3.7's registry gate now has a real
                 enabled/disabled switch sitting in front of this path, not
                 just the automated-source path Part 7 originally pictured
                 it guarding.

                 Two real bugs found before this shipped, both instructive:
                 (1) the submitter's own class-year chip selections
                 (payload.classYears -- a structured fact, not free text)
                 were being silently discarded in favor of the weaker
                 extractGraduationYears() text-fallback, because a comment
                 asserted they'd be "passed through directly" without the
                 code actually doing it -- caught before deploying, not
                 after. (2) deployed and got "permission denied for table
                 profiles" on the very first live Approve click --
                 service_role bypasses RLS but not table-level GRANTs,
                 which turned out not to be auto-granted on this project
                 any more than 20260821150000_grants.sql already found
                 authenticated wasn't. Fixed the same way: an explicit
                 grant migration (20260822110000), this time to
                 service_role, discovered by putting the actual Postgres
                 error (with its own correct GRANT hint) into the
                 function's response temporarily, not by guessing.

                 Verified against the live project, not just deployed: a
                 clean submission ("Redwood Strategy Partners") came back
                 fully normalized -- occupation classified from the title
                 alone (Consulting, via the O*NET stub), city/state/country
                 parsed from "Chicago" + a Hybrid work-mode chip, comp
                 parsed from "$40/hr" into structured min/max/hourly, the
                 submitter's own class-year chips landing correctly in
                 graduation_years, quality_score's completeness math
                 checking out field-by-field by hand. Then both dedup
                 branches, against the real seeded Bain job: a submission
                 reusing its exact application URL scored 100 and
                 correctly merged (job count for Bain stayed at 1, a new
                 job_sources row appeared instead); a similar-but-distinct
                 title ("Associate Consultant Summer Intern," Jaccard
                 0.75 against the original) scored 75 and correctly went
                 live as its own job while landing a real
                 duplicate_candidates row with the exact matched signals
                 recorded. All test data (3 submissions, 2 jobs, 1 dedup
                 row, 1 provenance row) removed afterward via a dedicated
                 cleanup migration (20260822120000) rather than left in
                 the live database.

                 **Stage 2 is now fully complete**, including the piece
                 that used to be deferred. What's left is genuinely Stage
                 3+ scope: an automated source, and a real CRM integration
                 to replace the still-mocked UC connections/past-cycle
                 data.

Stage 3 (done)   First automated source: Stripe, via Greenhouse's public Job
                 Board API (developers.greenhouse.io/job-board.html).
                 Selected after checking all 8 mock companies for a
                 legitimate, structured, no-login path -- confirmed against
                 Greenhouse's own developer docs as an explicitly
                 third-party-facing integration point ("no permission
                 needed... build custom career and application sites"), the
                 cleanest affirmative-authorization case of anything found.
                 For reference, the others: BCG and Deloitte each embed
                 full schema.org JobPosting markup (Google-for-Jobs data,
                 a real but different kind of "meant for reuse" signal);
                 Accenture's Workday career site has an internal JSON
                 endpoint that works but isn't a documented public API;
                 Bain (proprietary "Recruits Portal"), McKinsey (site
                 stalls plain HTTP requests -- bot-protected), Goldman
                 Sachs (client-rendered SPA, no structured data), and
                 EY-Parthenon (SuccessFactors, but this instance omits the
                 schema Deloitte's has) had nothing usable. None of that
                 rules the others out for a future adapter -- Stripe was
                 just the cleanest case to pilot the mechanism against
                 first, per this Part's own "piloted individually"
                 guidance. Also researched hiQ Labs v. LinkedIn before
                 building anything: it narrows CFAA (federal
                 computer-crime) exposure for scraping data with no login
                 wall, but doesn't touch ToS/breach-of-contract exposure,
                 and hiQ still lost as a business (settled, shut down)
                 despite winning that legal question -- reinforces this
                 doc's existing bar of "affirmatively authorized," not
                 "technically public."

                 supabase/functions/fetch-greenhouse-stripe reuses the
                 exact normalize/validate/dedup/insert pipeline
                 approve-submission already runs -- both were refactored to
                 share one copy (supabase/functions/_shared/) instead of
                 diverging, so a member manually submitting a Stripe role
                 correctly merges with the automated feed's copy and vice
                 versa. Deliberately never requests Greenhouse's
                 ?content=true (no full description text ever touched --
                 Greenhouse's API terms cover API use, not a copyright
                 license from Stripe over the posting text; application_url
                 is the link-out path, same default as every other source).
                 Seeded via 20260822130000 as a normal §3.7 registry row
                 (authorization_status flips it off with no redeploy, the
                 actual kill-switch). Scheduled daily via pg_cron + pg_net
                 (20260822140000) -- the anon key embedded in that cron job
                 is not a secret (already shipped in the frontend bundle;
                 the function's own privileged work runs on its injected
                 SUPABASE_SERVICE_ROLE_KEY, not this header).

                 Three real bugs found only by running this against
                 Stripe's actual 575-posting feed, not synthetic data, all
                 fixed before/while shipping:
                 1. normalizeEmploymentType()'s /intern(ship)?/ pattern had
                    no word boundary -- matched "Internal Audit Lead" and
                    "International Accounting Lead" as substrings,
                    misclassifying 9 real senior full-time titles as
                    internships. Fixed in both server/src/ and the Edge
                    Function's copy (word-boundaried); server test suite
                    (44 tests) still green after.
                 2. ~90% of Stripe's real titles ("Account Executive,"
                    "Staff Engineer," etc.) carry no employment-type signal
                    at all -- only internships/co-ops self-declare in a
                    title, by convention. normalizeJob()'s "never guess"
                    rule is correct for its original context (ambiguous
                    member free text) but would have silently dropped ~90%
                    of a real external feed unchanged. Fixed as an
                    adapter-level policy, not a pipeline change: an
                    unclassified title defaults to full_time here,
                    documented in the function's own header as this
                    adapter's judgment call.
                 3. dedupe.ts's normalizeUrl() stripped query strings
                    before comparing -- fine for the mock data's per-job
                    URL paths, but every one of Stripe's 575 postings
                    shares the identical path (stripe.com/jobs/search) and
                    is distinguished only by a ?gh_jid=<id> query param
                    (their careers site is a client-side router). First
                    deploy auto-merged 574 of 575 postings into one job
                    before this was caught. Fixed by including the query
                    string in the comparison (both copies, 44 tests still
                    green); required a cleanup migration (20260822150000)
                    to remove the incorrect job_sources rows before
                    rerunning. The fix also surfaced a real scale problem
                    the first (pre-fix) run had been masking: once postings
                    correctly stopped merging into one, ~570 real inserts
                    at several sequential DB round-trips each hit
                    Supabase's Edge Function resource limit outright --
                    Stage 1's README already flagged this exact "not yet
                    optimized for a hot ingestion path" risk. Rewrote
                    fetch-greenhouse-stripe to load every lookup once
                    up front (active jobs, existing job_sources for this
                    source, job_functions) and write in bulk at the end
                    (~9 round-trips total regardless of N) rather than
                    per-job; the O(n^2) in-memory dedup scoring itself was
                    never the actual bottleneck.

                 Verified against live data, not just deployed: final run
                 processed all 575 postings (126 inserted, 1 merged, 6
                 flagged into duplicate_candidates for review, 448 refreshed
                 from an interrupted prior run, 0 invalid, numbers summing
                 exactly to 575). Cross-checked directly against Postgres:
                 job_sources row count and unique job-id count reconcile
                 exactly against total Stripe rows in `jobs` (573 real +
                 2 original mock-seeded = 575). Confirmed live on the Jobs
                 board (584 total including 8 other mock companies + 1
                 earlier Stage 2 test job kept from before), correct
                 employment-type breakdown (9 internship / 1 externship /
                 574 full-time), and a real job's detail page rendering
                 cleanly with no description (RealJobDetail.jsx already
                 handled a null description gracefully) -- a real gap
                 caught in that same pass: the detail page's "About this
                 listing" copy said "admin-approved posting" unconditionally,
                 inaccurate for an automated-source job; fixed to be
                 sourcing-neutral.

                 Gap-fill after Stage 3: the pilot's own dedup scoring
                 populated duplicate_candidates with 18 real pending rows
                 (the 70-89 review band, US-18) and there was no way for an
                 admin to see or act on any of them -- Part 8.5's own build
                 order actually lists admin monitoring as a prerequisite
                 *before* the first automated-source pilot, a step that got
                 skipped in practice. Closed via a new Admin Dashboard
                 section (real data, not mocked like the KPI strip above
                 it) and supabase/functions/resolve-duplicate-candidate,
                 following the same admin-reverification pattern as
                 approve-submission -- factored the shared "verify caller is
                 actually an admin" logic both functions needed into
                 supabase/functions/_shared/requireAdmin.ts rather than a
                 third copy. Two resolutions: "not a duplicate" just
                 records the review; "confirmed duplicate" (admin picks
                 which of the two survives) reassigns the removed job's
                 job_sources onto the survivor and deactivates it --
                 stopping short of US-19's full field-level merge
                 reconciliation on purpose, same scope line
                 approve-submission's own auto-merge already draws, since
                 hiding the redundant listing is what actually matters to a
                 member browsing the Jobs board. Verified against the real
                 18 rows from the Stripe pilot, both paths: "not a
                 duplicate" correctly cleared a row with no data changes;
                 "confirmed duplicate" on a real pair ("Technical Program
                 Manager, Service Infrastructure" vs "...Core
                 Infrastructure") was cross-checked directly against
                 Postgres afterward -- the kept job correctly ended up with
                 both job_sources rows (the reassigned one downgraded to
                 is_primary: false), the removed job correctly
                 active: false / status: 'removed', and the
                 duplicate_candidates row correctly confirmed_duplicate
                 with reviewed_by/reviewed_at set.

                 A second gap closed in the same pass: §3.7's source
                 registry (the actual enforcement mechanism -- every
                 ingestion path checks authorization_status before writing
                 anything) had no UI at all. Flipping a source off required
                 running SQL by hand. Repurposed the "/admin/opportunities"
                 nav destination -- a Placeholder stub, not one of the 24
                 designed wireframe screens -- into pages/SourceManagement.jsx:
                 every `sources` row, its real active-job count (via
                 job_sources), and an Approved<->Disabled toggle. No new
                 Edge Function needed -- sources already grants admins full
                 RLS access directly, unlike jobs/job_sources. requires_review
                 and not_approved are shown read-only on purpose (not a
                 casual toggle) -- §3.7's point is that those need an actual
                 human review decision. Verified live: disabling Stripe's
                 source and immediately invoking fetch-greenhouse-stripe
                 returned {"skipped":true,"reason":"source is disabled"}
                 with zero code change or redeploy, then re-enabled and
                 confirmed the status flipped back. Also surfaced something
                 real, not a bug: "Test Company Inc" (approved before this
                 session's Stage 2 fix existed) correctly shows 0 active
                 jobs for UC Admin Submission, since it predates job_sources
                 provenance entirely -- an honest gap in old data, not a
                 miscount.

                 A third gap closed in the same pass: fetch-greenhouse-stripe
                 runs completely unattended (daily via pg_cron) with zero
                 record of whether any given run actually succeeded --
                 exactly the kind of silent failure Part 6 already names as
                 the real risk for a small, rotating team. Added
                 source_fetch_log (US-51, one row per run, every scheduled
                 fetcher writes to it -- not Stripe-specific) and a
                 restructured fetch-greenhouse-stripe: the whole body now
                 returns its outcome as data (httpStatus/body/logStatus/
                 logSummary) instead of calling Response directly at each of
                 its many exit points, so Deno.serve()'s single call site
                 can log success, failure, *and* skipped consistently rather
                 than needing the log call duplicated at every early return
                 (a real risk of exactly the kind of blind spot this feature
                 exists to catch). SourceManagement.jsx surfaces the latest
                 log per source -- status, timestamp, one-line summary --
                 with submission-only sources (admin/member) correctly
                 showing "Never" since they have no schedule to run on.
                 Verified live, all three states: a normal run logged
                 "Success -- 575 fetched, 0 new, 0 merged, 0 flagged"
                 (nothing had changed since the prior day's run); disabling
                 Stripe and re-invoking logged "Skipped -- source is
                 disabled" and rendered correctly; re-enabling restored
                 normal status. (Failed wasn't force-tested -- no safe way
                 to simulate a genuine Greenhouse outage -- but the code
                 path is structurally identical to the two that were.)

                 Before Stage 4: a real prioritization signal for which
                 company to research next, replacing the manual
                 company-by-company research this session otherwise relied
                 on. member_preferences.followed_companies already let a
                 member follow any company name (Onboarding's StepCompanies
                 always supported free-text follows; MyProfile's Career
                 preferences tab didn't -- fixed here, plus it was silently
                 dropping any custom-followed company from its own display
                 since it only ever rendered the fixed COMPANIES list, a
                 real bug caught while building this). The hard part isn't
                 the UI, it's that member_preferences RLS deliberately grants
                 each member only their own row -- CLAUDE.md and that
                 table's own migration comment are both explicit that admins
                 see aggregate signal only, never raw per-member preference
                 rows. A `security definer` Postgres function
                 (company_demand_report) is what actually enforces that,
                 not just documents it: it can read every row internally,
                 but its return shape is fixed to company/follower-count
                 pairs, so there's no query against it that gets a member's
                 identity back out, unlike an RLS policy opening raw table
                 access that depends on every future query being written
                 carefully. Gated to admins inside the function itself
                 (raises an exception otherwise), same defense-in-depth
                 spirit as is_admin() elsewhere. known_companies is passed
                 in by the caller (data/careerOptions.js's COMPANIES list)
                 rather than hardcoded, so the function doesn't need a
                 migration every time that list changes. Surfaced as a new
                 "Requested companies" panel on SourceManagement.jsx.
                 Verified live end-to-end: followed "Palantir" via My
                 Profile, confirmed it landed in the real member_preferences
                 row, confirmed it appeared as "Palantir -- 1" on the admin
                 panel, then unfollowed it and confirmed the panel correctly
                 emptied back to "No requests yet" -- test data cleaned up
                 rather than left as fake demand signal in a feature whose
                 entire point is reflecting real signal.

                 Also added: scripts/check-company-source.mjs, a triage tool
                 for the manual research this session otherwise redid by
                 hand per company (checking Greenhouse/Lever's public APIs
                 by guessed slug, and a company's own careers page for
                 schema.org JobPosting markup or a Workday hint). Explicit
                 in its own header: this answers "is there a technically
                 reachable pattern," never "are we authorized" -- Part 2's
                 case-by-case review still applies to anything it finds
                 before that source is flipped to approved. Found a real
                 false-positive risk while verifying it against known
                 companies: Greenhouse board tokens aren't reserved by
                 company identity, and slug "bcg" resolved to an unrelated
                 "Bohen Consulting Group" with placeholder test postings,
                 not Boston Consulting Group. Fixed by surfacing each hit's
                 own company_name (Greenhouse) or a sample posting URL
                 (Lever, which has no equivalent field) so a human confirms
                 the actual company before trusting a slug match, plus a
                 same-run regression check against Stripe/Veeva (Lever) to
                 confirm the fix didn't break real hits.

Stage 4 (started) Additional ATS adapters for other UC-target companies;
                 RSS/institutional feeds where available; evaluate a
                 licensed provider only if coverage is still insufficient.

                 First addition: Deloitte, via a real RSS 2.0 feed at
                 apply.deloitte.com/en_US/careers/SearchJobs/{keyword}/feed/
                 -- chosen over BCG (schema.org present, but its
                 search-results page is a client-rendered SPA with no
                 enumeration mechanism to crawl) and Accenture (a clean
                 Workday JSON endpoint, but an internal one their own site's
                 JS calls, not a documented public API -- the weakest legal
                 footing of the three). RSS is a categorically different
                 legal posture than scraping the HTML search page sitting
                 right next to it: it's a format that's existed specifically
                 for third-party syndication since the format's own
                 invention, matching Part 2's "RSS/XML/JSON feeds explicitly
                 published for reuse" category -- confirmed live (real
                 Content-Type: text/xml, standard <channel>/<item> shape),
                 not assumed. supabase/functions/fetch-deloitte-jobs
                 enumerates via three keyword feeds (consultant/strategy/
                 analyst) and pulls structured facts (employmentType,
                 jobLocation, validThrough) from each job's own schema.org
                 JobPosting JSON-LD -- reusing the exact shared pipeline and
                 batched-write architecture fetch-greenhouse-stripe already
                 proved, applied from the start this time rather than
                 relearning the resource-limit lesson twice.

                 Two things confirmed only by testing against the real feed:
                 (1) the feed hard-caps at 20 results per keyword regardless
                 of jobRecordsPerPage/jobOffset -- confirmed by requesting
                 100 and offset 100 and getting back the identical 20 items
                 both times. Accepted as a real limit, not fought around --
                 respecting a source's own designed boundary is the more
                 conservative choice anyway. (2) Deloitte's own
                 employmentType field is frequently blank ([""]), same real
                 gap Stripe's titles had, just as an empty structured field
                 instead of a missing one -- same adapter-level "default to
                 full_time" policy applied, documented as this adapter's own
                 call, not a shared pipeline change.

                 One deliberate scope difference from Stripe: no expiration
                 sweep. Greenhouse's feed is exhaustive (every posting, one
                 call), so "tracked before, absent today" is a real "this
                 posting closed" signal. This feed is capped at the 20 most
                 relevant results per keyword -- a job can drop out of that
                 window because something more relevant appeared, not
                 because it closed. Running the same sweep here would
                 incorrectly mark still-open Deloitte roles expired, so it's
                 skipped outright rather than producing a false signal.

                 Verified against live data: first run processed all 47
                 unique postings across the three keywords cleanly (0
                 invalid, 0 missing schema, 0 company-name mismatches --
                 the latter a real safeguard, same spirit as
                 check-company-source.mjs's slug-collision catch, checking
                 each page's own hiringOrganization.name says Deloitte
                 rather than trusting the URL). Spot-checked the resulting
                 jobs directly against Postgres: correct full_time default,
                 honest null city/state where Deloitte's own address fields
                 were empty, correct occupation classification varying
                 sensibly by role (Tax roles -> unclassified "rule", cyber/
                 consulting roles -> "onet_occupation" with a real
                 job_function_id), and a genuinely new capability Stripe
                 never exercised -- application_deadline populated from
                 validThrough and rendering as a real "Applications close"
                 banner on the job detail page. Re-ran a second time to
                 confirm idempotency: all 47 correctly recognized as
                 already-tracked (0 detail-page re-fetches, 47 refreshed, 0
                 duplicated) rather than reprocessed or re-inserted. Caught
                 and fixed one real display bug in the same pass: this
                 adapter's fetch summary used a different key name
                 (rssItemsFound) than fetch-greenhouse-stripe's
                 (fetched) for the same concept, which SourceManagement.jsx's
                 shared summarizeFetchLog() didn't know how to read --
                 rendered as a literal "?" until renamed to match the
                 common shape.

Stage 5          LLM-assisted classification fallback for the long tail;
                 natural-language search; ranking-weight tuning from real
                 engagement data; real CRM integration replacing the
                 mocked alumni/connection data.
```

---

## Part 9 — Stack Decision: Supabase + Vercel + TypeScript

Resolves the three open questions above. Your advisor already pays for
both Supabase and Vercel, which removes the "free tier is a toy"
concern — this is now the confirmed plan, not a proposal.

**Database + backend logic: Supabase.** It's the same Postgres this
whole document already assumes (§3.1's schema, §3.8's FTS approach)
with less ops burden — managed hosting, built-in auth, a REST/GraphQL
layer generated from the schema (PostgREST), and **Edge Functions** for
anything that needs real logic beyond a query (normalization, dedup
scoring, the ranking formula, source adapters). Free-tier note worth
knowing, not worth worrying about: a project pauses after 7 days with no
API traffic and needs a manual "restore" click to wake up — irrelevant
once real usage exists, only matters during a quiet stretch like a
school break.

**Language: TypeScript, not Python.** This reverses my original lean
toward Python/FastAPI. Supabase Edge Functions run on Deno/TypeScript,
and the existing frontend is already React/JS — Supabase's own ecosystem
is the deciding factor here, not a language-preference toss-up. One
language across the whole stack matters more for "a rotating student
team can pick this up" than Python's text-processing libraries do, and
Deno's stdlib + npm compatibility covers everything §3.2's normalization
rules and §3.3's dedup scoring need.

**Hosting: Vercel for the frontend** (and any code that doesn't fit as
an Edge Function) — zero-config for the existing Vite app, generous free
tier that's a non-issue anyway since it's already paid for.

**Where the backend lives:** a `supabase/` directory in this same repo
(migrations + Edge Functions), not a separate service/repo. Supabase's
own CLI/project structure expects this, and it keeps one repo as the
source of truth rather than splitting deploys across two codebases for
a team this size.

**Concrete mapping onto the architecture already specified:**
- §3.1 schema → Supabase migrations (plain SQL, versioned in `supabase/migrations/`)
- §3.7 source registry, §3.2 normalization, §3.3 dedup, §3.9 ranking → Edge Functions, each one function per pipeline stage so a stage can be tested/redeployed independently
- §3.8 search → Postgres FTS via PostgREST or a thin Edge Function wrapper, same filter shape the existing `pages/Jobs.jsx` already sends
- Admin review queue (US-08/18) → a Supabase table + Row Level Security policy restricting write access to admin roles, extending the exact `opportunityQueue` shape already prototyped in `data/store.jsx`

Still nothing implemented. This section is a confirmed decision, not
open anymore — the rest of Part 7's staged sequence stands unchanged.

---

## Part 10 — O*NET for Title Normalization & Skill Enrichment

Confirmed addition, refining §3.2's normalization approach and §8.2's
US-10/US-26 entries. O*NET (O*NET Web Services, sponsored by the U.S.
Dept. of Labor) is a free, public, government resource explicitly built
for this kind of reuse — an authorized source from the start, not
something requiring the case-by-case caution the rest of Part 2's source
table applies to job-listing sources. It's free with a developer
registration + API key, and its one real condition is attribution — a
visible credit/link to O*NET Web Services near wherever it's used.
([O*NET Web Services Data License](https://services.onetcenter.org/help/license_data))

**Important distinction from Part 2's source table:** O*NET is a
*reference/taxonomy* source, not a job-listing source — it never
contributes an actual job record, only classification data used during
enrichment. It doesn't go in the `Source` registry (§3.7) that gates job
ingestion; it's closer to the taxonomy lookup tables §3.2 already
describes (industries, functions, employment types) — just sourced from
an authoritative external dataset instead of hand-curated from scratch.
Its API key and attribution requirement should be documented as
deploy/config concerns, not a per-record governance flag.

**The approach:**
1. **Title → O*NET occupation.** O*NET organizes the labor market into
   ~900 standardized occupations, each with a crosswalk of alternate job
   titles — this can seed (or outright replace) the hand-built
   title-normalization lookup table §3.2 originally proposed for US-10.
   "Business Analyst Intern," "Summer Business Analyst," and "BA
   Internship" plausibly all resolve to the same occupation code through
   this crosswalk, deterministically, before any LLM fallback is needed.
2. **Occupation → skills/knowledge/technology-skills.** Once a job is
   classified to an occupation, pull that occupation's associated
   skills/knowledge/technology-skills list as the job's *inferred* skill
   profile for US-26 — no free-text NLP extraction required as the first
   pass.
3. **Tag it honestly.** Store these as `classification_method:
   "onet-occupation"`, distinct from anything the posting itself states
   — this is US-28's fact-vs-inferred distinction in practice: "typical
   for this role type" (O*NET), never presented as "this employer's
   stated requirements."
4. **Match against member-reported skills.** This is the piece that
   makes US-32's matching actually use skill data — requires adding a
   `skills` field to the member profile, which doesn't exist yet in the
   prototype's `preferences` object (industries/roles/locations/
   compTarget/recruitingCycle are there; skills isn't). Small addition,
   same shape as the existing fields.

**Two honest limitations, worth designing around rather than ignoring:**
- **Occupation-level, not posting-level.** O*NET says what's typical for
  "Financial Analysts" broadly, not that *this specific* posting wants
  Excel VBA specifically. Fine as a baseline enrichment layer as long as
  it stays labeled "typical for this role type," never conflated with
  the posting's own stated requirements.
- **General labor-market taxonomy, thinner for UC's actual niche.**
  O*NET classifies "Investment Banking Analyst" reasonably but won't
  capture the specifics UC members actually care about (case-interview
  skills, particular deal experience, etc.) with much granularity.
  Recommendation: treat O*NET as the free authoritative *base layer*,
  and leave room for a small UC-curated supplementary skills list
  layered on top for consulting/finance/tech specifics — not a
  replacement for it, an addition once the base layer is proven.

**Effect on MVP scope:** this makes US-10 (title normalization, already
P0) cheaper and more accurate to build than the from-scratch lookup
table originally planned. It also makes US-26 (skill extraction,
originally P1 specifically *because* free-text NLP extraction is hard to
get right) meaningfully more tractable — worth reconsidering for MVP
inclusion rather than deferral, since occupation-based skill lookup is
deterministic and roughly the same effort as the title crosswalk it
depends on. Not forcing that reclassification here — just flagging that
the original reason for deferring US-26 (extraction difficulty) is
substantially weaker now.

---

## Part 8 — User Story Requirements & MVP Prioritization

Second pass, driven by the 61-story backlog you provided. **Still no code
below — this maps stories onto the architecture above, flags where it
needs to change, and reprioritizes.** The single biggest finding: a
surprising number of these stories are **already built in the existing
UC Portal frontend**, just running against `mockJobs.js` instead of a
real database. That changes what "P0" actually means here — for those
stories, the frontend work is done and the P0 task is *only* the backend
underneath it, not new UI.

### 8.1 Already built in the prototype (frontend side)

Confirmed against the current codebase, not aspirational:

| Story | Where it already lives |
|---|---|
| US-07 Submit an opportunity manually | `components/modals/PostOpportunityModal.jsx` |
| US-08 Review submitted opportunities | `pages/AdminDashboard.jsx` opportunity queue (Approve/Remove) |
| US-21 Track application deadlines | `data/jobUtils.js` deadline math + urgency flags |
| US-29/US-30 Create/update career preferences | Onboarding (`2i`/`2j`) + My Profile (`2g`), `store.preferences` |
| US-34 Explain job match scores | Job detail's "Why this is a 94% match" checklist — this is *exactly* US-34's example shape already |
| US-35/US-36/US-37 Keyword search, filter, sort | `pages/Jobs.jsx` filter column + tabs + sort |
| US-39 Save a search | Button exists, wiring is the only gap (currently inert) |
| US-44 Show UC connections | `data/mockPeople.js`'s `peopleAt()`, Job detail's "UC members at {company}" |
| US-45 Show previous UC experiences | Job detail's interview write-ups; the *contribution* flow also already exists (`ContributeModal.jsx`) |
| US-46 Show UC recruiting resources | Job detail's prep-resources rail, Career Resources tie-in |
| US-47 View complete job info | `pages/JobDetail.jsx`, full page |
| US-48 Apply through original source | Job detail's "Apply on {company} site" button |
| US-49 Save a job | `toggleSavedJob` |
| US-50 Add to application tracker | `addToTracker`, `AddApplicationModal.jsx` |
| US-53 Monitor member behavior (aggregate) | Admin Dashboard KPI strip, industry gap analysis — already privacy-safe (aggregate only, per the explicit "never an individual's application list" rule already in CLAUDE.md) |
| US-59/US-60 (P2, but worth noting) | Home's "Recommended actions," Career Resources' tracker-driven recommendations already prototype this pattern |

None of this is wasted effort even though it's "just mock data" — it's
the spec. The real backend's job is to make these screens true instead
of scripted, not to redesign them.

### 8.2 Full story classification

Format: **P-level** — one-line technical requirement — depends on —
mock-data-feasible? — needs a real authorized source?

**1. Source Management**
- US-01 **P0** — `Source` table CRUD (id, type, config JSON, enabled) — depends on nothing — mock: yes — real source: no
- US-02 **P0** — compliance fields on `Source` (already spec'd in §3.7) + an admin view of them — depends on US-01 — mock: yes — real: no
- US-03 **P0** — toggle `authorization_status`/`enabled`; adapters check it before every fetch — depends on US-01 — mock: yes — real: no

**2. Ingestion**
- US-04 **P1** — adapter interface (fetch → raw record → pipeline entry) — depends on US-01/03, normalization (US-10–13) — mock: yes (a fake adapter proves the interface) — real: only to *validate* it, in Stage 3
- US-05 **P1** — retry policy + failure log + "Potentially expired" transition, never delete on fetch failure — depends on US-04, US-22 — mock: yes
- US-06 **P0** — provenance fields on `Job` (source, source_job_id, source_url, first/last seen, last verified) — depends on nothing — mock: yes — real: no

**3. Manual / UC Submission**
- US-07 **P0** — *(frontend done, see 8.1)* — submission → raw `Job` record, `source_type = member` — depends on US-01 — mock: yes
- US-08 **P0** — *(frontend done, see 8.1)* — needs real persistence behind the existing queue UI — depends on US-07 — mock: yes
- US-09 **P0** — run the dedup pipeline (US-16/17) on every submission before it reaches the review queue — depends on US-16/17 — mock: yes

**4. Normalization**
- US-10 **P0** — title → taxonomy lookup, rule-based first (§3.2) — depends on taxonomy tables — mock: yes
- US-11 **P0** — location string parsing/normalization — depends on taxonomy tables — mock: yes
- US-12 **P1** — compensation regex parser (`$35–45/hr` → structured) — mock: yes
- US-13 **P0** — industry/function/employment-type classification — depends on taxonomy tables — mock: yes

**5. Data Quality**
- US-14 **P0** — validation ruleset at ingestion (required fields, URL reachability, known source) — depends on US-06 — mock: yes (URL-health check is meaningful even against fake URLs in a synthetic set)
- US-15 **P1** — composite quality score (§3.5) — depends on US-14, source-reliability history — mock: yes

**6. Duplicate Detection**
- US-16 **P0** — canonical-URL / `source_job_id` exact match — mock: yes
- US-17 **P0** — multi-signal near-duplicate scoring (§3.3) — depends on US-10/11 (needs normalized fields to compare fairly) — mock: yes
- US-18 **P0** — 70–89 confidence band → review queue (same queue as US-08, "merge" as a new action) — depends on US-17 — mock: yes
- US-19 **P1** — merge operation: keep best field per source, **retain every contributing source in provenance** (not collapse to one) — depends on US-18 — mock: yes — *(see 8.3 below — this one changes the data model slightly)*

**7. Freshness & Expiration**
- US-20 **P0** — expiration state machine (§3.4) — mock: yes
- US-21 **P0** — *(frontend done, see 8.1)* — needs deadline field to persist real — mock: yes
- US-22 **P1** — "Potentially expired" flag after N failed re-verifications — depends on US-20 — mock: yes
- US-23 **P1** — archive transition, excluded from active search, retained for history — depends on US-20 — mock: yes

**8. Enrichment**
- US-24 **P0** — industry classification (part of US-13's taxonomy work) — mock: yes
- US-25 **P0** — function classification (same) — mock: yes
- US-26 **P1** — skill extraction from description text — depends on a source actually permitting description storage (copyright note, Part 2) — mock: yes with synthetic descriptions — real: extraction quality only provable against real postings later
- US-27 **P0** — grad-year/degree/experience eligibility parsing — feeds US-33's hard-constraint filter — mock: yes
- US-28 **P0** — `classification_method` (fact/rule/llm) surfaced in the UI as a "employer-stated" vs. "our estimate" badge — depends on every enrichment story tagging its own method — mock: yes

**9. Member Profiles**
- US-29 **P0** — *(frontend done, see 8.1)* — depends on nothing — mock: yes
- US-30 **P0** — *(frontend done, see 8.1)* — mock: yes
- US-31 **P0** — grad year must become a **hard filter**, not the soft signal it is today in the prototype's match checklist — depends on US-29 — mock: yes

**10. Job–Member Matching**
- US-32 **P0** — scoring engine per §3.9 — depends on US-29/31, US-24/25/27 — mock: yes
- US-33 **P0** — filter-then-rank split (hard constraints remove, soft preferences score) — depends on US-32 — mock: yes
- US-34 **P0** — *(frontend done, see 8.1)* — needs a real score behind the existing checklist UI — depends on US-32 — mock: yes

**11. Search**
- US-35 **P0** — *(frontend done, see 8.1)* — needs Postgres FTS behind it (§3.8) — mock: yes
- US-36 **P0** — *(frontend done, see 8.1)* — needs a real filtered query — mock: yes
- US-37 **P0** — *(frontend done, see 8.1)* — mock: yes
- US-38 **P2** — NL query → structured filter object; keyword-extraction first, LLM fallback only on what that can't map — depends on US-35/36 — mock: yes eventually, explicitly deferred
- US-39 **P1** — persist a named filter set per member — depends on US-36 — mock: yes

**12. Ranking**
- US-40 **P0** — weighted ranking formula (§3.9) — depends on US-32 — mock: yes
- US-41 **P1** — freshness term in the formula — depends on US-40, US-20 — mock: yes
- US-42 **P1** — UC-relevance term, reads from the CRM boundary (§3.6) — depends on US-40, US-44 — mock: yes (mocked CRM data, exactly as today)
- US-43 **P1** — anti-domination cap (§3.9 already specifies "max N per company in top 20") — depends on US-40 — mock: yes

**13. UC-Specific Intelligence**
- US-44 **P0** — *(frontend done, see 8.1)* — needs the real CRM read API in place of `peopleAt()` eventually; mocked data is fine through MVP — mock: yes
- US-45 **P0** — *(frontend done, see 8.1)* — mock: yes
- US-46 **P1** — *(frontend done, see 8.1)* — mock: yes

**14. Job Detail Page**
- US-47 through US-50 — **all P0**, all *(frontend done, see 8.1)* — the only backend work is pointing the existing page at real data instead of `mockJobs.js`/`localStorage`

**15. Analytics / Administration**
- US-51 **P1** — source-health admin panel — depends on US-05 — mock: yes
- US-52 **P1** — job-quality admin panel (broken links, low scores, pending duplicates) — depends on US-14/15/18 — mock: yes
- US-53 **P1** — *(frontend done, see 8.1)* — needs a real aggregate query behind it, same privacy rule already in place (aggregate only, never an individual's list) — mock: yes

**16. Compliance & Safety**
- US-54 **P0** — same as US-06, restated as a compliance requirement — mock: yes
- US-55 **P0** — source-registry gate (§3.7) blocks disabled/unapproved sources from the pipeline entirely — depends on US-01/02/03 — mock: yes
- US-56 **P0** — **needs an actual enforcement point, not just a recorded field** — see 8.3 — depends on US-02 — mock: yes
- US-57 **P0** — `Requires review` blocks ingestion by default (§3.7); duplicate review queue (US-18) and submission review queue (US-08) are the two other "send to a human" paths — mock: yes

**17. Future / Advanced (explicitly not MVP, per your instruction)**
- US-58 **P2** — personalized continuous feed — depends on US-32/40
- US-59 **P2** — next-recommended-action — pattern already prototyped on Home, see 8.1
- US-60 **P2** — interview-prep recommendation — pattern already prototyped on Career Resources, see 8.1
- US-61 **P2** — job-trend insights over time — depends on historical data existing (needs Stage 2+ running for a while first, not just an engineering dependency)

### 8.3 Two things this pass found that Part 3 didn't fully cover

1. **US-19 (merge) breaks the "one `source_id` per job" assumption** in
   §3.1's schema. A merged record needs a `contributing_sources: []`
   list, not a single `source_id` — otherwise merging silently drops
   provenance for every source except the one that "won." This also has
   a compliance angle: if one contributing source restricts
   redistribution and another doesn't, **the merged record must follow
   the most restrictive applicable source**, not the least — a merge
   can't be used to launder a restriction away. Small schema change,
   worth making before Stage 1 rather than retrofitting after merges
   exist.
2. **US-56 needs an enforcement mechanism, not just a database column.**
   §3.7 already records `storage_restrictions` per source, but nothing
   in Part 3 actually *checks* it. Concretely: the normalization/write
   layer should refuse to persist fields a source's restrictions
   disallow (e.g. full description text) rather than relying on every
   future adapter author to remember to honor the flag. This is the
   difference between "we wrote it down" and "the system can't violate
   it by accident" — worth being the literal last gate before any
   `INSERT`, not documentation.

### 8.4 New/refined privacy note from this pass

US-38's natural-language search, if it ever calls an LLM to parse a
query, should send **only the query text** — never the member's profile,
preferences, or identity alongside it. Keep that call stateless and
anonymized even though it's a low-stakes feature; no reason to widen the
data-sharing surface for a P2 convenience layer. Everything else in this
batch (US-26 skill extraction, US-53 aggregate analytics) is already
covered by rules established in Part 2/3.6/6 — reaffirmed, not new.

### 8.5 Minimum viable architecture — confirmed, now story-anchored

Part 5's MVP list already matches what this pass independently arrives
at. Restated as a build order, anchored to story IDs, with the "frontend
already exists" reality from 8.1 factored in:

```text
1. Postgres schema: Job (+ contributing_sources per 8.3), Source,
   DuplicateReviewQueue, taxonomy tables.
   Covers: US-01, 02, 03, 06, 54, 55, 56, 57

2. Manual pipeline end-to-end against the real DB:
   submit → validate (14) → normalize (10,11,13) → dedup (16,17,18,9)
   → enrich (24,25,27,28) → review queue (8) → approve → active job
   (20,21). Admin/Member submission is the only source enabled.
   Covers: US-07 through 28 except 12/15/19/22/23/26 (P1, follow-on)

3. Point the existing frontend at the real API instead of mock data:
   search/filter/sort (35,36,37), matching/ranking (29-34, 40),
   job detail actions (47-50). This is almost entirely "swap the data
   source," not new UI, per 8.1.

4. Admin monitoring: extend the existing Admin Dashboard with source
   health (51) and job quality (52) panels; real aggregate query behind
   the member-behavior stats it already shows (53).

5. Only after 1-4 are proven: first automated source pilot (04, 05),
   one employer ATS adapter, individually verified — deliberately last,
   since it's the highest-risk and highest-effort piece and shouldn't
   be what the rest of the system gets validated against.
```

Everything marked P1/P2 above (12, 15, 19, 22, 23, 26, 38, 39, 41-43, 46
[already done frontend-wise], 51-53, 58-61) is real and worth building,
just after step 5 proves the foundation is solid — same reasoning as
Part 5's original cut list.

Still nothing implemented. This supersedes none of Parts 1–7 — it's the
same architecture, now checked against a much more detailed backlog and
adjusted in the two places (8.3) it actually needed to change.
