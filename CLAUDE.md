# UC Portal — Project Notes

## Purpose

**UC Portal** is a private, members-only career and professional-development
hub for UConsulting (UC), a university consulting club. It replaces the
spreadsheets/group-chats/Handshake/Drive mix members currently use with one
place that carries UC's own private data — which alumni work where, what UC
applicants actually experienced in interviews, and how past UC members
performed at each firm.

Two audiences:
- **Members** (class years ~2026–2029) — find opportunities, track
  applications, meet alumni, work through learning tracks/certifications.
- **Leadership** (Exec + Careers Committee) — see aggregate member interest,
  approve postings, manage content and access.

Three intertwined jobs, not just a job board: **recruiting** (jobs, tracker,
deadlines), **networking** (alumni directory, coffee chats, messages), and
**education** (learning tracks, free certifications, resource library).
Every job/company/resource is annotated with UC's own private data — that
annotation is the product's differentiator.

**Current reality (2026-10-03):** this started as a clickable prototype but
is now a real, deployed app on a real Supabase backend (Postgres + RLS, Auth,
Storage, Edge Functions, pg_cron) with real sign-in, a real roster gate, and
real member data. The wireframe-derived sections below (navigation shell, page
inventory, odds model, design conventions) are still the spec; "Current state"
near the end of this file says what has changed since, and
[PROGRESS_LOG.md](PROGRESS_LOG.md) holds the full history (its early entries
describe a mock-data prototype and name files that no longer exist). Real
member data is never committed to git.

## Source

Wireframes: [design/handoff/UC Career Platform Wireframes.dc.html](design/handoff/UC%20Career%20Platform%20Wireframes.dc.html)
(24 screens, single scrollable canvas, Industry design system) plus its
handoff [README.md](design/handoff/README.md), which is the authoritative
spec — this file summarizes it, but defer to the handoff README for exact
copy, field lists, and behavior detail. Note: the wireframe source files
themselves still say "UC Career" throughout (their original working
title) — the product was renamed **UC Portal** after the handoff was
exported, so treat every "UC Career" in design/handoff/ as this product.

## Navigation shell (shared by every authenticated screen)

- **Top bar** (~52px): UC Portal brandmark (left) → global search (~300px,
  "Search jobs, people, companies…", submits to Global search `3b`) →
  notifications (unread count) → user avatar menu (profile/settings/sign out).
- **Left nav rail** (~206px, full height): Home · Jobs · Applications (count
  badge) · Network · Feed · Companies · Career Resources · My Profile. Below
  a hairline + "LEADERSHIP" label, visible only to Exec/Careers Committee:
  Admin Dashboard · Opportunities · Members · Content. Bottom: club stats
  strip ("142 members · 380 alumni · invite only").
- Active rail item: tinted background + 2px accent left border + heavier
  weight. Two alternatives (top-bar-only nav, icon rail w/ contextual
  column) were explicitly rejected — left rail is final.
- **Content area**: main column + fixed-width right rail (250–300px) on
  most screens; Jobs/Companies add a second fixed filter column
  (230–248px) between nav rail and main content.
- **Responsive**: the wireframes design for 1280px+ only, but every page
  now has real breakpoint reflow rather than the `zoom`-based scale-to-fit
  stopgap this section used to describe (that rule is gone from
  `styles/global.css` entirely). One consistent breakpoint scale, defined
  once in `styles/shell.css`'s own comment and referenced by name in every
  other stylesheet that adds responsive rules:
  - **1280px+** — desktop, the design's native/unmodified width.
  - **1100px** — the nav rail collapses to icon-only
    (`--nav-rail-width-collapsed` in `styles/tokens.css`), using
    `lucide-react` icons (stroke-width 1.5, the system CLAUDE.md's Icons
    line already named as the target) since the wireframes only ever had
    text-label placeholders.
  - **900px** — multi-column layouts (filter columns, right rails,
    detail-page sidebars) stop sitting beside main content and stack
    below it instead.
  - **640px** — phone-width tightening: padding shrinks, grids drop to
    fewer columns, the top bar sheds its wordmark/search placeholder.
  Wide tables (tracker, certifications, admin queues) scroll horizontally
  within their own container instead of widening the page, matching the
  pattern the Board/Timeline tracker views already used. Verified live
  page-by-page at both the 900px and 640px tiers (zero
  `document.documentElement.scrollWidth` overflow, no console errors).

  **Correction, 2026-09-14**: this paragraph used to end by claiming
  "nothing here is phone-first" and that Messages had no real show-list/
  show-thread toggle state — both wrong, and had been wrong since
  2026-09-08. A real Phone UX pass shipped the same day as the responsive
  redesign above (11 commits: 44px touch targets app-wide, Messages' real
  `mobileView` toggle, a bottom tab bar replacing the persistent rail
  below 1100px, collapsible filter sidebars on Jobs/Companies, a
  collapsible categories nav on Career Resources, and a real, widespread
  CSS Grid overflow bug fix) — it just never got logged here, so this
  section kept describing shipped work as unscoped for six days. A fresh
  live pass at 375px on 2026-09-14 re-confirmed every piece is still
  genuinely working (see the dedicated entry in PROGRESS_LOG.md for the full
  page-by-page verification). What's still genuinely unscoped: gesture
  nav (swipe-back, swipe-between-tabs, etc. — never built, confirmed via
  a zero-match code search for any touch/swipe handler anywhere).

## Page inventory & flow

**Access gate** (`3a`) — Sign in (university Google or email/password) →
if not on roster, "Not on the roster" request-access state → "Access
pending" state → once approved, first-time members land in **Onboarding**.

**Onboarding** (`2i`/`2j`, 5 steps + completion) — persistent 5-segment
progress indicator, "Save & finish later", Back/Continue footer:
1. You (confirm roster info, optional resume upload)
2. Industries (rank up to 3, shows UC member/alumni counts per industry)
3. Roles & locations (role chips, location chips, live "matches 46 open
   roles / 23 alumni" payoff card that updates as answers change)
4. Companies (suggested by UC alumni presence, follow toggle)
5. Timeline (recruiting cycle + "what would help most" → seeds learning
   tracks)
   → **Completion** screen (payoff stats + 3 concrete first actions) →
   routes to Home dashboard.

**Main app** (rail order):
1. **Home / Dashboard** (`1a`) — welcome card, recommended jobs, recruiting
   progress (stat strip + attention-needing applications), UC feed preview.
   Right rail: recommended actions, people to meet, deadlines this week.
2. **Jobs / job board** (`1d`, *highest priority screen*) — filter column
   (UC advantage, type, grad year, industry, location/work mode,
   compensation slider, deadline, company size) + job cards with match
   score, UC-posted flag, UC-intelligence footer (connections, past-cycle
   outcomes). Tabs: Recommended / UC-posted / All / Saved.
   - **Job detail** (`1e`) — header/apply actions, match checklist, **the
     odds model** (see below), role description, UC recruiting
     intelligence (stat strip, stage timeline, member interview
     write-ups). Right rail: UC members at company, prep resources,
     similar roles.
3. **Applications tracker** (`1f`/`1g`/`1j`, one page, Board/Table/Timeline
   toggle, shared stage taxonomy `Interested → Preparing → Applied →
   Assessment → First round → Final round → Closed`):
   - Board: 7 stage columns, draggable cards.
   - Table: sortable rows, CSV export, calendar sync.
   - Timeline: Gantt-style over the recruiting cycle, rows grouped by
     stage, draggable bars, dashed projected stages, diamond event marks.
4. **Network** (`1h`) — alumni/member directory, filters, coffee-chat
   status, suggested connections.
   - **Member/alumni profile** (`1i`) — shared UC context, experience,
     "happy to help with" checklist.
5. **Feed** (`2a`) — composer (post job/write-up/question/event), tabbed
   posts, "helpful" reactions (deliberately not "like").
6. **Companies** (`2b`) — directory with UC-specific filters/stats.
   - **Company page** (`2c`) — tabs: Overview / Opportunities / UC
     connections / Recruiting intelligence / Activity.
7. **Career Resources** (`2d`, the education hub) — categories +
   skills/certifications nav, recommended tiles, learning tracks, free
   certifications table, most-used/recently-added resources.
   - **Resource detail** (`2e`) — contents checklist, UC-specific outcome
     notes, progress tracking, "log prep time".
   - **Learning track detail** (`3d`) — 12-step checklist mixing reading,
     drills, peer sessions, and live events.
8. **My Profile / preferences** (`2g`) — personal info, ranked/draggable
   career preferences (drives recommendations), recruiting/privacy
   settings, quarterly re-confirmation banner.

**Leadership only** (below the "LEADERSHIP" divider):
- **Admin Dashboard** (`2h`) — KPI strip, "where members want to work" gap
  analysis, class-year breakdown, opportunity review queue. Admins see
  **aggregate only, never an individual's application list** — this
  privacy boundary is explicit in both `2g` and `2h` copy.

**Cross-cutting / utility screens:**
- **Global search** (`3b`) — tabbed results (All/Jobs/People/Companies/
  Resources/Feed), grouped by type, diagnostic no-results state.
- **Action modals** (`3c`) — Request coffee chat · Add application · Post
  opportunity (goes to Careers Committee review queue) · Contribute to
  library · Log prep time (shows odds-estimate effect of logging).
- **Notifications** (`2f`) — Needs action (accent rows w/ inline actions) +
  lower-density recent activity. Top-bar badge = "Needs action" count.
- **Messages** (`3f`) — two-pane conversation list + thread, inline shared
  resource cards.
- **Empty/first-run states** (`3e`) — pattern: name the situation, explain
  why in UC terms, quantify what's available, one primary + one secondary
  action. Never a bare "No data." Applies to Home (first login), empty
  Applications, zero-result Jobs (diagnostic — names which filter to
  drop), no-connections Network, and a generic error state.

## The odds model (job detail `1e`) — signature feature

Left panel: headline probability estimate (large, accent) + 3 comparison
rows (open-market baseline, past UC applicants at that company, member's
UC percentile) — the baseline comparison is what keeps a low percentage
from reading as simply discouraging.

Right: factor table — UC track record (30%), Prep logged (25%), Networking
depth (20%), Profile/resume fit (15%), Timing of application (10%) — each
with a "where you stand" signal and a contribution bar (accent = strength,
neutral = weakness). Below it, a "biggest lever" callout naming the
highest-marginal-value action with a quantified effect
("→ estimated 38%").

Recomputes whenever inputs change (e.g. logging prep time animates the
figure). Every number must be traceable to something visible elsewhere in
the app (no invented/opaque inputs).

**Sparse-data handling — decided; see "Odds model sparse-data rule" under
Decisions.**

## Design conventions

Layout/shape/spacing come from the wireframe handoff's Industry design
system (design/handoff/). Colors, fonts, and the wordmark are UC's real
brand, from the 2020 style guide (design/branding/UConsulting Style.pdf —
UConsulting Drive > Committees > Marketing > Branding, accessed read-only).

- **Palette (UC brand)**: primary navy `#042742` (headings, most text,
  primary elements), accent blue `#0C74C1` (accents — links, active
  states, CTAs). Neutrals/surfaces borrowed from the wireframes' grayscale
  since UC's style guide doesn't define a full neutral scale — darkened
  once, Sept 2026, for a real contrast problem (a member-reported "the
  gray is very light"; text-muted was failing WCAG AA's 4.5:1 minimum for
  the 11-13px sizes it's used at, verified against the actual contrast
  formula, not eyeballed): ground `#f2f2f3`, surface `#ffffff`, borders
  `#b8b8bc`, inner rules `#d3d3d7`, table headers `#f5f5f8`, muted text
  `#5c5c60`, placeholder text `#7d7d80`, neutral `#6e6e72`. Only the
  ground/surface backgrounds are untouched — see `styles/tokens.css`'s own
  comment for the full before/after and reasoning.
- **Type (UC brand)**: Montserrat Bold for headings, Montserrat **Regular**
  for body (loaded via Google Fonts) — the style guide's literal spec was
  Montserrat Light, changed Sept 2026 per the same contrast/legibility
  report ("the font is very thin"), a direct override of the guide's
  weight choice, not a mechanical fix. Size scale borrowed from the
  wireframes since the style guide doesn't specify sizes: body 13px,
  secondary 12px, meta 11px, section kickers 9.5px uppercase (0.12em
  tracking), page titles 22–30px, display numerals 20–46px.
- **Logo**: wordmark is "UConsulting" in Montserrat Bold, the "U"
  recolored to accent blue, rest in primary navy (style guide's
  reproduction rule) — built as CSS/markup, no image needed. There's also
  a bear-icon mark (line art, used standalone or in a filled navy square)
  for the "square mark" the wireframe's nav brandmark calls for — not yet
  pulled into `assets/` as an image file; flag if you want
  `UC Logo.png` (8.5 KB, from the same Branding folder) added for that.
- **Shape**: square corners everywhere (0 radius), 1px hairline borders,
  2–3px accent left borders for emphasis (active nav item, featured
  cards, UC-posted job cards), flat surfaces, no shadows.
- **Spacing rhythm**: 6/7/9/11/14/16/20/24px.
- **Icons**: wireframes use text labels / plain squares as stand-ins;
  target system is Lucide at stroke-width 1.5.
- **Recurring patterns**: stat strips (3–5 cells across the top of a
  section), chip rows for attributes/filters, overlapping-avatar clusters
  for "N UC connections", progress bars paired with a fraction/percentage,
  card footers with a primary + secondary action, loading = skeleton bars
  in the same hairline card frame (never a spinner).

## Decisions

- **Odds model sparse-data rule** — below the suggested minimum sample
  (~5 applications at a company), the "UC track record" factor still
  renders (contribution bar included), but is visibly flagged as
  low-confidence (e.g. "n=1 · limited data") rather than suppressed or
  silently blended into the industry mean. Preserves the "every number is
  traceable" principle while not overstating certainty on thin data.
- **Stack** — React (Vite + React Router), no backend. See below.
- **Brand** — real UC colors/fonts (navy `#042742`, blue `#0C74C1`,
  Montserrat) applied in [styles/tokens.css](styles/tokens.css), replacing
  the wireframes' placeholder steel-blue/Barlow. Source: 2020 style guide
  in the club's Google Drive, read-only access. Layout/shape conventions
  stay from the wireframes' Industry system (the brand guide doesn't
  cover those).

## Still open / to confirm as we build

1. **Mobile** — the real responsive redesign is done (see the Responsive
   note above): every page and all 6 action modals reflow at 1100/900/
   640px instead of scaling via the old `zoom` stopgap. **Correction,
   2026-09-14**: this section used to also claim phone-first UX itself
   (touch targets, a real Messages show-list/show-thread toggle) was
   entirely unscoped — that was stale. A real, dedicated "Phone UX pass"
   (11 commits, 2026-09-08, MVP day) shipped all of that; it just never
   got a Progress-log entry here, so this section kept describing it as
   not-yet-started for six days after it was actually done. See the
   PROGRESS_LOG.md entry ("Phone UX pass: rediscovered, re-verified live,
   and the actual remaining gap closed") for what was already real and
   what a fresh live pass at 375px confirmed still holds. The gesture-nav
   gap that pass flagged is now also closed for the piece that actually
   mattered — the Applications Board's drag interaction didn't work on
   touch at all, and neither Table nor Timeline offered any other way to
   change a tracked application's stage, so a real member couldn't
   change stage on a phone from any view. See "Gesture nav, scoped and
   built" in PROGRESS_LOG.md. Pull-to-refresh and swipe-between-tabs were built later, and
   swipe-to-delete was superseded by real message archiving (all in
   PROGRESS_LOG.md).
2. **People avatars** — real profile photos exist (self-upload, plus real
   headshots imported for current members from the club's public team
   page). Still text-initials: any real person with no photo yet, notably
   every real alumnus (the team page only covers current members). The
   fictional mock people are gone entirely.

## Stack

**React (Vite + React Router) on a real Supabase backend.** Chosen over plain
HTML/JS once the true scope (24 screens, heavy shared chrome — nav shell,
job/person/resource cards, chips, modals — plus state that must stay in sync
across pages) became clear from the wireframe handoff. Shared app state lives
in `data/store.jsx` (React Context, cached in `localStorage` and synced to
Supabase per slice); data access lives in `data/*Sync.js` modules; the job
ingestion pipeline runs as scheduled Edge Functions (see
`JOB_ENGINE_ARCHITECTURE.md`).

Structure:
- `index.html` / `main.jsx` / `App.jsx` — entry point + router setup
- `pages/` — one component per route/screen (e.g. `Jobs.jsx`, `RealJobDetail.jsx`)
- `components/` — shared UI (nav shell, cards, chips, modals, stat strips)
- `styles/tokens.css` — design tokens (light + dark)
- `styles/global.css` — base reset/typography
- `assets/` — icons, logos
- `data/` — data modules: `*Sync.js` (Supabase access), `store.jsx`, pure
  helpers, and the few remaining static modules (`mockCompanies.js`,
  `mockUser.js`, `mockAdmin.js`, `certifications.js`, `careerOptions.js`)
- `supabase/migrations/` — schema; `supabase/functions/` — Edge Functions

## Current state (2026-10-03)

Trust this section over the older entries in [PROGRESS_LOG.md](PROGRESS_LOG.md),
which are chronological and not rewritten when later work supersedes them.

- **Gone entirely** (do not look for them): `data/mockJobs.js`,
  `data/mockPeople.js`, `data/peopleUtils.js`, `data/mockResources.js`,
  `data/mockFeed.js`, `data/mockMessages.js`, `data/oddsModel.js` (the mock
  odds model), `data/companyUtils.js`, `pages/JobDetail.jsx`. Every job,
  person, resource, feed post and message in the app is real.
- **Still static on purpose:** the 8 hand-curated companies in
  `data/mockCompanies.js` (Bain, McKinsey, BCG, Deloitte, Stripe, Goldman,
  EY-Parthenon, Accenture) — several don't post on the public job boards the
  pipeline ingests, so they'd otherwise have no page. Their numbers are all
  computed from real data; only the descriptions are hand-written. Also
  `data/certifications.js` (real third-party free courses) and
  `data/careerOptions.js` (option lists only, no counts).
- **Career Resources** is a real admin-managed library (`library_resources`,
  `learning_tracks`, edited at `/admin/library`), not the old static list.
- **Applications tracker** resolves tracked jobs against real jobs or manual
  entries only; "Add application" never offers a fictional job.
- **Messaging** works between accounts; a message to a directory person with
  no account waits in `pending_messages` and is delivered on signup. Admins can
  pre-create accounts (no email is ever sent; people claim them via "Forgot
  your password?"). **The app never emails anyone to claim an account — don't
  add bulk claim emails without asking.**
- **Accounts:** two independent axes on `profiles`. `role` = `member`|`admin`
  (access level); `member_status` = `current_member`|`alumni`|`intern`
  (membership). Only an admin can change either (trigger
  `prevent_role_self_escalation()` clamps self-edits). Signup is gated by
  `can_sign_up()` (roster, or a directory `people` row with status Alumni, or
  `intern_roster`); `handle_new_user()` sets `member_status`.
- **Route guards** (guard the route, don't just hide the link): `RequireAuth`;
  `RequireCurrentMember` (alumni go to `/feed`); `RequireNotIntern` (interns
  only reach `/accelerator`, `/profile`, `/onboarding`); `RequireAdmin`
  (`/admin/*`, renders nothing while `realRole` is unresolved). Nav item sets
  live in `data/navItems.js` (`mainItemsFor`, `INTERN_ITEMS`).
- **Admin "View as"** (`components/ViewAsMenu.jsx`): client-only,
  sessionStorage-backed simulation of member/alumni/intern. It only changes
  `isAdmin`/`isAlumni`/`isIntern`; real RLS and `is_admin()` RPCs always use the
  true session, and the control itself gates on `realIsAdmin`.
- **Admin surface:** `/admin` (dashboard: pipeline health, review queues,
  company tiers, signups, feature requests, client errors, weekly-digest
  preview), `/admin/opportunities` (job sources), `/admin/members` (roles, mark
  alumni, graduate intern, account setup), `/admin/content` (moderation),
  `/admin/library`, `/admin/accelerator`.
- **Scheduled work:** 7 pg_cron jobs call Edge Functions (Greenhouse, Lever,
  Ashby, Deloitte, link-health, board snapshot, weekly digest), each guarded by an
  `X-Cron-Secret` header (secret in Supabase Vault and as an Edge Function
  secret). `pg_net` delivers each call twice; `cron_run_locks` suppresses the
  duplicate. Health shows on Admin Dashboard's "Pipeline health". Pipeline
  detail lives in [JOB_ENGINE_ARCHITECTURE.md](JOB_ENGINE_ARCHITECTURE.md).
  Greenhouse runs in batches (`{"batch": 20}` every 2 hours; Ashby `{"batch": 8}` hourly at :47; stalest companies first;
  size a batch so batch x runs/day covers every enabled company inside the 26h coverage window) because one
  all-companies run exceeds the Edge Function limit and silently stalled; anything that scales with
  company count must be batched. A scheduled call always reads as a pg_net timeout, so judge it by
  `source_fetch_log`, not `net._http_response`.
- **Orphaned jobs (fixed 2026-10-03):** the fetchers used to insert a run's new jobs and their `job_sources`
  rows as two requests, and an interrupted run left jobs with no source row that never expired or got capped
  (about half the active board). New jobs and their sources now go in together via `insert_jobs_with_sources()`,
  and the existing orphans were cleaned up reversibly (`orphan_cleanup_backup`, `revert_orphan_cleanup()`).
  Detail in JOB_ENGINE_ARCHITECTURE.md's 2026-10-03 addendum.
- **The active-job count is falling on purpose:** it was 11,261 on 2026-10-01 (uncapped companies, orphans, dead
  postings), 2,427 after the 2026-10-03 backlog drain (every enabled company fetched once), and settles near ~1,500 once
  every company has been re-fetched and capped (tier caps 25 / 15 / 10 / 5;
  tier 3 was 3 until 2026-10-03). A cap change needs no restore step: every fetch re-activates all tracked jobs still
  on the employer's board and then re-trims to the current cap, so it applies at each company's next fetch.
  The batched Greenhouse schedule was confirmed working on 2026-10-03. Don't treat the shrinkage as a bug; to change
  it, change the tier caps or a company's tier.
- **Closed jobs a member tracked or saved stay visible.** `jobs` is otherwise readable by members only while `active`;
  the `jobs_select_own_tracked_or_saved` policy also lets a member read an inactive job that is in their OWN tracker or
  saved list. `useRealJobs` returns `realJobs` (open postings only: recommendations, new matches, deadlines) and
  `allKnownJobs` (also the member's closed ones: use it to RESOLVE their own ids). Closed jobs carry `closed: true` and
  render as "Posting closed". Never use `realJobs.find(id)` to resolve a tracked or saved job.
- **Job sources: Greenhouse, Lever and Ashby (2026-10-03), plus Y Combinator tagging.** Each is a `sources` row
  (`employer_api`, `config` = `{platform, slug, company}`; Greenhouse may add `board_name`, the board's own spelling of the
  company, because the fetcher refuses a posting whose self-reported `company_name` differs). `fetch-ashby-companies` mirrors
  the others; its field mapping lives in `_shared/ashbyAdapter.ts` (tested) and it skips Contract/Temporary postings. Lever and
  Ashby postings carry no company name, so a person must confirm identity when adding one. To add companies: probe the board,
  check the company, run its titles through `isLikelySeniorRole`/`isLikelyNonCorporateRole`, then insert the source and a
  `company_tiers` row in a migration (the batched cron picks it up; never-fetched sources go first). `company_yc` maps a company
  name (exactly as `jobs.company` has it) to its YC batch; it drives the "YC W12" chip (`useYcCompanies`) and the Jobs
  "Backed by > Y Combinator" filter. Prominent YC companies with no guessable public board (Rippling, Deel, Retool, Whatnot) are
  not tracked.
- **New roles and alerts (2026-10-03).** `jobs.created_at` is when the board first listed a job (`addedAt` on cards; the
  employer's posted date can be backdated). `data/jobVisit.js` holds a per-account baseline in localStorage (the previous
  visit's last activity; a visit is activity with gaps under 30 min; 14 days max look-back, 7 on a first visit). It drives the
  Jobs "New since your last visit" tab (`?tab=new`), the "New" chip, a Home link and three derived Notifications alerts
  (followed companies, 70%+ matches, saved searches via `?savedSearch=<id>`), which honor the "New matched jobs" setting.
  Nothing is emailed. The Jobs filter predicate lives in `data/jobFilters.js` (shared with notifications). Saved searches are
  still browser-local. `member_preferences.prefer_yc` (My Profile / onboarding step 4) adds a weight-10 `yc` factor to
  `matchJob()` only for members who turned it on; `matchJob`'s 5th argument is the company's YC batch.
- **Preference options only count if something matches them (2026-10-03).** Option lists live in `data/careerOptions.js`
  (67 industries, 46 roles, 90 locations incl. metros, 78 skills). Matching is client-side in `data/jobMatch.js`:
  industries by job TITLE (`data/industryPatterns.js`, also used by the Jobs industry filter), skills implied by title
  (`data/skillInference.js`), locations against every place a job lists (`data/locationUtils.js`; metros expand to member
  cities). A job's places are `jobs.locations`, written by `normalizeLocation()` (two mirrored copies) at insert and filled in
  for existing jobs by the Greenhouse/Lever fetchers from each company's next fetch (`apply_job_locations`, only rows whose
  `locations` is NULL; raw feed text is never stored). When adding an option, add its matcher in the same change -- tests
  fail if an industry has no title patterns or a skill is implied by no title. Companies a member can follow come from
  `company_tiers` (`useKnownCompanies`), so the string equals what jobs carry.
- **Member state follows the signed-in account (fixed 2026-10-03):** `AppStateProvider` hydrates tracked jobs, saved
  jobs, preferences, network and profile in one effect keyed on the signed-in user id, so it re-runs on sign-in, sign-out
  and a different member signing in -- not just when the app first mounts. A user change resets the in-memory state first
  (`uc-portal-state-owner` records whose cache it is), both background syncs stay off until their own fetch has finished,
  and a fetch that resolves after the account changed is discarded. It used to hydrate once at mount, which left a
  same-page sign-in with empty state and let a change made before a reload overwrite the real remote row.
- **Pipeline health reports coverage, and flags dead boards.** For the batched adapters (Greenhouse, Lever) Admin >
  Pipeline health shows how many enabled companies had a successful fetch in the last 26h and goes Stale under 90%.
  A source whose last 3 fetches all failed with HTTP 404 is listed under "Boards that look gone" with a
  confirm-then-disable button (`list_dead_sources` / `disable_dead_source`); disabling is always a human action.
- **Broken apply links:** a job flagged broken that came from Greenhouse also offers Greenhouse's own application
  page (`job_apply_fallback`). It only reaches a real page for the few jobs that are live with a misconfigured
  employer wrapper; for closed jobs it lands on the company's board.
- **Loading state:** the store exposes `memberDataLoading` (true until the member's remote data has settled); use it
  instead of rendering an empty state for something that simply hasn't arrived yet.
- **Repo & deploys:** public at github.com/UConsulting-ATS-Dev-Team/uc-portal
  (history was rewritten once to scrub real PII). The frontend deploys to
  Vercel on push to `master`. Backend changes are separate steps:
  `supabase db push` for migrations and `supabase functions deploy <name>` for
  Edge Functions.

## Working agreements & operational playbook

**Standing rules**
- **Real member data is never committed to git** — no emails, names, or
  directory rows in migrations, fixtures, or docs. Seed real data only with
  `scripts/seed-real-directory.mjs` against a gitignored CSV
  (`scripts/directory-export.csv`). A one-off data migration that touches real
  people is applied with `db push` and then deleted locally, never `git add`ed.
- **No fabricated data.** If something has no real source, show an honest empty
  or "not on file" state instead of a plausible-looking number, name, or quote.
- **No reassurance copy** — cut UI text whose only job is to convince the reader
  something is legitimate or trustworthy.
- **Cloud sessions** can build and type-check but have no Supabase credentials:
  migrations they write must be applied from a local session, and nothing they
  ship has been tested against the live database unless a local session says
  so. Both append history, so expect trivial merge conflicts at the end of
  `PROGRESS_LOG.md` — keep both sides.
- Never click an admin bulk action (e.g. "Pre-create … accounts") against the
  real roster while testing; invoke Edge Functions scoped to one synthetic
  address instead.

**Verifying against the live database with a throwaway account**
- Create the account in a temporary migration: insert into `roster` (or
  `intern_roster`, or a `people` Alumni row) **first** — the
  `before_auth_user_created` trigger checks it — then `auth.users` with
  `extensions.crypt('<pw>', extensions.gen_salt('bf'))` (pgcrypto lives in the
  `extensions` schema), `email_confirmed_at = now()`, and every token column set
  to `''` (null breaks GoTrue's schema scan). Direct inserts accept `.invalid`
  emails; real `signUp()` rejects `.invalid` and `@example.com`.
- `supabase db push`, test, then **delete the temp file and run
  `supabase migration repair --status reverted <versions>` immediately** —
  otherwise the next push fails with `LegacyDbPushMissingLocalError`.
- Clean up with a plain-delete migration plus a **separate** read-only verify
  migration ending in `raise exception 'VERIFY: …'` (a failed migration isn't
  recorded, so it needs no repair). A `raise exception` in the same migration as
  the deletes rolls the deletes back.
- For logic-only checks, a self-cleaning `do $$ … raise exception 'RESULT' $$`
  rolls everything back. To impersonate a user, `set_config` both
  `request.jwt.claims` and `request.jwt.claim.sub` (local) and
  `set local role authenticated`; return with
  `execute 'set local role ' || quote_ident(orig)` where `orig := current_user`
  (plain `RESET ROLE` doesn't restore the migration role). RLS denial on
  UPDATE/DELETE affects zero rows rather than raising — assert on the row
  effect. `authenticated` has no UPDATE grant on most tables, so set timestamps
  at insert time.
- `net.http_post` is asynchronous: fire it in one migration that commits, check
  the outcome in a later one. Never read a secret into a variable or output;
  pass it inline from `vault.decrypted_secrets`.
- Generate the throwaway password locally, keep it in the scratchpad, and delete
  it afterward.

**Browser testing quirks (built-in browser pane)**
- Click by `ref` from `read_page` (`filter: interactive`); `find` is unreliable
  and coordinate clicks need a fresh screenshot frame. When two elements share a
  label (e.g. a trigger button behind a modal), re-read refs after the modal
  opens.
- JS `.click()` runs app logic but doesn't move real focus — use a real click
  for focus tests. Override `window.confirm` to exercise confirm-guarded deletes.
- Smooth `scrollIntoView` is a no-op there; HTML5 drag-and-drop, touch gestures
  (the swipe/pull handlers ignore `pointerType: "mouse"`), and synthetic
  `dispatchEvent` drags can't be exercised — verify those by code review.
- Fill controlled inputs with `form_input`, not by assigning `.value`.

**Recurring gotchas**
- `auth.users.email` is `varchar(255)`: cast `::text` in any security-definer
  function that returns it (hit four times).
- PostgREST silently truncates at 1000 rows: use `data/fetchAllRows.js` for any
  unbounded read.
- `upsert` on an RLS table needs INSERT privilege even when it resolves to an
  UPDATE — use `.update().eq(...)` when the row always exists.
- Anything loaded for the signed-in member belongs in the user-keyed hydration effect in `data/store.jsx`, never in a
  mount-only effect (it would miss a same-page sign-in), and every background sync must stay gated on the fetch it
  depends on -- an ungated sync writes empty local state over the member's real row. Components that seed a local form
  from saved state must re-seed when that state changes, or the form can be blank when the data arrives late.
- Logic mirrored across Deno / Node / browser (`TIER_CAPS`, `companyCap`, `normalizeLocation()`) must be changed in every
  copy; run `npm run test:server` after touching it. The app's live matcher is `data/jobMatch.js`; `server/src/match.ts` is
  a test-only mirror that has NOT kept up (no title patterns, skill inference or multi-place locations).
- CSS: colors come only from tokens in `styles/tokens.css` (light and dark);
  style selects with `background-color`, never the `background` shorthand (it
  erases the drawn arrow). Load heavy libraries (`pdfjs-dist`, `mammoth`) with
  dynamic `import()`.
- Never fall back to the mock `currentUser` identity for anything shown or stored: `displayName(profileOverrides, accountEmail)`
  uses the saved name, else the email's local part. The old fallback leaked "Test Account" into real posts.
- Storage `remove()` deletes nothing, with no error, unless the caller can also SELECT the object (it is a
  `DELETE ... RETURNING`). Any bucket an admin deletes from needs an admin SELECT policy, not just DELETE.
- Fixed-position UI (tour tooltip, top bar) must size against `document.documentElement.clientWidth`, not
  `window.innerWidth`; check phone layouts as an admin too, whose top bar carries extra items.
- Delete a temporary migration file the moment it has run: a leftover failing diagnostic blocks every later
  `db push`. In the test browser, clear localStorage after deleting a throwaway account -- its stale session
  produces 409/403 console noise that looks like an app bug. Match buttons by exact label in test scripts
  (a loose `/finish/i` also matches "Save & finish later").
- Never write a job and its `job_sources` row as two separate requests: use `insert_jobs_with_sources()`. A run
  interrupted between them leaves an orphan the pipeline can no longer see, expire or cap.
- 409/403/"connection refused" lines in the test browser's console are usually a page still running after its
  throwaway account was deleted in the database (token refresh and syncs against a user that no longer exists). To check
  whether the app itself fails, load it from a clean state; a temporary logger in `index.html` that records failed
  `fetch`/XHR/element loads from the first instant is the reliable way (remove it afterward).
- Test member-visible access as a plain member, never an admin: admins read every row, so an admin session proves
  nothing about RLS meant for members.
- Nullable database columns must be defaulted where rows are mapped into state (`rowToPreferences`): a null that reaches a
  controlled input overrides the app's own default and renders as "null" or NaN.
- The `duplicate key ... job_sources_source_id_source_job_id_key` failure from `insert_jobs_with_sources` was caused by
  `fetchAllRows()` paging without an `ORDER BY` (unordered LIMIT/OFFSET drops rows that move between pages; only runs reading
  over 1000 rows hit it). Fixed 2026-10-03: it orders by a unique column (`id`, or pass the primary key as the 5th argument).
  Any new paged read must be ordered. If it ever recurs, the message carries the key detail -- read it before theorizing.
- `check-job-links` is sensitive to invocation frequency (past false-positive
  bursts); don't invoke it repeatedly by hand.

## History

Everything built to date, with the reasoning and verification behind each
piece, is in [PROGRESS_LOG.md](PROGRESS_LOG.md) — search it rather than reading
it whole. Append new dated entries there. Build checklist:
[PROJECT_PLAN.md](PROJECT_PLAN.md).

Run locally:
```bash
npm install
npm run dev
```
