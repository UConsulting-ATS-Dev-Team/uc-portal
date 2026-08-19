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

Stage 1          Synthetic dataset (100-500 jobs, deliberately duplicated/
                 malformed, per your ask in point 18) + Postgres schema +
                 normalization/dedup/search/ranking built and tested
                 against it. No real source yet -- prove the pipeline in
                 isolation first.

Stage 2 (MVP)    Real admin + member submission forms, real users, real
                 search, real matching against real member preferences,
                 admin review dashboard live in production.

Stage 3          First automated source: one employer ATS API adapter,
                 for one company, only after that deployment's terms are
                 individually confirmed. Prove the full pipeline handles
                 a real automated feed end to end, source registry kill-
                 switch tested.

Stage 4          Additional ATS adapters for other UC-target companies;
                 RSS/institutional feeds where available; evaluate a
                 licensed provider only if coverage is still insufficient.

Stage 5          LLM-assisted classification fallback for the long tail;
                 natural-language search; ranking-weight tuning from real
                 engagement data; real CRM integration replacing the
                 mocked alumni/connection data.
```

---

## Open questions for you

1. Where should the backend actually live — a `server/` or `api/`
   directory inside this same repo, or a separate service/repo? (My
   default recommendation: separate from the React frontend code, since
   it's a genuinely different runtime/deploy target, but same
   organization/monorepo is fine too if that's simpler for the team to
   manage.)
2. Backend language: I'd lean **Python (FastAPI)** for the ingestion/
   enrichment pipeline specifically — strong ecosystem for text
   normalization, scheduling, and LLM SDK usage, and most CS curricula
   teach it early, which matters for "future freshmen can pick this up."
   The alternative is Node/TypeScript, for one language across the whole
   stack. Want me to just pick one, or do you have a preference?
3. Hosting: Railway or Render for Postgres + backend (cheap, low-ops,
   good docs) — reasonable default, but flag if UC already has hosting
   infrastructure or preferences from another initiative.

Nothing here is implemented. Let me know what to adjust before we move
into Stage 1.
