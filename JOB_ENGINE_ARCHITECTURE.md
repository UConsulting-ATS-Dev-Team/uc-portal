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

                 Second addition: 6 more companies on the same Greenhouse
                 mechanism already vetted for Stripe -- Databricks, Coinbase,
                 Airbnb, Brex, Figma, Robinhood. Generalized the one-company
                 fetch-greenhouse-stripe into a config-driven
                 fetch-greenhouse-companies that reads {platform, slug,
                 company} per row from sources.config jsonb, so adding a
                 company is now a migration insert, not a new Edge Function.
                 Candidates were sourced with scripts/check-company-source.mjs
                 against a broader list (Notion, DoorDash, Plaid, Ramp,
                 Oliver Wyman, L.E.K., Evercore, Moelis among them); the same
                 company-identity verification that caught "Bohen Consulting
                 Group" squatting the "bcg" slug (Stage 3) caught "Oliver
                 Wyman Labs" here -- a real but different company on a
                 similar-sounding Lever slug -- and excluded it before it
                 was ever added.

                 This expansion surfaced a chain of four real bugs, each
                 only visible once the previous was fixed:

                 (1) O(n^2) redundancy -- scoreDuplicate() re-tokenized the
                 same new job's title from scratch on every one of N
                 comparisons in the per-company dedup loop. Fixed with a
                 module-level tokenize() memo cache (both server/src/
                 dedupe.ts and the Edge Function's ported copy).

                 (2) Even memoized, Databricks alone (820 postings, 0
                 pre-existing) still tripped Supabase's Edge Function
                 compute limit -- jaccardSimilarity()'s own per-comparison
                 Set operations are real O(n^2) cost at that scale, not just
                 avoidable redundancy. Fixed structurally with
                 MAX_NEW_JOBS_PER_RUN (150): brand-new postings beyond the
                 cap are marked "deferred" (seen, not fully processed) and
                 picked up on the next invocation -- safe because the
                 adapter's insert/update path is already idempotent, so a
                 large first backfill just completes over several runs
                 instead of one.

                 (3) A batched refresh-timestamp update against ~600
                 already-tracked Databricks jobs failed with "Bad Request"
                 -- PostgREST encodes .in() filters into the request URL,
                 which has a real length limit. Fixed with
                 updateInBatches(), chunking any ID-list update into groups
                 of 200.

                 (4) The deepest one: intermittent "duplicate key value
                 violates ... job_sources_source_id_source_job_id_key"
                 errors on job_sources inserts. First mitigation --
                 switching to .upsert(..., { ignoreDuplicates: true }) --
                 was wrong: it silenced the error without fixing the cause,
                 which let real corruption accumulate silently (orphaned
                 duplicate jobs rows, no error surfaced, every run). Root
                 cause, found by comparing Coinbase's job_sources count
                 (173, correct) against its jobs count (293, ~120 orphans)
                 directly: a plain .select() on jobs/job_sources silently
                 truncates at PostgREST's default 1000-row page once
                 combined volume across all 7 companies passed that mark,
                 so the adapter's own existingJobIdBySourceJobId map was
                 missing entries for jobs that genuinely already had a
                 job_sources row -- every run that hit this re-processed
                 those jobs as "new." Real fix: fetchAllRows(), a
                 .range()-paginated wrapper used for every potentially-large
                 lookup, plus reverting job_sources back to a plain
                 .insert() -- a genuine constraint conflict should fail
                 loudly, not be swallowed the same way it was already
                 masking this bug. Databricks, Coinbase, Airbnb, and Brex
                 (all four confirmed corrupted; Figma/Robinhood/Stripe
                 confirmed clean throughout) were wiped and cleanly
                 re-backfilled from scratch under the fixed code, then
                 re-verified: identical counts to the first clean attempt,
                 and previously-inserted jobs correctly took the
                 "refreshed" path on the next run instead of being
                 reprocessed as new.

                 fetchAllRows() was then moved out of
                 fetch-greenhouse-companies and into the shared
                 _shared/dedupeHelpers.ts, because approve-submission and
                 fetch-deloitte-jobs turned out to have the exact same
                 unbounded .select() against jobs/job_sources -- a latent
                 version of the same bug, not yet triggered only because
                 nothing had pushed total active jobs past 1000 until this
                 expansion did. Both were switched to the shared paginated
                 helper and redeployed; each re-verified against live data
                 afterward (approve-submission's dedup check now genuinely
                 scans every active job again; fetch-deloitte-jobs still
                 shows a clean 47 refreshed / 0 inserted on rerun).

                 Verified end-to-end: all 7 Greenhouse sources run together
                 in one invocation (the actual daily-cron path) with every
                 source reporting deferred:0 and zero job_sources conflicts
                 -- Stripe 578, Databricks 820, Coinbase 173, Airbnb 189,
                 Brex 294, Figma 162, Robinhood 130 postings, all correctly
                 recognized as already-tracked rather than reinserted. The
                 superseded fetch-greenhouse-stripe Edge Function and its
                 cron entry were removed once fetch-greenhouse-companies
                 (which also covers Stripe via the same config row) took
                 over.

                 Third addition: no new source, but two follow-on fixes the
                 6-company expansion exposed as live, user-facing problems,
                 not just ingestion-pipeline ones.

                 (1) pages/Jobs.jsx and pages/SourceManagement.jsx had the
                 exact same unbounded .select() pagination bug as the
                 ingestion pipeline (see the second addition above) --
                 confirmed live: the real Jobs board was silently showing
                 only ~1000 of 2,384 active jobs, an arbitrary Postgres-
                 default-ordered slice with no error surfaced to members,
                 and the admin Source Management page was undercounting
                 active-jobs-per-source for exactly the sources with the
                 most jobs. Fixed with the same fetchAllRows() pattern,
                 ported to the frontend (data/fetchAllRows.js) since the
                 Edge Function version lives in a different runtime/module
                 graph. Confirmed fixed live: the board's count went from
                 capped to the correct 2,384 immediately after the fix.

                 (2) A member correctly pointed out that Databricks alone
                 (820 postings) dominating the board while MBB/Goldman have
                 zero isn't a capacity problem (Postgres handles millions of
                 rows trivially -- this is what LinkedIn/Handshake actually
                 do) but a relevance one: Greenhouse returns a company's
                 *entire* public board, not just entry-level roles, so most
                 of what a large tech employer returns is senior/management
                 positions no UC undergrad would apply to. Two-part fix,
                 not one -- a title filter alone still leaves a lot of
                 volume, and a display cap alone still wastes ingestion
                 compute on roles that will never be shown:
                   - _shared/pipeline/relevance.ts's isLikelySeniorRole(): a
                     conservative denylist (senior/staff/principal/director/
                     vp/chief/etc.), not an allowlist, so an ambiguous
                     title (no seniority marker either way) is kept rather
                     than dropped -- the same asymmetry as the odds model's
                     sparse-data handling. Applied in both
                     fetch-greenhouse-companies and fetch-deloitte-jobs,
                     gating brand-new postings only (forward-looking, not
                     retroactive -- see below).
                   - pages/Jobs.jsx caps how many cards from one company can
                     appear in the results at once (3), computed after
                     sorting so the cap keeps each company's best matches;
                     the rest surface via a "View N more at Company" link
                     that narrows the existing keyword filter to that
                     company rather than linking to a company profile page
                     that may not exist for it. The cap is skipped once a
                     keyword search is active, otherwise "view more" would
                     re-cap on top of itself and never show more than 3.
                   - A real dry-run against live data (computed in-browser
                     against the actual jobs table) found the title filter
                     alone would exclude 1,018 of 2,374 currently-active
                     postings (43%) if applied retroactively -- substantial,
                     but 1,356 would still remain, confirming the display
                     cap is a genuinely separate fix, not redundant with the
                     filter. Retroactive cleanup was raised as an explicit
                     decision rather than auto-deleted -- unlike the demo-
                     job/test-row cleanups below, these are real fetched
                     postings, and the exact denylist boundary is a
                     judgment call. Decision: clean up now (migration
                     20260824120000). Job IDs were computed client-side
                     using the exact same regex as the deployed
                     isLikelySeniorRole(), rather than reimplemented in
                     Postgres' own regex dialect (word-boundary syntax
                     differs: `\y` vs `\b`) and risking a mismatch between
                     what was reviewed and what actually got deleted.
                     Verified: active job count went from 2,373 to 1,355,
                     an exact match.

                 Separately, verifying the "no live feed" panel (a UC-wide
                 feature request, not Stage-4-specific -- see this doc's own
                 change history for that write-up) surfaced two stale-data
                 problems worth recording here since both lived in the real
                 `jobs` table this stage's adapters write to: a Stage 2 demo
                 seed migration (20260821190000) had inserted 10 mock jobs
                 for Bain/McKinsey/Deloitte/Stripe/Goldman/BCG/EY-Parthenon/
                 Accenture directly into the real table with placeholder
                 example.com URLs and no job_sources link, which made the
                 six companies with no real automated source (Bain,
                 McKinsey, Goldman Sachs, BCG, EY-Parthenon, Accenture)
                 incorrectly appear to have a live feed; and a single stray
                 "Test Company Inc" row from earlier approve-submission
                 testing. Both cleaned up via migration (20260824100000,
                 20260824110000) now that real search/sourcing no longer
                 needs synthetic data to prove itself against.

                 Fourth addition: two more companies (IMC Trading, Charlie
                 Health), sourced differently than every prior addition --
                 by cross-referencing scripts/check-company-source.mjs
                 against the *real* UC alumni-by-company counts (data/
                 realPeople.js, the real CRM import from Stage 5) instead
                 of another guessed candidate list. Every consulting/IB/PE
                 firm actually checked this pass (L.E.K. Consulting, FTI
                 Consulting, KPMG, PwC, Lazard, Nous Group, Cornerstone
                 Research, Huron Consulting, Morgan Stanley, Deutsche Bank,
                 JP Morgan, Barclays) came back with no usable public
                 board -- confirms the pattern already found for the 6
                 "no live feed" companies extends to established
                 consulting/banking firms generally, not just those 6.
                 IMC Trading (prop trading/quant finance, real UC alumnus
                 on record) and Charlie Health (mental-health provider,
                 maps to the Healthcare interest category) were the two
                 real hits, added via migration 20260824210000 onto the
                 same config-driven mechanism as the second addition
                 above.

                 One real bug caught on first invocation: IMC Trading's
                 source config used `company: "IMC Trading"` (the natural
                 display name), but the adapter's company-name-mismatch
                 safeguard -- the same check that caught "bcg" being a
                 squatted slug in Stage 3 -- compares each posting's own
                 company_name field with a case-insensitive *exact* match,
                 not substring, and Greenhouse's actual field for this
                 board is the short form "IMC". Result: all 166 fetched
                 postings rejected as a mismatch, 0 inserted, on the first
                 run. Fixed via a follow-up migration (20260824220000)
                 changing only the match value to "IMC" -- safe here
                 specifically because identity was already independently
                 confirmed (a posting's own location field spells out
                 "IMC Trading", and the live office list -- Chicago, Zug,
                 Sydney, London -- matches IMC Trading's real offices)
                 before the source was ever added, not a case of trusting
                 a short name at face value. Charlie Health's company_name
                 matched exactly on the first try.

                 Verified end-to-end same as every prior addition: first
                 invocation after the fix correctly inserted (158 IMC, 140
                 Charlie Health, hitting the 150-per-run cap and correctly
                 deferring the rest), a second invocation drained the
                 remainder (deferred: 0 for both), and a third invocation
                 confirmed idempotency (0 inserted, 158/261 refreshed, 0
                 company mismatches). Noted honestly rather than silently:
                 roughly half of Charlie Health's 281 postings are
                 clinical/care-delivery roles (Care Coach, Crisis
                 Intervention Specialist, licensed-clinician positions) no
                 business-track UC member would apply to, but a real,
                 non-trivial slice (Commercial Strategy Associate/Manager,
                 several Growth Strategy Analyst variants, Director of
                 Revenue Operations, Director of Admissions Strategy) are
                 genuinely relevant -- the same "some of this board is
                 relevant, most isn't" situation the senior-role denylist
                 and per-company display cap already exist to handle for
                 every high-volume source, so it didn't need special-
                 casing.

                 **Superseded 2026-08-25** -- see this doc's dated entry
                 below ("isLikelyNonCorporateRole() -- manual trade + direct
                 clinical/patient-care denylist"). The user explicitly
                 rescoped UC Portal to white-collar corporate roles only
                 (finance/consulting/tech/IB/general corporate-office), so
                 "didn't need special-casing" is no longer the right call --
                 Charlie Health's clinical/care-delivery half (Care Coach,
                 Crisis Intervention Specialist, licensed-clinician
                 positions, etc.) is now filtered out by the same mechanism
                 as Carvana's manual-trade half, both retroactively (81 of
                 Charlie Health's 251 active postings removed) and at
                 ingestion going forward. Also surfaced a new job.type value ("Part-time",
                 from Charlie Health's part-time clinical postings) that
                 pages/Jobs.jsx's Opportunity Type filter picked up
                 automatically, since that filter's checkboxes are already
                 generated from whatever types exist in the live data
                 rather than a hardcoded list.

                 Fifth addition: two more companies (Carvana, Guild),
                 sourced the same way as the Fourth addition above --
                 ranking real UC alumni-by-company counts (the `people`
                 table) descending and cross-referencing each against
                 scripts/check-company-source.mjs -- run a cycle later
                 against the live data rather than a fresh guessed list.
                 Checked this pass, skipping everything already live or
                 already rejected: Microsoft, NASA JPL, Visa, Ares
                 Management, Disney, Meta, PIMCO, Google, Amazon, Apple,
                 Capital One, Cisco, Intel, PayPal, KKR, Sequoia Capital,
                 Boeing, CBRE, Aon, BDO, Indeed, Guild Education, Standard
                 Chartered -- plus a fresh re-check of the five candidates
                 this doc had flagged as sourced-but-never-confirmed
                 (Notion, Plaid, Ramp, Evercore, Moelis). All but two came
                 back with no usable board: Microsoft/Meta/Visa/Intel/
                 Boeing/NASA JPL/Moelis carry only a Workday hint, the
                 same non-buildable signal already documented for
                 Accenture; Disney's Greenhouse slug ("disney") resolves
                 to an unrelated company ("Sgt. Pepper's Lonely Hearts
                 Club Band") -- the same slug-squatting pattern already
                 caught for "bcg" (Stage 3) and "Oliver Wyman Labs"
                 (Stage 4); Indeed's Greenhouse slug is real but reports 0
                 postings, and Plaid's Lever slug is likewise real but
                 empty -- neither is a usable source regardless of
                 authenticity; Capital One's Lever slug ("capital")
                 resolves to 41 real postings, but sampling the actual
                 job data (offices in Limassol/Cyprus, Sofia/Bulgaria,
                 Warsaw/Poland, Dubai, Nassau/Bahamas; roles like "Back
                 Office Payments and AML Officer (Crypto Operations)")
                 makes clear this is an unrelated crypto/CFD trading
                 company, not the real, US-only Capital One -- another
                 slug collision, caught the same way as Disney's above;
                 and Ares Management, PIMCO, Google, Amazon, Apple,
                 Cisco, PayPal, KKR, Sequoia Capital, CBRE, Aon, BDO,
                 DoorDash, Notion, Ramp, Evercore, and Standard Chartered
                 had no checkable signal at all.

                 Carvana (real used-car retailer, NYSE: CVNA, one real UC
                 alumnus on record): Greenhouse slug "carvana", 1,698
                 postings, company_name "Carvana" on every posting, and
                 every sampled application URL resolves to Carvana's own
                 domain (carvana.com/careers/apply?gh_jid=...) --
                 confirmed identity, not just a slug match. Guild (real
                 workforce-education/tuition-benefits company, one real
                 UC alumnus on record under its former name "Guild
                 Education" -- the company itself rebranded to "Guild" in
                 2023, which is why the source research started from the
                 older name but the source config uses the new one, same
                 as it must to satisfy the adapter's own company-name
                 safeguard): Greenhouse slug "guild", 5 postings,
                 company_name "Guild" on every posting, and sampled
                 application URLs resolve to
                 guild.com/open-positions-at-guild. Both added via
                 migration 20260825100000, using "Guild" (not "Guild
                 Education") as the config's match value to agree with
                 Greenhouse's actual field -- the same IMC-Trading lesson
                 (20260824220000) applied proactively this time instead
                 of needing a follow-up fix.

                 Both backfilled and verified the same way as every prior
                 addition: Carvana's first run hit MAX_NEW_JOBS_PER_RUN
                 and deferred the rest (145 inserted, 1,478 deferred);
                 one of the later drain runs failed outright with a real
                 job_sources unique-constraint violation -- a clean, loud
                 failure (no silent swallowing) rather than the masked
                 corruption Stage 4's chain-of-four bugs originally found
                 for Databricks/Coinbase/Airbnb/Brex, consistent with
                 that fix still holding. Verified directly against
                 Postgres rather than assumed: 0 orphaned jobs rows (a
                 job with no job_sources link) for Carvana after the
                 failed run, and job_sources row count (1,628) exactly
                 equals fetched minus filtered (1,698 - 70
                 skippedNotRelevant), so nothing was lost or duplicated
                 by the failure. Continuing to drain fully cleared it
                 (deferred: 0, 1,628 refreshed on the next call, 0
                 company mismatches). Guild's small 5-posting board
                 completed in one run (2 inserted, 3 filtered as
                 senior-role noise -- "VP, Software Engineering" among
                 them) and was idempotent immediately. A final combined
                 invocation of all 10 Greenhouse sources together (the
                 real daily-cron path) confirmed every source, old and
                 new, reports deferred: 0 and 0 conflicts in the same
                 run; server test suite (44 tests) still green throughout
                 since nothing in the shared pipeline changed.

Stage 5 (started) LLM-assisted classification fallback for the long tail;
                 natural-language search (deterministic layer done, see
                 "Fifth piece" below -- an LLM-parse fallback for queries
                 it can't confidently map is still open, same as the
                 classification item above); ranking-weight tuning from
                 real engagement data; real CRM integration replacing the
                 mocked alumni/connection data (done, see below).

                 First piece: real member/alumni data replacing data/
                 mockPeople.js's 13 fictional people as the primary
                 Network/Member-profile source. Source: the club's own
                 "UConsulting Directory" Google Sheet (Drive, read-only
                 access) -- its Active + Alumni tabs specifically; the
                 sheet's other 3 tabs are stale duplicates from earlier
                 schema migrations the club went through and were excluded
                 by direct instruction. One-time snapshot import (not a
                 live sync -- re-running later, e.g. once pre-2020 alumni
                 get added to the sheet, means asking for another import,
                 not new infrastructure), 150 real people (46 active + 104
                 alumni) into a new `people` table, RLS-gated the same as
                 jobs/industries/job_functions (authenticated members only,
                 not the public anon role -- appropriate for real names and
                 emails).

                 Only fields with an actual product use case were
                 extracted: name, status, class year (alumni: from
                 graduating/admitted class text; active members: no fixed
                 grad year exists in the sheet, left null rather than
                 guessed), major, company, role/committee position,
                 LinkedIn, email, mentor. Phone numbers and Venmo handles
                 exist in the source sheet but have no current or planned
                 feature that needs them and are meaningfully more
                 sensitive than the rest -- deliberately never extracted,
                 not just hidden by RLS. openToCoffeeChats and
                 mutualConnections default to false/0 for every real
                 person rather than fabricating a specific consent or
                 relationship claim about someone real.

                 The real "company" text (however each person typed it in
                 -- "Bain", "Bain & Co", "Deloitte Human Capital") doesn't
                 match data/mockCompanies.js's canonical names ("Bain &
                 Company", "Goldman Sachs"), so CompanyPage's people-at-
                 company lookup matches on the canonical name's first
                 token as a starts-with pattern rather than requiring an
                 exact match (data/realPeople.js's companyMatchToken()) --
                 confirmed necessary live: an exact match returned 0 alumni
                 for every one of the 8 companies until this was added.

                 The harder problem than the fetch: MemberProfile.jsx's
                 rich sections (Experience with specific invented date
                 ranges, Education with a randomly-picked major, a
                 "Happy to help with" checklist, Contributions stats) are
                 all synthetically generated per data/peopleUtils.js for
                 the fictional mock people -- appropriate for 13 characters
                 explicitly documented as fictional, not appropriate to
                 render for a real, named person (inventing a specific
                 employment history or a consent checklist someone never
                 provided). Rather than thread isReal conditionals through
                 that component, real people get their own
                 RealMemberProfile.jsx -- shows only fields that trace
                 directly to the source spreadsheet, says so explicitly
                 when something isn't known instead of inventing it. Same
                 dispatch pattern as JobDetail.jsx/RealJobDetail.jsx:
                 MemberProfile.jsx checks whether the id is a UUID (real)
                 or a mock slug like "sana-liu", same
                 network-card-level fix applied to Network.jsx (skips
                 peopleUtils.js's capabilitiesFor() chips for real people,
                 same fabrication concern).

                 Real PII handling: the data-loading migration was
                 deliberately never committed to this repo, unlike every
                 other migration this session -- applied directly via
                 `supabase db push` then removed locally (with `supabase
                 migration repair --status reverted` to keep the remote
                 ledger consistent with local files afterward). A committed
                 SQL file with 150 real names/emails/majors/mentors would
                 become permanent, widely-readable git history the moment
                 this repo gets a remote, in a way the database itself
                 (behind RLS) isn't -- an explicit decision, not an
                 oversight, given this repo has no settled hosting plan
                 yet. The table schema and grants (no PII) are committed
                 normally.

                 Second piece, same day: RealJobDetail.jsx (the page real
                 job postings actually use, 1,355 of them) got a "UC
                 members at {company}" rail -- previously had none at all
                 (a genuinely new capability this data enables, not a
                 swap), where the mock JobDetail.jsx has always had one.
                 Same starts-with company-name matching as CompanyPage's
                 (data/realPeople.js's fetchRealPeopleAtCompany() -- one
                 shared function, not reimplemented per caller), plus a
                 "See {company}'s full company page" link that only
                 renders when a matching data/mockCompanies.js entry
                 actually exists (Stripe, Deloitte) -- the 6 companies with
                 no company-page entry (Databricks, Coinbase, Airbnb, Brex,
                 Figma, Robinhood) correctly show real people with no dead
                 link. Verified live against a real Deloitte posting (3
                 real names shown, "See all 10 UC members") and a real
                 Databricks one (honest "No UC members on record... yet",
                 no crash, no company-page link).

                 Both since closed: JobDetail.jsx's (the mock-job-only
                 page) own people rail now uses fetchRealPeopleAtCompany()
                 too (a mock job at Bain shows the same 5 real alumni the
                 real pages do), and Global Search's people results now
                 come from searchRealPeople() (data/realPeople.js) instead
                 of the mock roster -- both were the last surfaces still
                 showing fictional people after the rest of this stage
                 went real.

                 Third piece: the Applications tracker itself, the last
                 core surface still fully local-only after jobs and people
                 both went real. `trackedJobs`/`prepLogged`/
                 `timelineShiftDays` (data/store.jsx) previously lived only
                 in localStorage -- lost on a new device, invisible to
                 anything server-side. New `tracked_applications` table (one
                 row per member+job, not per member -- a member tracks many
                 applications, member_preferences' one-row-per-member shape
                 doesn't fit here), RLS'd to `member_id = auth.uid()` with
                 deliberately no `is_admin()` bypass -- CLAUDE.md's Admin
                 Dashboard section is explicit that admins see aggregate
                 recruiting data only, never an individual's own
                 application list, and this table is exactly the data that
                 boundary protects.

                 Same background-sync shape memberPreferencesSync.js
                 already established for preferences (data/trackerSync.js):
                 local state stays authoritative for rendering (so the
                 Board's drag-and-drop and the Timeline's drag-to-reschedule
                 stay instant, no round-trip before the UI updates), a
                 one-time hydration fetch on mount, and a fire-and-forget
                 upsert on every mutation. Two differences from the
                 preferences version, both because this data is per-
                 application rather than one blob: hydration *merges*
                 remote into local rather than replacing it (so the seeded
                 demo applications -- SEED_TRACKED_JOBS, never themselves
                 synced -- survive for a member with no real tracked
                 applications yet, and so a mutation made in the brief
                 window before hydration resolves can't be wiped by it
                 landing afterward); and each of the four mutation
                 functions (addToTracker/updateApplicationStage/logPrep/
                 shiftTimeline) computes the complete post-update record
                 into a closure variable *inside* the setState updater, then
                 fires the actual sync call *after* setState returns rather
                 than from inside the updater -- an updater is supposed to
                 be pure, and calling a network side effect from inside one
                 would fire twice under StrictMode's double-invoke.

                 Verified live end-to-end (real authenticated test session):
                 logging prep time on an already-tracked seeded application
                 wrote a complete real row (correct member_id, correct
                 stage_history carried over from the seed even though the
                 seed itself was never synced -- confirming "interacting
                 with a demo item makes it real from that point" works as
                 designed); adding a previously-untracked job created a
                 second row correctly; clearing localStorage entirely and
                 reloading correctly restored the real prep hours from
                 Supabase while the merge preserved all 6 still-unsynced
                 seed applications alongside it (7 tracked, as before).
                 Test rows deleted afterward. Not verified live: the Board's
                 drag-and-drop and Timeline's drag-to-reschedule paths
                 specifically -- this session's browser pane couldn't
                 composite for a real mouse drag, and (matching this
                 project's own prior note that synthetic events are
                 unreliable for this Board) dispatched DragEvents didn't
                 reach the React handler either. updateApplicationStage()
                 and shiftTimeline() use the identical closure-then-sync
                 pattern already proven correct by the other two functions,
                 so this is a real but narrow gap in interactive
                 verification, not an untested code path.

                 Fourth piece, same day: the three remaining local-only
                 pieces of data/store.jsx -- savedConnections/
                 coffeeChatStatus (Network) and savedJobIds (Jobs board).
                 Same background-sync shape again, two tables this time:
                 network_connections (one row per member+person, folding
                 "did I save them" and "my coffee-chat status with them"
                 together -- both are just "this member's relationship to
                 that person," same reasoning that folded trackedJobs/
                 prepLogged/timelineShiftDays into one tracked_applications
                 row) and saved_jobs (member+job, presence-only -- insert on
                 save, delete on unsave, no update column needed since
                 there's nothing else to carry per saved job).

                 Two real bugs found and fixed while verifying live, both
                 the same root cause class as 20260824150000_people_grants.sql
                 found for the people table earlier this session -- RLS
                 alone doesn't grant table-level access, Postgres still
                 needs the underlying GRANT, and this time upsert()
                 specifically needs both an UPDATE grant *and* a matching
                 UPDATE policy for its ON CONFLICT DO UPDATE path, even on
                 a table (saved_jobs) that conceptually never updates a row
                 once written -- the original migration had reasoned "no
                 update semantics needed" and omitted both, which was true
                 for the table's actual data shape but not for how upsert()
                 is implemented under the hood. Fixed via a follow-up
                 migration (20260824190000) adding both.

                 Verified live end-to-end (real authenticated test session,
                 test rows deleted afterward via migration since the app
                 itself is never granted DELETE on network_connections --
                 intentional, it never needs to remove a row, only
                 upsert): toggleSavedJob's save path wrote a correct row;
                 its unsave path, once properly isolated from a test-
                 methodology mistake (clicking a button query that never
                 actually matched an element, so an earlier "it didn't
                 work" result was a false negative, not a real bug) deleted
                 it correctly. requestCoffeeChat and toggleSavedConnection
                 both correctly preserved the *other* field on the same
                 network_connections row when only one changed -- saving a
                 connection, then separately requesting a coffee chat with
                 them, left both `saved: true` and `coffee_chat_status:
                 "Request sent"` on the single row rather than one
                 clobbering the other back to its default. Clearing
                 localStorage and reloading correctly restored both real
                 synced values while the merge preserved the still-unsynced
                 SEED_COFFEE_CHATS entries alongside them.

                 Fifth piece: natural-language search on the Jobs board,
                 per §3.8's own staged plan -- "parse query -> extract
                 known entities into the exact same filter object the UI
                 already produces from clicking chips... start with
                 keyword/pattern extraction; only reach for an LLM parse
                 on queries the extractor can't confidently map." Built
                 exactly that first layer and nothing beyond it yet: a new
                 data/nlSearchParser.js does deterministic synonym-group
                 matching (industry/location/type/deadline phrasings,
                 grad-year both as named synonyms -- "junior" -> 2028 --
                 and a `class of \d{4}` regex capture) against
                 pages/Jobs.jsx's exact filter shape and option lists, so
                 nothing downstream (active-chip rendering, the zero-
                 result diagnostic, matchesFilters itself) needed to
                 change at all -- a parsed query just becomes the same
                 filters object a member clicking chips would produce.
                 Whatever isn't recognized becomes the existing free-text
                 keyword filter rather than being dropped, so an
                 unconfident parse still does something useful; there is
                 no LLM fallback wired in (this prototype has no LLM API
                 configured), so "can't confidently map" here just means
                 "falls through to keyword search," which is an honest
                 outcome, not a stub.

                 One real bug caught by testing multi-entity queries
                 live: term-matching took the first synonym in a group
                 that matched via `\bterm\b`, but a shorter phrase's word
                 boundary still matches when it's embedded in a longer
                 one -- "closing this week" would match on "this week"
                 alone (listed first), stripping only that and leaving
                 "closing" behind as stray leftover keyword text. Fixed by
                 ordering every synonym group's terms longest-phrase-first.
                 Verified live against five real queries against the real
                 jobs table: "consulting internships in Chicago for
                 juniors" correctly extracted all four entities and
                 correctly hit the existing zero-result diagnostic (real
                 Chicago consulting internships for the class of 2028 are
                 genuinely sparse); "tech roles in New York" returned a
                 real Figma posting; "anything at Stripe" (after adding
                 "anything"/"any"/"something" to the stop-word list)
                 correctly reduced to the free-text keyword "Stripe"; the
                 fixed deadline-phrase query above produced a clean
                 three-entity match with no stray leftover; and an empty
                 submission is now a no-op (guarded both by disabling the
                 Search button and an early return in the handler) rather
                 than resetting every filter to neutral for nothing.
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
4. **Match against member-reported skills.** ~~This is the piece that
   makes US-32's matching actually use skill data — requires adding a
   `skills` field to the member profile, which doesn't exist yet~~ **Done**
   — see Part 7's Stage 5 entry (2026-08-24 update) for the build: a
   closed-list Skills picker on My Profile, `skills text[]` on
   `member_preferences`, and `data/jobMatch.js`'s skills factor wired in
   with the real weights.

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
- US-58 **P2** — *(done, see Part 7's dated entry)* — personalized continuous feed — depends on US-32/40
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

**2026-08-24 update — audited this list against the actual live codebase
(Stage 2-5 having since happened) and found a real gap in US-40/41/42/43,
now fixed.** `server/src/rank.ts` has always implemented the real §3.9
weighted formula correctly, tested (`server/tests/rank.test.ts`) -- but it
runs server-side only, and the frontend's own port of it
(`data/jobMatch.js`'s old `rankJobs()`) was **never actually called from
anywhere** (confirmed via a repo-wide grep). `pages/Jobs.jsx`'s "Best
match" sort was instead just `matchScore` (the pure preference-fit
percentage) with no freshness/deadline-urgency/quality/UC-relevance
blended in at all -- so two jobs tied on preference fit (a common case:
most real postings score 0% against any one member's specific industry/
role preferences) sorted in arbitrary insertion order, not by any real
secondary signal.

Fixed by replacing the dead `rankJobs()` with `finalScore()` (data/
jobMatch.js), a faithful per-job port of all six §3.9 terms operating on
the adapted card shape rather than a raw Supabase row (`quality_score`
added to `data/realJobAdapter.js`'s output to make that possible; the
other terms -- `deadlineDate`, `postedDaysAgo`, `company` -- already
existed on the card shape). Wired into `pages/Jobs.jsx`'s `sortJobs()`
"Best match" branch specifically -- `matchScore` itself, and everywhere
it's *displayed* (card badges, the match checklist), is deliberately
untouched, since US-34's "explain the match score" story means that
number should keep meaning exactly "how well this fits your stated
preferences," not a blended ranking score. Text relevance (the 6th term)
reads `filters.keyword` when a search is active rather than a literal
port of rank.ts's own query handling, since Jobs.jsx already has a
*harder* keyword filter (excludes non-matches outright) that rank.ts's
design never assumed existed -- this only differentiates among jobs that
already survived that filter, not a substitute for it. Company anti-
domination (US-43) was left to Jobs.jsx's own existing `capPerCompany()`
rather than porting rank.ts's separate top-20 cap mechanism too, since
both already serve the same goal and Jobs.jsx's version (hard display cap
everywhere) is the one actually in effect.

Verified live: with an active search where most results tie at 0% match
(a real, common case), "Best match" now visibly surfaces the ones with
the most urgent deadlines first, rather than an arbitrary tied order --
confirms the previously-inert deadline/freshness/quality/UC-relevance
terms are now actually affecting sort order. Deadline/Newest sorts
(unrelated code paths) reverified unaffected. All 44 existing tests still
pass, including `rank.test.ts`'s 4 tests against the untouched server-side
formula.

**Same pass, two more real gaps fixed: US-56 (storage-restrictions
enforcement) and US-09 (submission dedup runs after the queue, not
before).**

US-56: `enforceStorageRestrictions()` existed but only `approve-submission`
called it -- confirmed live that `fetch-greenhouse-companies` and
`fetch-deloitte-jobs` never imported it at all, relying purely on each
adapter author remembering never to populate `description`. Fixed by
folding the check *into* `jobInsertFromNormalized()` itself (`_shared/
dedupeHelpers.ts`) -- the one function every adapter already calls to
build its insert row, given a required (not optional) `storageRestrictions`
parameter so a caller can't silently omit it either. Deployed all three
adapters and reverified live: idempotent re-fetch on an already-tracked
source (IMC Trading) still correct, and two genuinely new inserts (2 on
Deloitte, 11 on Stripe) succeeded cleanly through the new required
parameter with no regression.

US-09: confirmed live (empty queue, so no urgent user-facing bug, but a
real structural one) that dedup only ever ran inside `approve-submission`,
at Approve time -- the admin queue itself showed a submission as a plain
new opportunity with no indication it might be a duplicate until *after*
clicking Approve. Fixed with a new Edge Function,
`score-submission-duplicate`, called by `PostOpportunityModal.jsx`
immediately after a member's own insert (fire-and-forget, any
authenticated member may call it but only for their own submission --
ownership re-derived server-side, same principle `requireAdmin.ts`'s
callers already follow). It runs the identical normalize + `scoreDuplicate`
pipeline `approve-submission` does and writes the verdict onto three new
columns on `opportunity_submissions` (`duplicate_tier`,
`duplicate_best_job_id`, `duplicate_best_score`) -- informational for the
queue display only, **not** a replacement for `approve-submission`'s own
dedup check at approval time, which still runs fresh every time since the
active-jobs set can change between submission and review.
`rawJobFromSubmission()`/`SOURCE_NAME_BY_ROLE`/the grad-year-override logic
were extracted from `approve-submission`'s own private copy into a new
`_shared/submissionMapping.ts` so both functions stay in sync by
construction rather than by two authors remembering to update both files
in step -- the exact failure mode US-56 above just came from.

`pages/AdminDashboard.jsx`'s opportunity queue table now shows a
"Likely duplicate of X · N% match" (auto-merge tier) or "Possible
duplicate" (review tier) note under the company name, using the same
batched-lookup enrichment pattern (`loadDuplicates()`) the existing
duplicate-review-queue already uses for the same reason (one extra query,
not N+1).

Verified live end-to-end with a real deliberate duplicate: submitted an
exact copy of a real, currently-active Stripe posting (identical company/
title/URL). `score-submission-duplicate` correctly wrote `duplicate_tier:
"auto_merge"`, `duplicate_best_score: 100`, and the matched job's real id
-- visible in the admin queue as "Likely duplicate" *before* Approve was
clicked, closing the actual gap this fix targets. Clicking Approve then
correctly attached the submission as an additional `job_sources` row on
the existing job rather than creating a second listing (unchanged
`approve-submission` behavior, confirmed still correct after its
`submissionMapping.ts` refactor). Test submission and its job_sources
attachment removed afterward via migration -- the app is never granted
DELETE on any of these tables, so cleanup goes through a migration like
every other test-data removal this session.

**Same pass, three quick UI wins -- data that already existed server-side
but was never surfaced (US-28, US-39), plus half of US-52 (the half that's
actually a UI gap, not new infrastructure).**

US-28: `classification_method` exists on every job row but rendered
nowhere. Added a small note under the "Target industry" checklist row on
`pages/RealJobDetail.jsx` -- the one field the column actually describes
(`normalize.ts` always tags it `onet_occupation`/`rule`, since occupation/
industry classification is always inferred, never literally employer-
stated) -- reading "our estimate, from the role title (O*NET)" rather than
presenting an inferred category as if the employer wrote it. Known,
undisguised gap: a submitted job whose industries came from the
submitter's own chip selection (`approve-submission`'s
`submitterIndustries` override) still carries whatever
`classification_method` the occupation stub produced, since that override
was never reflected back into the column -- rare enough in practice
(industries usually agree) not to block this, but a real inaccuracy if it
ever diverges. Verified live (temporarily switching a test profile's
`opportunityType` to "Both" to make a real classified job eligible, then
reverting it afterward) -- confirmed the badge renders correctly and only
on the industry row, not the others matchJob() computes.

US-39: `data/store.jsx` gained `savedSearches` (same shape/pattern as
`recentSearches`) and `saveSearch`/`removeSavedSearch`. "Save this search"
on `pages/Jobs.jsx` now writes the current filter object under an auto-
generated label (built from the same `activeChips` the UI already renders
-- no name-entry form exists, so labeling it honestly from what's actually
active beats a placeholder like "Untitled search"). A new "Saved searches"
group in the filter column lists them; clicking one calls `setFilters()`
with the saved object directly, reusing 100% of the existing filter/sort/
diagnostic machinery. Verified live: saved a 5-chip filter combination,
changed filters via natural-language search, clicked the saved entry, and
confirmed the exact original 5 chips came back; removal correctly hides
the section when the list is empty.

US-52 (partial): `quality_score` is computed at ingestion for every job
but no admin panel showed it (the "pending duplicates" third of this story
was already done -- the existing duplicate review queue). Added a "Job
quality" section to `pages/AdminDashboard.jsx`: active jobs scoring below
0.5, worst first, direct client query (`jobs_select_admin`'s RLS already
grants this, no Edge Function needed for a read). Deliberately threshold-
gated, not an unconditional "bottom 10" -- an always-populated table would
misrepresent a genuinely healthy board as having a standing problem.
**Broken-link detection (the other real half of US-52) is explicitly not
included here** -- `quality.ts`'s own header comment already says why:
"live application-URL health checks aren't meaningful yet with no real
automated source running." That's real new infrastructure (a scheduled
job hitting every active `application_url` and recording the result), not
a UI-surfacing task like the other three items in this batch -- called out
by name rather than silently left off the list. Verified live: the panel
correctly lists real low-scoring postings (several genuine IMC/Brex/
Robinhood jobs at 0.2), and the "View" link routes to the real job detail
page.

**Same pass, the member-side half of US-26 (skill matching) -- Part 10's
own "small addition, same shape as the existing fields" note, now built.**

Job-side skill inference has existed since Stage 1
(`occupationTaxonomy.ts`'s `skillsForOccupation()`, `required_skills`), but
nothing existed on the member profile to match it against --
`server/src/match.ts`'s skills factor (weight 15/100) has always read
`profile.skills` against a field the real `preferences` object never had.
Added `skills: []` to `data/store.jsx`'s preferences default (covered
automatically by the existing one-level-deep merge fix, so an existing
saved session doesn't lose the field), a `skills text[]` column on
`member_preferences` (migration 20260824260000, same table-level grants as
every other column there), and a new "Skills" chip picker on My Profile's
Career preferences tab -- placed there, not onboarding, matching how
`opportunityType`/`compTarget` were added. Deliberately a **closed list**
(`data/careerOptions.js`'s new `SKILLS`, 22 entries), sourced by
extracting the exact vocabulary `occupationTaxonomy.ts` actually populates
on real jobs, not invented -- skill matching (both here and in
`server/src/match.ts`) is an exact case-insensitive string match, so free
text would silently never match anything real.

`data/jobMatch.js`'s `matchJob()` gained the same skills factor
`server/src/match.ts` already has, and its weights were rebalanced to
match exactly (industry 30 / role 25 / location 20 / **comp 10** / skills
15 -- comp had been silently absorbing skills' 15 points as 25 since there
was nothing to spend them on before this). Noted, not fixed: `preferred_
skills` is read defensively but is always empty in practice today --
`jobInsertFromNormalized()` never maps `NormalizedJob.preferredSkills`
even though the column exists, a separate pre-existing gap outside this
pass's scope.

Verified live end-to-end with a real job (IMC's "Trading Strategy Software
Engineer," `required_skills` = 7 real O*NET-derived skills): selected 3
matching skills on My Profile (one at a time -- a rapid-fire multi-click
test script first exposed a stale-closure artifact from firing synchronous
clicks without letting React re-render between them, not a real bug, since
every chip-toggle function in this file already works this way and a real
user's clicks are never that close together), confirmed the checklist
showed "3 relevant skills: Critical Thinking, Microsoft Excel, SQL," and
independently recomputed the exact score by hand (25 role + 3/7×15≈6.4
skills = 31.4 → 31) against what `matchJob()` actually returned -- exact
match. Confirmed the real Supabase round-trip too: queried
`member_preferences` directly after selecting skills (synced correctly)
and again after reverting the test selection back to empty (synced back
down correctly, no residue left in the real table).

**Same pass, US-22/23 -- hardened the expiration state machine.**

Confirmed live (this doc's own earlier audit note) that
`fetch-greenhouse-companies` flipped a job to `potentially_expired` on a
*single* missed fetch (one transient scrape hiccup could falsely flag a
still-open posting) and never actually flipped `active` to `false` on real
expiry -- `pages/Jobs.jsx`'s `.eq("active", true)` query kept showing
"expired" jobs indefinitely with no distinguishing badge anywhere. The
status existed; nothing enforced it.

Added a `missed_fetches` counter (migration 20260824270000) and a new
`mark_jobs_missed(job_ids)` RPC that increments it and conditionally
transitions status/active atomically per row -- PostgREST's `.update()`
can only set absolute values, not "increment, then conditionally
transition based on the new total," so this genuinely needed a SQL
function (same reasoning `company_demand_report` already established),
not a workaround. Explicitly revoked from `anon`/`authenticated` -- only
ever called by an Edge Function's service_role client, never something a
signed-in member should be able to invoke directly. Two thresholds, walked
through gradually: 1 miss is invisible (still plausibly transient), 2
consecutive misses flips to `potentially_expired` (visible on the board
with a new "Possibly no longer open" badge -- `components/JobCard.jsx`,
`pages/RealJobDetail.jsx` -- but not excluded, a member can still decide
it's worth trying), 5 consecutive misses flips to `expired` **and**
`active = false` -- the actual archive transition (US-23): excluded from
every active-jobs query, but the row itself is never deleted, so
history/provenance survives. Refreshing a job that reappears resets the
counter to 0, not just its status -- a `missed_fetches` counter that only
ever incremented would eventually expire *every* job that ever had one bad
day, which isn't what "consecutive" is supposed to mean. Deloitte's
adapter deliberately still runs no expiration sweep at all (unchanged,
correct, per its own existing header comment) -- its capped 20-result-per-
keyword feed makes "absent today" meaningless there, a different situation
from Greenhouse's exhaustive one.

Verified live against a real, currently-active job (not a fabricated
test row) by calling the RPC directly through temporary migrations, since
the real trigger condition -- a live company's feed genuinely dropping a
posting -- can't be produced on demand: confirmed 2 calls correctly
produced `missed_fetches: 2, status: "potentially_expired", active: true`
and the new badge rendered on both the job card and detail page; 3 more
calls (5 total) correctly produced `status: "expired", active: false`,
the job disappeared from a live board search that previously found it,
and the detail page correctly showed the *existing* "No longer active"
badge instead (confirming the two badges don't overlap). Reset the test
job back to its genuine original state afterward via a final migration --
verified `missed_fetches: 0, status: "active", active: true` restored
exactly.

**Same pass, US-19 -- real field-level merge on duplicate resolution,
closing the last item from Part 8's audit.**

`resolve-duplicate-candidate`'s "Keep A / Keep B" previously kept the
chosen job's fields exactly as-is and discarded the other record's data
entirely once its `job_sources` rows were reassigned -- correct enough to
stop a redundant listing from being visible (which is what actually
mattered for shipping US-18's queue), but not the "keep best field per
source" merge US-19 actually asks for. Fixed with a deliberately simple
policy, not a scored "which value is more accurate" system: plain fields
(description, city, salary, deadline, etc.) only **fill a gap** -- the
kept job's own non-null value is never overwritten, a genuinely missing
field gets backfilled from the removed job; array fields (skills,
industries, roles, grad years) are **unioned** instead, since a value
present on both sides is two real, non-conflicting facts, not a
disagreement to resolve. Identity fields (company/title/employment_type/
application_url) and computed/meta fields (quality_score,
classification_method) are deliberately untouched -- the admin's
`keepJobId` choice already picked which record's identity and
classification the merged listing keeps, and provenance for both
contributing sources was already fully retained via the existing
`job_sources` reassignment (unchanged). The response now reports exactly
which fields the merge actually changed (`mergedFields`), and Admin
Dashboard's confirmation note surfaces it ("Merged in from the duplicate:
description, salary_min, required_skills").

Verified live through the real Edge Function as an authenticated admin,
not a unit test in isolation: no naturally-pending duplicate candidate had
meaningfully different fields to merge (near-duplicates from the same
company/source tend to classify identically), so this used a fabricated
pair of test jobs with deliberately differing fields (job A: has a city,
missing salary/description/skill overlap; job B: missing city, has a
salary and description and a different skill) linked by a real
`duplicate_candidates` row. Clicking "Keep A" in the real admin UI
produced exactly the expected result: A's own `city: "Chicago"` was left
untouched (not overwritten by B's null), `salary_min`/`description` were
correctly backfilled from B, `required_skills` correctly unioned to both
skills, job B was correctly deactivated, and the confirmation note listed
the three changed fields accurately. Verified the *existing* pending
duplicate queue (real Charlie Health territory-manager candidates) still
renders correctly, unaffected. Test fixture fully removed afterward via
migration.

**Separate pass, closing this same Part 7 Stage 5 entry's own noted gap:
`preferred_skills` never got mapped from `NormalizedJob.preferredSkills`.**

Confirmed live before touching anything: `preferred_skills` was `null` on
all 3,281 jobs in the real table, while `required_skills` was populated on
481 (`select count(*) filter (where preferred_skills is not null and
array_length(preferred_skills,1)>0) from jobs` → 0). Root cause was two
layers deep, not just the insert mapping the task's own framing assumed:

1. `normalizeJob()` (`server/src/normalize.ts` /
   `supabase/functions/_shared/pipeline/normalize.ts`) hardcoded
   `preferredSkills: null` unconditionally -- the field was never computed
   in the first place, so there was nothing for the insert layer to map
   even if it had tried.
2. `jobInsertFromNormalized()` (`supabase/functions/_shared/dedupeHelpers.ts`
   -- this one has no `server/src/` mirror; it's Edge-Function-only glue,
   unlike normalize.ts/occupationTaxonomy.ts which do have real mirrored
   copies) then compounded that by never mapping `preferred_skills` onto
   the insert row at all, the same way `required_skills` already was.

Fixed both. `occupationTaxonomy.ts`'s `OnetOccupation` shape already
carried a third field, `knowledge` (O*NET's real Skills/Knowledge/
Technology-Skills three-way split), that nothing had ever read --
`skillsForOccupation()` only ever folded `skills` + `technologySkills`
into `required_skills`. Added `preferredSkillsForOccupation()` alongside
it (both `server/src/taxonomy/occupationTaxonomy.ts` and its Edge Function
mirror) returning that occupation's `knowledge` entries, deduplicated
case-insensitively against its own `skillsForOccupation()` output -- two of
the six stub occupations (Investment Banking, Operations) genuinely list
"Mathematics" in both `skills` and `knowledge`, and left undeduped that
would double-count a single member skill selection across match.ts's
concatenated `requiredSkills`/`preferredSkills` list. `normalizeJob()` now
calls it (`preferredSkills: occupation ? preferredSkillsForOccupation(occupation)
: null`) instead of hardcoding null, and `jobInsertFromNormalized()` now
maps `preferred_skills: normalized.preferredSkills` onto the insert row,
matching `required_skills`'s existing shape exactly (array of strings, no
extra casing/normalization).

Closed-vocabulary consequence, not a side quest: `data/careerOptions.js`'s
`SKILLS` list (the closed picker vocabulary My Profile's Skills chips and
`matchJob()`'s exact-string matching both depend on) previously covered
only `skillsForOccupation()`'s output. Populating `preferred_skills` with
`knowledge` terms outside that vocabulary would have meant the column held
real data a member could *never actually select*, leaving it functionally
dead regardless of what the database said -- so the same six new Knowledge
terms (Administration and Management, Economics and Accounting, Sales and
Marketing, Communications and Media, Computers and Electronics,
Engineering and Technology) were added to `SKILLS`, 22 → 28 entries.
`data/jobMatch.js`'s skills-factor comment (which had accurately said
"always empty in practice today") was updated to reflect that it no
longer is; no logic change was needed there or in `server/src/match.ts` --
both already read `preferred_skills` defensively and concatenate it with
`required_skills`.

Test coverage added (`server/tests/normalize.test.ts`,
`server/tests/match.test.ts`): a classified job now gets non-empty, non-
overlapping `preferredSkills`; the IB-occupation case specifically proves
"Mathematics" lands in `requiredSkills` only, never duplicated into
`preferredSkills`; and `matchJob()` now has a test proving a member
selecting a preferred-only skill (not just a required one) measurably
raises the score and appears in the skills factor's detail string.
`npm run test:server` -- 47/47 green (44 previous + 3 new).

Deployed `fetch-greenhouse-companies`, `fetch-deloitte-jobs`, and
`approve-submission` (the three functions that import
`_shared/pipeline/normalize.ts` and `_shared/dedupeHelpers.ts`) via
`npx supabase functions deploy <name> --use-api`. Verified the deployed
code against real production data, not just tests: triggered a real
`fetch-greenhouse-companies` run across all 11 configured companies (one
genuine new insert, Stripe's "Credit Risk Team Lead" -- correctly left
both `required_skills` and `preferred_skills` null since its title doesn't
match any of the six stub occupations, proving the null path stayed
correct) and a real `fetch-deloitte-jobs` run (0 new inserts that day) --
both completed with zero errors against live company data.

Backfill decision: fixed going forward *and* backfilled existing rows,
via a one-off script (not a migration -- this is derived from application
classification logic, not a schema change, so hardcoding it into permanent
migration history seemed worse than a documented one-time run). The script
reused the exact same `classifyTitleToOccupation`/
`preferredSkillsForOccupation` functions the now-deployed code calls (no
reimplementation, no drift risk), read every job with a non-null
`required_skills` via `npx supabase db query --linked`, and generated one
SQL file of per-row `UPDATE ... SET preferred_skills = ARRAY[...]`
statements, executed inside a single `BEGIN`/`COMMIT`. Verified before/
after directly against Postgres: before, 481 jobs had non-empty
`required_skills` and 0 had non-empty `preferred_skills`; after, both read
481 -- every previously-classified job now has a non-empty
`preferred_skills` (expected, since none of the six occupations' deduped
`knowledge` list is ever empty). Spot-checked the dedup logic against real
rows, not just the synthetic test: every real job with `'Mathematics' =
any(required_skills)` (Coinbase/Brex/Robinhood/Carvana operations-titled
postings) correctly has `preferred_skills = ['Administration and
Management']` only, with "Mathematics" correctly excluded. Idempotency
verified by literally re-running the generator against the now-backfilled
table and diffing the two generated SQL files (order-independent, since
Postgres doesn't guarantee row order without `ORDER BY`) -- byte-identical
statement sets both times, confirming a second run would be a true no-op.
Script and generated SQL were scratch files, not committed.

Not touched, and deliberately so: `server/src/dedupe.ts`'s `mergeJobs()`
still only merges `requiredSkills`, not `preferredSkills` -- but that
function has no live caller (the real merge path is
`resolve-duplicate-candidate`'s own `UNION_ARRAY_FIELDS`, which already
included `preferred_skills` before this fix, apparently anticipating the
column). `supabase/functions/_shared/pipeline/dedupe.ts`'s own header
comment already documents `mergeJobs()` as intentionally omitted from that
port, so this divergence is pre-existing and out of this fix's scope, not
a new gap introduced here.

**Separate pass: closed US-52's other real half -- live application-URL
health checks, deferred at Job-quality panel build time (quality.ts's own
header comment) as "not meaningful yet with no real automated source
running." That's no longer true: 12 real automated sources are live with
~3,300 real active postings.**

Built `check-job-links` (new Edge Function) + `link_health`/
`link_check_failures`/`last_link_checked_at` columns on `jobs`
(`20260825110000`), scheduled daily via the same pg_cron/pg_net pattern
`fetch-deloitte-jobs`/`fetch-greenhouse-companies` already use
(`20260825160000`, offset an hour past `fetch-deloitte-jobs` so the three
scheduled jobs don't collide). HEAD-checks every active job's
`application_url` (falling back to GET when HEAD alone isn't trustworthy),
flags a job `broken` after 3 consecutive failed daily checks --
`mark_link_check_results()` mirrors `mark_jobs_missed`'s atomic-increment
shape for the same reason (PostgREST can't do a conditional
read-then-write in one round trip). Reuses the `sources`/
`source_fetch_log` registry (new `system` source_type) rather than a
parallel admin surface, so `SourceManagement.jsx`'s existing
Approved/Disabled toggle is the real kill switch.

Two real findings from checking live URLs before writing any detection
logic, not assumed: (1) Coinbase's site rejects HEAD specifically (403)
while GET on the identical URL returns 200, so no non-ok HEAD is trusted
without a GET fallback; (2) a deliberately-invalid Greenhouse job id
redirects to the company's *generic* careers page with HTTP 200, not a
404 -- status code alone would miss this entirely. Fixed with
`redirectedToGenericPage()`: compares the long numeric id token(s) in the
original `application_url` against the ones in the final URL after
redirects; none surviving is treated as a failure despite the 2xx. This
heuristic is exactly what caught 4 of the 5 real broken links below.

Also found live: Carvana's site (Cloudflare bot-challenge) returns 403 to
*every* automated request, HEAD and GET alike, for real, currently-open
postings (~1,474 of ~3,300 active jobs at the time). There is no way to
tell that apart from a genuinely dead/blocked link from the HTTP response
alone, so persistent-403 is classified `inconclusive` -- logged, but
`link_health` left untouched -- rather than mass-flagging ~45% of active
jobs broken. Documented as a deliberate, known detection gap (a genuinely
dead Carvana-style posting behind bot protection would never get caught)
rather than silently guessed at.

**A real false-positive burst happened during this feature's own live
verification, root-caused and fixed, not papered over.** Verifying
`check-job-links` live meant invoking it roughly 15 times within about 10
minutes -- far more aggressive than the once-daily production cadence it's
designed for. That volume of repeated requests to the same hosts in a
short window triggered transient rate-limiting on Stripe's side: ~95 real,
completely healthy Stripe postings failed three checks in a row (in
wall-clock minutes, not the three separate days `BROKEN_THRESHOLD` is
meant to represent) and crossed the threshold into `broken`. Manually
re-verified immediately after: every sampled URL returned a real 200 and
the correct listing page -- confirmed self-inflicted by verification pace,
not a flaw the real daily cron would hit. Root cause: the original
`checkOne()` treated any non-ok, non-403 status (including 429 and 5xx)
as a hard failure, with nothing distinguishing "server is temporarily
struggling" from "this posting is gone." Fixed at the code level
(`isTransientServerStatus()`, treats 429 and any 5xx the same as
persistent-403 -- `inconclusive`, not `broken`) and separately reset every
contaminated row back to a clean `unchecked`/0/`null` state via a full
reset migration (`20260825180000`) rather than trying to surgically
untangle which of the ~2,000 touched rows were real signal versus
rate-limit noise. While fixing this, a second, unrelated real bug
surfaced in `mark_link_check_results`' candidate-selection query: it
prioritized `link_check_failures desc, last_link_checked_at asc
nulls-first`, so an inconclusive result (which never touches
`last_link_checked_at`) stayed indistinguishable from a never-checked row
forever -- confirmed live as `inconclusiveBlocked` climbing 26 → 167 → 182
→ 225 across three runs as Carvana's ~1,474 bot-blocked jobs kept winning
the same priority tier every single run. Fixed (`20260825170000`) by
having an inconclusive result still stamp `last_link_checked_at` (a third
array on `mark_link_check_results`, never touching `link_health`/
`link_check_failures`) so it counts as "we attempted a check" without
counting as evidence either way.

While chasing the RPC permission error hit deploying this feature
(`grant execute ... to service_role` was missing -- functions created by a
migration don't inherit an implicit PUBLIC-execute grant service_role can
use, same root-cause class as `20260822110000`'s table-grant fix, just for
a function), found the *identical* gap already live and unnoticed in
`mark_jobs_missed` (`20260824270000`): its own grant to `service_role` had
never actually been applied, meaning `fetch-greenhouse-companies`' calls to
it had been silently failing (swallowed, logged as success with 0 counts)
in production since it shipped -- the entire potentially-expired/expired
state machine for every Greenhouse-sourced job was inert. Every prior
"verified live" pass for that feature had called the RPC directly as the
`postgres` role (bypassing grants entirely), which is why it was never
caught. Fixed alongside this migration (`20260825130000`) since it's the
exact same root cause found by the exact same check, not filed separately.

**Real verified numbers, post-fix.** Live query against the linked
project: 5 jobs currently `broken` out of ~3,284 active (2,568
`unchecked`, 711 `ok`, 5 `broken`) -- 2 Databricks, 2 Robinhood, 1 Brex,
all with `link_check_failures = 4` and all last checked by the real
scheduled cron run at 15:17 UTC (`source_fetch_log`: `checked: 300, ok:
205, failed: 24, inconclusiveBlocked: 71, newlyFlaggedBroken: 0,
stillBroken: 5` -- zero new flags, zero recoveries, ~6.5 hours after the
last manual verification run, confirming the cron is actually firing on
its own schedule and these 5 are stable, not another burst). Manually
spot-checked all 5 with a real `curl -IL` outside the Edge Function
entirely: both Databricks URLs and both Robinhood URLs return HTTP 200 but
redirect to the company's generic careers page with no job-id token
surviving (exactly the `redirectedToGenericPage()` case); Brex returns a
literal 404. All 5 independently confirmed genuinely dead, diverse across
3 companies and both failure modes -- not a repeat of the Stripe
rate-limit pattern.

Verified end to end, not just unit-tested: `npx supabase migration list`
shows all 9 migrations applied remotely; `check-job-links` is deployed
(`ACTIVE`, version 4) and its deployed behavior matches the fixed source
(the false-positive-era runs and the corrected runs are both visible,
distinctly, in `source_fetch_log`'s real history); `cron.job` shows
`check-job-links-daily` registered and active on `17 15 * * *`; the test
fixture (`20260825140000`/`20260825150000`) both ran and cleaned up (0
matching rows remain). Admin Dashboard's new "Broken links" panel
(`pages/AdminDashboard.jsx`) queries `jobs` directly for `link_health =
'broken'` the same way the existing "Job quality" panel above it already
queries `quality_score` -- same RLS (`jobs_select_admin`), same
`queue-table`/`queue-table__scroll` classes, so it inherits the same
verified horizontal-scroll behavior at the 900px/640px breakpoints with no
new CSS -- inferred from the shared classes at the time, then directly
confirmed afterward: the user opened `/admin` themselves and visually
confirmed the panel renders correctly. `SourceManagement.jsx`'s fetch-log
summary line got a small
branch for this function's `checked`/`ok`/`failed`/`newlyFlaggedBroken`
shape, since it has no insert/merge/dedup concept to report the way every
job-listing fetcher's summary does. `npm run test:server` -- 47/47 green,
unaffected (this feature has no `server/`-side logic, it's Edge
Function + schema only).

**Same day, US-58 -- personalized continuous feed, closing the last
open P2 story with an actual engineering dependency (US-32/40, both
already live).** Added as a new "Continuous feed" tab on the existing
Jobs board (`pages/Jobs.jsx`) rather than a new nav destination -- close
enough to the existing board that a separate top-level rail item would
have duplicated IA CLAUDE.md already treats as finalized. When active,
the filter sidebar is replaced with a short explanatory line rather than
shown-but-inert, since the whole point of the tab is that it isn't
filter-driven.

`components/ContinuousJobFeed.jsx` loads in cursor-based batches of 60
(`.range()`, ordered `quality_score desc, id asc` for a stable tiebreak)
against the real ~3,284-row `jobs` table -- never `fetchAllRows()`, the
exact over-fetch pattern that caused the PostgREST 1000-row cap incident
and the Databricks/Coinbase compute-limit incidents earlier in Part 7.
Each batch is scored with the same `matchJob()`/`finalScore()`
(`data/jobMatch.js`) the board's own "Best match" sort already uses --
no parallel scoring path -- hard-ineligible jobs (grad year/employment
type) are dropped per US-33 before scoring, and a running per-company
counter enforces the same 3-per-company cap Jobs.jsx's own
`capPerCompany()` already uses (hoisted into a shared `CAP_PER_COMPANY`
constant in `data/jobUtils.js` so the two surfaces can't drift out of
sync on the number). An `IntersectionObserver` sentinel triggers the next
batch on scroll; loading state reuses the existing `Skeleton` component,
never a spinner.

Verified live by the user directly (not just build/test-suite proof):
`npm run build` and `npm run test:server` (47/47, untouched -- this
feature never touches `server/src` or any migration) were green before
handoff, then the user ran the real dev server against the real
Supabase project, signed in with a real confirmed test account, and
confirmed the tab loads incrementally rather than all at once, ranking
looks sane, and no single company dominates the scroll.

**2026-08-25 -- `isLikelyNonCorporateRole()`: manual trade + direct
clinical/patient-care denylist, retroactive cleanup + ingestion gate.**
Explicit rescope, not a bug fix: UC Portal serves UCLA business-club
students seeking white-collar corporate roles -- finance, consulting,
tech, investment banking, general corporate-office work -- and nothing
else, regardless of how well-classified or "entry-level" a posting is.
Prompted by Carvana turning out to be 1,474 of the live table's ~3,283
active jobs (45%) once its Greenhouse board was live for a while --
overwhelmingly manual/hourly automotive-operations work (Automotive
Parts Associate, Experienced Auto Painter, Customer Delivery Driver,
Security Guard II, CDL A Local Truck Driver, Car Detailer, Auto
Mechanic, Title Administrator) that `isLikelySeniorRole()` correctly let
through, since none of it is senior, it's just the wrong *kind* of job.
Only 101 of Carvana's 1,474 (7%) had a real O*NET `job_function_id`
classification, and classification rate turned out to be low across
every company (Stripe 26%, Databricks 7.5%, Charlie Health 2.8%), which
ruled out `job_function_id is not null` as a hard allowlist gate before
any code was written -- it would have wrongly excluded huge numbers of
legitimate Stripe/Databricks/Figma engineering and business postings
whose titles just don't match today's limited O*NET crosswalk
vocabulary. Second axis, same finding: Charlie Health mixes genuine
corporate roles (Commercial Strategy Associate, Growth Strategy Analyst)
with direct clinical/patient-care postings (Licensed Mental Health
Therapist, Crisis Intervention Specialist, SUD/Mental Health Group
Facilitators) -- previously a deliberate "keep both halves" call (see
this doc's Stage 4 entry above, now marked superseded), no longer
correct once the user rescoped the product to white-collar-only.

Same template as `isLikelySeniorRole()`, deliberately: a conservative,
keyword-based denylist in `_shared/pipeline/relevance.ts`, not a
classifier, with the same asymmetry (an ambiguous title -- no clear
manual-trade or clinical-care marker -- is kept, not dropped). New this
time: `_shared/pipeline/relevance.ts` now has a real `server/src/`
mirror (`server/src/relevance.ts`), which it never had before (only
`isLikelySeniorRole()` existed, Edge-Function-only) -- added so
`server/tests/relevance.test.ts` can exercise the exact regexes the
deployed functions run, matching the pattern `normalize.ts` and
`occupationTaxonomy.ts` already use, and per this doc's own repeated
warning (US-56/US-09) about two copies of the same pipeline logic
drifting apart. `isLikelyNonCorporateRole()` combines two patterns:

- `MANUAL_TRADE_TITLE_PATTERN`: technician(s), mechanic(s), painter(s),
  detailer(s), prepper(s), airbrush, inspector(s), CDL, lot attendant/
  assistant, auto body, upholstery, security guard(s), data entry, wheel/
  dent/rim/glass/interior repair, parts associate(s), line/machine
  operator(s), warehouse associate/worker/supervisor/technician, delivery
  driver/ambassador/advocate/specialist, vehicle/customer delivery,
  driver(s), forklift, custodian(s), housekeeping, cashier(s), PDR, lube,
  refinish\*, heavy body, body tech(s), restoration, brake(s), combo/
  diagnostic/auto tech(s).
- `CLINICAL_CARE_TITLE_PATTERN`: therapist(s), clinician(s), counselor(s),
  nurse(s)/nursing, physician(s), psychiatr\*, social worker(s), care
  coach(es), crisis intervention, behavioral health (specialist(s)),
  clinical, facilitator(s), mental health, substance use disorder, LCSW,
  LMFT, LPC, RN, care navigator(s), clinical/patient case manager(s).

Both were built by querying the live `jobs` table directly (not
guessing from the user's starter list) and validating every candidate
word against every active company's real titles -- Stripe, Databricks,
Brex, IMC, Figma, Airbnb, Coinbase, Robinhood, Deloitte, Guild, in
addition to Carvana and Charlie Health -- specifically to catch false
positives before they could ever reach production. That process caught
several real near-misses the starter list alone would have introduced:

- Bare `security` was dropped -- Databricks/Figma/Stripe/IMC/Airbnb/
  Deloitte all have real "Security Engineer"/"Information Security"
  titles. Only the unambiguous "security guard" phrase made it in
  (Carvana's own "Security Associate"/"Security Lead" are left
  un-caught, a deliberate conservative gap, not an oversight).
- Bare `delivery` was dropped -- Databricks has 14 real "Delivery
  Solutions Architect" postings and Deloitte has a "Tech Delivery"
  consultant role. Scoped to "delivery driver/ambassador/advocate/
  specialist" and "vehicle/customer delivery" instead.
- Bare `tech` was dropped -- "Tech Lead", "Tech Ops", "Tech Delivery",
  "High Tech" all appear as real titles at Airbnb/Databricks/Deloitte/
  Stripe/IMC. Carvana's many "___ Tech" abbreviations (PDR Tech, Lube
  Tech, Heavy Body Tech, Combo Tech, Diagnostic Tech, Auto Tech, Body
  Tech) are instead caught by their specific trade-word prefixes --
  a real, deliberately accepted coverage gap: a live re-fetch after
  deploy surfaced a brand-new, never-before-seen Carvana title
  ("Master Collision Repair/Recon Tech") this doesn't catch, kept
  intentionally rather than reaching for a bare "tech" match.
- `warehouse` and `operator` were scoped to compound phrases ("warehouse
  associate/worker/supervisor/technician", "line/machine operator")
  rather than left bare, since "Data Warehouse" is a plausible legitimate
  title fragment at data/analytics employers and Stripe has a real
  "Engineering Manager, Operator Tooling" role, even though neither
  currently collides.
- `counselor` is spelled out in full, not a substring match on `counsel`
  -- the substring would have wrongly caught every real "Counsel"/"Legal
  Counsel"/"Assistant General Counsel" attorney title (Brex, Coinbase,
  Databricks, Figma, IMC, Robinhood, Stripe all have them).
- Bare `sud` was tried and dropped after validation surfaced a genuine
  false positive: Charlie Health also posts ~130 "Territory Manager, SUD
  (...)" field-sales/business-development postings, not clinical roles,
  and every genuinely clinical SUD posting already contains "Facilitator"
  and is caught by that branch instead. `patient` was dropped for the
  same reason -- it only ever matched "Patient Finance Collector/
  Specialist", which are billing/collections roles, not direct patient
  care.
- A word-boundary bug (`care\s+coaches?` matches "coache"/"coaches", not
  bare "coach" -- the `?` only makes the trailing `s` optional, not an
  `es` pluralization) was caught by `server/tests/relevance.test.ts`
  itself before anything was deployed or deleted, not after: "Care Coach
  (Part-Time)" failed an early test run, fixed to `care\s+coach(es)?`,
  and the dry-run counts were regenerated from scratch before writing
  the migration.
- "Data Entry Specialist" (Carvana, 6 postings) is included per an
  explicit human judgment call: not manual trade in the literal sense,
  but not a business/finance/consulting/tech role either.

Dry-run validated against the real table before any deletion: 1,207 of
3,284 active postings matched (1,126 Carvana, 81 Charlie Health, **0**
across all 10 other active companies). Cross-checked against
`job_function_id is not null` specifically to confirm the previously-
identified relevant postings survive: 99 of Carvana's 101 classified
postings kept (the 2 removed are both "Technician I/II, Facilities,
Property Operations" -- a building-facilities maintenance role, correctly
excluded despite carrying an O*NET classification, since classification
was never a relevance proxy -- see above) and all 7 of Charlie Health's
classified postings kept (Commercial Strategy Associate/Manager, Growth
Strategy Analyst x2, Strategy & Operations Analyst x2, Care Strategy &
Operations Analyst/Associate), plus all ~130 Territory Manager postings
at Charlie Health, per the `sud` finding above.

Deleted via migration `20260825190000_remove_non_corporate_role_postings.sql`,
same precedent as `20260824120000_remove_senior_role_postings.sql`: job
IDs listed explicitly, computed client-side with the exact deployed
regex rather than reimplemented in Postgres' own regex dialect
(word-boundary syntax differs: `\y` vs `\b`), avoiding any risk of a
mismatch between what was reviewed and what actually got deleted.
`job_sources` and `duplicate_candidates` both carry `ON DELETE CASCADE`
FKs to `jobs.id` (confirmed via `information_schema` before writing the
migration), so a plain `delete from jobs` would have cascaded correctly
on its own; the migration explicitly pre-deletes both anyway for
auditability, matching the prior migration's pattern, extended here to
also cover `duplicate_candidates.job_id_b` (the prior migration only
handled `job_id_a`). `opportunity_submissions` has `NO ACTION` FKs to
`jobs.id` and `saved_jobs`/`tracked_applications` store `job_id` as
unconstrained `text` with no FK at all -- confirmed all three tables
were empty in the live database before deleting, so neither posed a
constraint-violation nor an orphaned-reference risk this time.

Verified live, real Postgres counts before/after, not estimated:
Carvana 1,474 → 348 active, Charlie Health 251 → 170 active, all 10
other companies unchanged, table total 3,284 → 2,077. Zero orphaned
`job_sources`/`duplicate_candidates` rows after the cascade. Wired into
both `fetch-greenhouse-companies` and `fetch-deloitte-jobs` (same
`if (isLikelySeniorRole(title) || isLikelyNonCorporateRole(title))` gate)
and deployed via `--use-api`; re-invoked both functions live afterward
specifically to check idempotency, not just that they still run.
`fetch-greenhouse-companies` (`skippedNotRelevant: 1310` for Carvana,
`111` for Charlie Health on that single run) confirmed none of the
1,207 deleted titles came back -- spot-checked directly with `ilike`
queries for "Car Detailer", "CDL A Local Truck Driver", "Licensed Mental
Health Therapist", "Crisis Intervention Specialist", "Customer Delivery
Driver", and "Auto Mechanic" against the post-re-fetch table: zero rows.
The re-fetch did insert a
handful of new Carvana/Charlie Health postings (37 and 4 respectively)
whose titles fall into the deliberately-conservative-keep gaps above
(ambiguous Manager/Supervisor/Lead/Coordinator titles, "Security
Associate" without "guard", the new "Collision Repair/Recon Tech"
variant) -- expected given the design, not a regression, since every one
of those title *shapes* was already present in the kept set before
deletion.

`npm run test:server`: 90/90 green (43 new in `relevance.test.ts`, 47
pre-existing untouched), `npm run typecheck:server` clean.

**2026-08-27 -- independent re-verification (this work had been left
uncommitted across two prior interrupted sessions, so it was re-checked
from scratch rather than trusted).** Confirmed live via direct Postgres
query (`npx supabase db query --linked`) that the migration above had in
fact applied against the real table (Carvana 407 active at the time,
consistent with 348 post-migration plus organic new postings since, none
matching the denylist -- see below), and that both Edge Functions'
`updated_at` already reflected an 2026-08-26 deploy -- i.e. the prior
session's deploy step had actually succeeded before it was interrupted,
it just never got committed. Rather than trust that, redeployed both
functions again (`--use-api`, both succeeded) and independently checked
correctness a different way than the original writeup: pulled every
currently-active job's `id`/`company`/`title` (2,198 rows across all 12
companies) and ran the exact `MANUAL_TRADE_TITLE_PATTERN`/
`CLINICAL_CARE_TITLE_PATTERN`/`SENIOR_TITLE_PATTERN` regexes from the
working tree against every title client-side -- zero matches anywhere,
including Carvana and Charlie Health. Then live-invoked both functions
directly via `curl` against the deployed HTTPS endpoints (not just
re-reading old logs): `fetch-greenhouse-companies` returned
`skippedNotRelevant: 1318` for Carvana and `110` for Charlie Health on
this run, `fetch-deloitte-jobs` returned `skippedNotRelevant: 12`, and
re-ran the full active-jobs pull afterward (2,225 rows) -- still zero
denylist matches. Manually eyeballed 40 random Carvana and 40 random
Charlie Health titles for anything the keyword patterns might have
missed (e.g. "Automotive Shop Foreman", "Reconditioning Manager",
repeated "Territory Manager" at Charlie Health) -- all fall into the
same deliberately-conservative ambiguous-manager/field-sales "keep" zone
already reasoned through above, nothing egregious slipped through. This
confirms Part 1 was correctly finished and deployed before the session
loss; the redeploy and re-checks here are belt-and-suspenders, not a
fix. `npm run test:server` re-run clean at 90/90 before committing.

**2026-08-31 -- Part 2: `MAX_ACTIVE_JOBS_PER_COMPANY = 30`, a hard per-
company cap on active postings.** Part 1 fixed *what kind* of job is
relevant; this fixes *how many* postings from one employer are allowed
to crowd out everyone else. The user's own framing: "I want to focus
more on having more companies rather than few companies with tons of
jobs. Pick the most important/relevant ones to consulting, investment
banking, tech, finance, and similar fields." This work had already been
started and left uncommitted across a prior interrupted session (machine
idle, not a real error) -- `server/src/companyCap.ts`,
`supabase/functions/_shared/pipeline/companyCap.ts`,
`server/tests/companyCap.test.ts`, and partial wiring into both fetch
functions were sitting in the working tree. Verified rather than trusted:
the two `companyCap.ts` copies (server mirror + Edge Function original)
were already byte-for-byte identical and the 13-test suite already
covered tiering, quality/date tiebreaks, determinism, and idempotency
correctly -- no changes needed there. `fetch-greenhouse-companies` was
already fully wired (imports `enforceCompanyCap`, calls it once per
company at the end of `runFetchForCompany`, threads a `jobFunctionNameById`
map through). **`fetch-deloitte-jobs` was not** -- it imported
`enforceCompanyCap` but never called it, a real gap from the
interruption, not a stylistic choice. Fixed by adding the same
`jobFunctionNameById` reverse-lookup map and the same
`enforceCompanyCap(adminClient, "Deloitte", jobFunctionNameById)` call at
the end of `runFetch`, plus a `capDeactivated` field in its summary
object to match the Greenhouse function's shape.

**Tier design** (`companyCap.ts`'s own header comment has the full
reasoning; summarized here). Three tiers, ranked using the real
`job_functions` taxonomy already seeded in the database -- not the
broader wishlist of categories from scoping conversations (Strategy,
Private Equity, Data/Analytics aren't distinct `job_functions` rows
today; `occupationTaxonomy.ts` already folds Strategy into Consulting and
Private Equity into Investment Banking, so a posting classified via
either keyword already lands in the tier its name suggests):
- **Tier 0 (top)** -- Consulting, Investment Banking, Software
  Engineering, Product Management. The verticals UC Portal exists for.
- **Tier 1 (mid)** -- Marketing, Operations, Sales. Real, legitimately
  white-collar corporate functions (Part 1 already filters out manual-
  trade/clinical work) -- just not what UC members are primarily
  recruiting for. ("Sales" has no occupation stub mapping to it yet, so
  it's currently a no-op tier, kept for documentation/future-proofing.)
- **Tier 2 (bottom)** -- unclassified (`job_function_id is null`). The
  largest tier for nearly every company (Part 1's own writeup found
  O*NET classification coverage low company-wide: Stripe 26%, Databricks
  7.5%, Charlie Health 2.8%). This is a ranking *signal*, not a relevance
  gate -- an unclassified posting can absolutely be a genuinely relevant
  white-collar role; it just loses ties to a classified one when a
  company is over quota.

Within a tier: `quality_score` descending, then `posted_date` descending,
then a stable `id` comparison as the final deterministic tiebreak --
required for idempotency (re-running against an unchanged active set must
always compute the same excess, never reshuffle it).

**Deactivate, never delete.** `active = false, status = 'removed'` -- the
same `job_status` enum value `resolve-duplicate-candidate` already uses
for "taken out of the active set for a reason other than the listing
itself disappearing," distinct from `expired`/`potentially_expired`
(which describe the *employer's own posting* going stale -- not what
happened here; these are still genuinely open roles, merely over quota).
Reversible later (raising the cap, or other postings at that company
expiring and freeing room) without re-fetching anything, and preserves
`job_sources`/`duplicate_candidates` provenance untouched.

**Retroactive cleanup, applied live.** Computed client-side (same
precedent as Part 1's migration and `20260824120000` before it --
reimplementing the exact deployed `tierForJobFunction`/
`compareCapCandidates` logic in Postgres' own dialect risked a mismatch
between what was reviewed and what actually ran) against a live pull of
every active job's `id`/`company`/`job_function` name/`quality_score`/
`posted_date`, then written as migration
`20260831200000_enforce_company_job_cap.sql` -- an explicit `update jobs
set active = false, status = 'removed' where id = any(array[...]::uuid[])`
over 1,824 listed ids (needed the same `::uuid[]` cast Part 1's migration
used; a first attempt without it failed with `operator does not exist:
uuid = text` since a bare `array['...']` literal defaults to `text[]`).

Real live counts, verified via direct Postgres query before and after
(all had drifted up slightly from the counts in the task brief, from the
existing daily crons running in between):

| Company | Before | After | Deactivated | Survivors: tier0 / tier1 / unclassified |
|---|---|---|---|---|
| Stripe | 518 | 30 | 488 | 30 / 0 / 0 |
| Carvana | 404 | 30 | 374 | 6 / 24 / 0 |
| Databricks | 322 | 30 | 292 | 14 / 9 / 7 |
| Brex | 170 | 30 | 140 | 22 / 8 / 0 |
| Charlie Health | 166 | 30 | 136 | 7 / 0 / 23 |
| IMC | 165 | 30 | 135 | 30 / 0 / 0 |
| Figma | 142 | 30 | 112 | 30 / 0 / 0 |
| Airbnb | 91 | 30 | 61 | 9 / 13 / 8 |
| Coinbase | 87 | 30 | 57 | 13 / 8 / 9 |
| Robinhood | 49 | 30 | 19 | 9 / 7 / 14 |
| Deloitte | 40 | 30 | 10 | 25 / 0 / 5 |
| Guild | 2 | 2 | 0 (already under cap) | 1 / 0 / 1 |

Total: 2,156 -> 332 active across 12 companies (1,824 deactivated).
Stripe/IMC/Figma filling all 30 slots from tier 0 alone shows the tier
design doing exactly what was asked (crowding out generic postings with
consulting/IB/tech/finance-relevant ones first); Charlie Health's
7-tier0/23-unclassified split shows the tier-2 fallback working as
designed for a company with thin O*NET coverage rather than leaving 23
slots empty.

**Deployed both functions** (`--use-api`) and verified live, not just
assumed:
- `fetch-deloitte-jobs` invoked directly (curl against the deployed
  endpoint, anon key -- confirmed sufficient for these functions'
  `Deno.serve`, no service-role key needed for invocation): first call
  `capDeactivated: 0` (Deloitte was already exactly at 30 from the
  migration), second call also `capDeactivated: 0` -- stable.
- `fetch-greenhouse-companies` invoked twice in a row (all 11 companies).
  Both runs returned `inserted: 0` everywhere except real new postings
  that legitimately appeared (a handful per company, consistent with
  Part 1's own re-verification entry) -- no duplicate-insert bug.
  `capDeactivated` was nonzero on *every* run, including the second
  (e.g. Stripe 469 then 467) -- this is expected, not a leak: each
  company's own freshness-refresh path (`refreshed: N`) sets
  `active = true, status = 'active'` on every already-tracked job still
  present in that day's Greenhouse feed, including ones the cap had
  previously deactivated, before `enforceCompanyCap` runs last and trims
  back down to 30 -- re-reading the true post-refresh active set from
  the database is exactly why `enforceCompanyCap` re-queries rather than
  trusting in-memory state (see its own comment in `dedupeHelpers.ts`).
  Net active count stayed at exactly 30 (or 2 for Guild) after every
  invocation, confirmed via direct query after each run.
- **Idempotency spot-check, not just count-level**: pulled the exact set
  of active job ids for Stripe and Databricks before and after a second
  `fetch-greenhouse-companies` invocation. Databricks: identical set, 0
  ids differed. Stripe: 2 ids differed between the two snapshots --
  traced to that run's own `markedFullyExpired: 2` /
  `markedPotentiallyExpired: 1` (the pre-existing freshness sweep, not
  the cap) genuinely removing 2 previously-active Stripe postings from
  the candidate pool between snapshots, which correctly promoted the
  next-best surviving candidate into the freed slot -- the tiering/
  ranking itself is deterministic given an unchanged candidate pool
  (proven by Databricks' 0-diff result); the Stripe diff reflects a real
  upstream signal (postings going stale), not non-determinism in the cap
  logic.

`npm run test:server`: 103/103 green (13 new in `companyCap.test.ts`, 90
pre-existing untouched). `npm run typecheck:server` clean.

**2026-08-31 -- Sixth addition: two more companies (Accordion, SoundCloud),
sourced by cross-referencing `scripts/check-company-source.mjs` against
real UC alumni/member-by-company counts in the live `people` table
(queried directly via `npx supabase db query --linked`, both the Alumni
rows and current-member rows -- 68 distinct alumni companies plus the
active-member roster), per the user's explicit direction this pass:
prioritize finding new companies over adding volume to existing ones, and
weight toward consulting/investment banking/tech/finance specifically.

Every company actually checked this pass, skipping everything already
live or already rejected in a prior pass: Wavestone (no usable board),
Veritas Capital (no usable board), Narmi (Lever slug real but 0 postings
-- same "real but empty" case already documented for Plaid/Indeed), LIDD
Consultants (no usable board), Konrad Group (no usable board), Pacific
Life (Workday hint only, same non-buildable signal already documented for
Accenture/Microsoft/Meta/etc.), Candidly (Greenhouse slug real but 0
postings, same empty-board case), BetterUp (no usable board), Zendesk
(Workday hint only), Cart.com (no usable board), nference (no usable
board), Twitter (no usable board -- X Corp's careers presence returns no
checkable API/schema signal), RS Investments (no usable board), Contend
(no usable board), Invenergy (no usable board). One additional candidate,
Aura, was found and then excluded after identity verification failed:
Greenhouse slug "aura" reports company_name "Aura" and 5 postings, but
every sampled application URL resolves to `auraframes.com` (Aura Frames,
a digital-picture-frame company), while the real "Aura" a UC alumnus's
record most plausibly refers to is `aura.com` ("Aura | Intelligent
Digital Safety for the Whole Family", a digital-security company) -- two
distinct real companies sharing the name "Aura," not a squatter this
time, but identity can't be confirmed either way from the ATS data alone,
so it's excluded per this project's established rigor on company-identity
verification (the same bar that caught "bcg"/"Oliver Wyman Labs"/
"Disney"/Capital One's Lever slug in prior passes).

**Accordion**: real financial-consulting firm (interim management/finance
transformation for PE-backed companies, headquartered NYC), one real UC
alumnus on record (listed as "Accordian," a misspelling of the real
name). Greenhouse slug "accordion", 46 postings, company_name "Accordion"
on every posting (exact match), roles (Associate, Adaptive Planning
Consultant, Associate/Exit Planning and Transaction Support,
Associate/Operational & Technical Accounting) and office footprint
(Atlanta/Boston/Charlotte/Chicago/Dallas/New York/San Francisco/London)
consistent with the real Accordion -- directly relevant to the
consulting/finance vertical this pass was weighted toward.

**SoundCloud**: real music-streaming company, one real UC alumnus on
record. No guessed slug resolved directly ("soundcloud" 404s on
Greenhouse), but `soundcloud.com/jobs`'s own page source sets a
`ghSlug = "soundcloud71"` JS variable used to build its own Greenhouse
API calls -- the real token, pulled from the company's own careers page,
not guessed. `boards-api.greenhouse.io/v1/boards/soundcloud71/jobs`
returns 15 postings, company_name "SoundCloud" on every posting (exact
match), application URLs on `job-boards.greenhouse.io/soundcloud71/jobs/...`
-- the same canonical Greenhouse-hosted board `soundcloud.com/jobs` itself
links to, confirming identity.

Added via migration `20260831210000_greenhouse_accordion_soundcloud.sql`
onto the same config-driven `fetch-greenhouse-companies` mechanism as
every prior Greenhouse addition -- no adapter code changes needed, both
already inherit Part 1's white-collar relevance filter and Part 2's
30-active-jobs-per-company cap automatically, verified rather than
assumed (see below).

Verified live end-to-end: first invocation of `fetch-greenhouse-companies`
(via `curl` against the deployed HTTPS endpoint, anon key, same pattern
as this doc's other direct-invocation verifications) correctly picked up
both new config rows alongside all 11 existing companies in the same run
-- Accordion: fetched 46, inserted 17, skippedNotRelevant 29,
skippedCompanyMismatch 0, deferred 0; SoundCloud: fetched 15, inserted 7,
flaggedDuplicate 1, skippedNotRelevant 8, skippedCompanyMismatch 0,
deferred 0. A second invocation confirmed idempotency: both sources
correctly showed `inserted: 0`, `refreshed: 17`/`refreshed: 7`, `deferred:
0`. Cross-checked directly against Postgres: `jobs` table shows Accordion
at 17/17 active and SoundCloud at 7/7 active -- both comfortably under the
30-job cap, so `capDeactivated: 0` for both on every run, as expected for
boards this small. Spot-checked every active title from both companies
directly: Accordion's 17 are all finance-consulting/tech-consulting roles
(Associate, AI Product Manager, Cloud DevOps Engineer, ERP Architect,
CPM Solution Lead, Technical Architect, Finance & Strategy Associate,
etc.); SoundCloud's 7 are engineering, artist/label relations, ops
management, and an IT working-student role -- zero manual-trade or
clinical-care titles in either, confirming Part 1's `isLikelyNonCorporateRole()`
gate (which runs before any insert, not after) correctly had nothing to
filter for these two companies rather than merely appearing to pass by
accident.

`npm run test:server`: 103/103 green, unaffected (config-only addition,
no adapter/pipeline code touched this pass).

**2026-08-31 -- closed the stale §3.5 gap: `scoreQuality()` now factors in
real `link_health` (US-52's other real half, wired all the way through).**
`quality.ts`'s own header comment had said "live application-URL health
checks aren't meaningful yet with no real automated source running" since
before Stage 3 shipped -- no longer true once `check-job-links` went live
(this doc's own entry above it) with 12+ real automated sources and a real
`link_health` column being populated daily. Flagged explicitly as a known,
deliberately-deferred gap at the time; closing it now.

**Weighting chosen, and why not a literal third weighted term.** The
existing formula (`0.6 * completeness + 0.4 * confidence`) is left
completely unchanged as the base; `link_health` is folded in as a
post-hoc multiplier on that base, not a reweighted three-factor average:

- `unchecked` (still the majority state -- `check-job-links` rotates
  through the active set gradually, not all at once) applies no multiplier
  at all (x1) -- a job that simply hasn't been checked yet must never score
  worse than an identical one that has, and a fixed "neutral" value plugged
  into a genuine three-factor weighted average can't guarantee that for
  every combination of completeness/confidence the way a true no-op branch
  can.
- `ok` multiplies by **x1.1** (capped at 1) -- a small, deliberately minor
  reward. §3.5 is explicit that quality is a tie-breaker/floor, never a
  primary ranking signal, so a verified-working link should nudge a score
  up, not dominate it.
- `broken` multiplies by **x0.5** -- a real, meaningfully harsh penalty (a
  dead application link is nearly useless to a member) that still stops
  short of `validateJob()`'s floor-to-0 treatment for structural failures.
  The reasoning asked for explicitly: floor-to-0 means "structurally
  unusable, can't even be displayed" (missing company/title/employment
  type/URL/source); a broken link is a *live-health* signal about an
  otherwise well-formed record that can and does recover (`check-job-links`
  has its own `recovered` counter for exactly this). A flat-point
  subtraction was considered and rejected -- against this app's real score
  range (observed live: ~0.2-0.59 pre-change) a flat penalty large enough
  to feel "meaningful" would have clustered nearly every broken job at the
  literal 0 floor, making the two cases indistinguishable in practice even
  though the formula never says `return 0`. Multiplicative halving instead
  scales with the job's own underlying completeness/confidence -- a broken
  link on an otherwise-complete listing still outranks a broken link on a
  sparse one -- and, since a job that passes `validateJob()` can never have
  a completeness/confidence base of exactly 0 (confidence alone floors at
  0.5, see `normalize.ts`), a halved score can mathematically never land on
  the exact 0 `validateJob()` uses. That floor stays a distinct,
  unambiguous signal from this one.

Implementation kept byte-for-byte in sync across both copies as always
(`server/src/quality.ts` / `supabase/functions/_shared/pipeline/quality.ts`)
-- diffed after editing to confirm only the pre-existing, unrelated
header-comment/lint-comment differences remain. Added an optional
`linkHealth?: "unchecked" | "ok" | "broken" | null` field to `NormalizedJob`
(both `types.ts` copies) rather than changing `scoreQuality()`'s signature
-- every real call site (`fetch-greenhouse-companies`, `fetch-deloitte-jobs`,
`approve-submission`) calls it once, at insert time, on a brand-new record
that has no link-health history yet, so this field is simply absent/
`undefined` (= neutral, x1) on every one of them today; it exists purely so
the retroactive-recompute path below (and any future caller with a real
`link_health` in hand) can pass it through.

**Comment updated.** `quality.ts`'s stale "aren't meaningful yet... not
simulated here" line is gone, replaced with the weighting rationale above.

**Tests** (`server/tests/quality.test.ts`): 5 new cases under a
`describe("link health (US-52)")` block -- unchecked (both omitted-field
and explicit `"unchecked"`) produces an identical score to the pre-change
formula; `ok` scores strictly higher than the same job without it; the
`ok` multiplier clamps at 1 rather than exceeding it; `broken` scores
strictly lower and matches the x0.5 halving to 2 decimals; and a broken
link on an otherwise-valid sparse job never reaches the exact 0 floor,
while a genuinely invalid job stays at exactly 0 regardless of link
health. `npm run test:server`: **108/108 green** (103 pre-existing + 5
new, all pre-existing suites untouched). `npm run typecheck:server`:
clean.

**Deployed.** Checked which Edge Functions actually call `scoreQuality()`
before deploying anything, rather than assuming: `fetch-greenhouse-
companies`, `fetch-deloitte-jobs`, and `approve-submission` all import and
call it (each once, at insert time, per above). `check-job-links` does
**not** call it at all -- confirmed by inspection, it only ever calls
`mark_link_check_results` -- so it was deliberately left undeployed this
pass; nothing in its own code path changed. All three redeployed
`--use-api`; `fetch-deloitte-jobs` was invoked live afterward as a smoke
test (`fetched: 44, inserted: 0, refreshed: 34, ...`) to confirm the
deploy runs clean end-to-end, not just that the deploy command succeeded.

**Retroactive recompute, done.** `quality_score` is only ever computed at
insert time (none of the three callers above recompute it on a refresh),
so every job `check-job-links` had already checked before this change was
carrying a score from the old formula -- a real gap, closed with a
one-time recompute rather than left to drift back into sync slowly as
jobs happen to get re-inserted (they mostly don't; refreshes update
`active`/`status`, not `quality_score`). Live query before any change
confirmed the shape of the problem and why a blanket recompute is safe:
`quality_score` is never `0` or `null` for any real row in the table today
(`validateJob()` floors invalid records to 0, and nothing invalid actually
gets inserted) -- so every `link_health != 'unchecked'` row's stored score
is a legitimate pre-change formula output, safe to scale directly by the
same multiplier `scoreQuality()` now applies, with no need to reconstruct
a full `NormalizedJob` per row.

Computed client-side in Node (same avoid-a-Postgres-dialect-mismatch
precedent as the company-cap migration above) against a live pull of every
job's `id`/`link_health`/`quality_score` where `link_health != 'unchecked'`
(1,542 rows: 1,529 `ok`, 13 `broken`; 788 `unchecked` rows correctly left
untouched, confirmed still exactly x1/no-op by design). Written as
migration `20260831220000_recompute_quality_score_link_health.sql` -- a
single `update jobs ... from (values (id, new_score), ...)` join over all
1,542 rows, applied via `npx supabase db push --linked`.

**Real live before/after, verified by direct query after the push, not
assumed:**

| Job | Company | link_health | Before | After |
|---|---|---|---|---|
| `ba4595d8...` (Lead Architect FY27) | Deloitte | broken | 0.52 | **0.26** |
| `408114d3...` (Regional Workplace Ops Manager) | Airbnb | broken | 0.45 | **0.23** |
| `3a8b1108...` (Enterprise AE - Public Sector) | Databricks | broken | 0.27 | **0.14** |
| `11df45ef...` | Robinhood | ok | 0.59 | **0.65** |
| `afdc8928...` | Stripe | ok | 0.59 | **0.65** |
| `52908e54...` | Charlie Health | ok | 0.59 | **0.65** |

Every broken-link example lands below its pre-change score by almost
exactly half (matching the x0.5 multiplier, small rounding aside); every
ok example ticks up by the expected ~10%, capped well under 1. Aggregate
`link_health`-grouped stats before/after (live queries):

| link_health | Before: avg / min / max | After: avg / min / max |
|---|---|---|
| unchecked | 0.348 / 0.20 / 0.59 | 0.346 / 0.20 / 0.59 (unchanged by design; small count drift is the daily cron rotating jobs through, not this migration) |
| ok | 0.277 / 0.20 / 0.59 | 0.305 / **0.22** / **0.65** |
| broken | 0.255 / 0.20 / 0.52 | 0.128 / **0.10** / **0.26** |

No negative scores, nothing above 1, no `null`s introduced, no errors
during the push -- confirmed via the same aggregate query run before and
after. `unchecked` group's avg staying flat (0.348 -> 0.346, not exactly
identical only because the live active set itself shifted slightly
between the two queries, not because any unchecked row's score moved) is
the clearest confirmation the neutral-multiplier design is doing exactly
what it was meant to: the 788-815 jobs nobody has checked yet were never
touched.

**Known, narrow, accepted gap, named rather than silently left:** a job
link-checked for the *first time* after this deploy still won't have its
`quality_score` recomputed by that check alone, since `check-job-links`
never calls `scoreQuality()` (confirmed above) -- only this one-time
migration closed the backlog that existed *before* the code change. In
practice this stays a narrow gap: a job's completeness/confidence base
never changes after insert, so the only value that can go stale is the
small link-health adjustment on top of it, and it self-heals the moment
that job is genuinely re-inserted by a future fetch run. Re-running this
same style of one-time recompute is the correct fix if that staleness
ever becomes a real problem -- not a reason to add a `scoreQuality()` call
to `check-job-links`'s daily run today, which would cost an extra
per-row round trip for a cosmetic/tie-break-only field on every one of
~3,300+ active jobs, every single day, for no real product benefit.

Committed and pushed per standing permission for this repo.
