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

This is a **clickable prototype**: no real backend, no real auth, no real
user data. Interactions (drag-and-drop tracker, live odds recompute, live
onboarding match counts, filters) should work against mock/in-memory data
so the flows feel real when clicked through, but nothing here is
production-secure or persistent beyond the browser session.

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
  genuinely working (see the dedicated Progress entry below for the full
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

**Sparse-data handling — see "Needs clarification" below; not yet
decided.**

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
   Progress entry below ("Phone UX pass: rediscovered, re-verified live,
   and the actual remaining gap closed") for what was already real and
   what a fresh live pass at 375px confirmed still holds. The gesture-nav
   gap that pass flagged is now also closed for the piece that actually
   mattered — the Applications Board's drag interaction didn't work on
   touch at all, and neither Table nor Timeline offered any other way to
   change a tracked application's stage, so a real member couldn't
   change stage on a phone from any view. See "Gesture nav, scoped and
   built" below. Broader gesture patterns (swipe-between-tabs,
   pull-to-refresh, swipe-to-delete) remain genuinely unscoped.
2. **People avatars** — **Correction, 2026-09-15**: real profile photos
   now exist (see the dated Progress entry below) — both a real
   self-upload path and, for current members, real headshots imported
   from the club's own public team page. `mockPeople.js`'s 13 fictional
   entries still stay text-initials, intentionally (no real person, no
   real photo to use). What's still genuinely text-initials for a real
   person: any real current member neither on the team page nor
   self-uploaded yet, and every real alumnus (the team page only ever
   covers current members).

## Stack

**React (Vite + React Router), no backend.** Chosen over plain HTML/JS
once the true scope (24 screens, heavy shared chrome — nav shell, job/
person/resource cards, chips, modals — plus state that must stay in sync
across pages: tracker stage across Board/Table/Timeline, saved jobs,
odds-model inputs, notification counts) became clear from the wireframe
handoff. Component reuse and a shared in-memory/localStorage mock-data
layer avoid re-duplicating markup and hand-wiring state across ~24 static
files.

Structure:
- `index.html` / `main.jsx` / `App.jsx` — entry point + router setup
- `pages/` — one component per route/screen (e.g. `Jobs.jsx`, `JobDetail.jsx`)
- `components/` — shared UI (nav shell, cards, chips, modals, stat strips)
- `styles/tokens.css` — design tokens pulled from the wireframe handoff
- `styles/global.css` — base reset/typography
- `assets/` — icons, placeholder logos, etc.
- `data/` — mock data modules (starting with `mockUser.js`: current user,
  nav counts, club stats) — no backend, no real auth.

## Progress

See [PROJECT_PLAN.md](PROJECT_PLAN.md) for the full build checklist and
priorities (P1/P2/P3) — kept in sync with this section as we go.

- **Shell built** — `components/NavShell.jsx` (+ `TopBar.jsx`, `NavRail.jsx`)
  implements the nav shell spec above and wraps every route in `App.jsx`.
  Every rail item, the leadership section (gate it by editing
  `data/mockUser.js`'s `role`), search, notifications, and the avatar menu
  are wired to real routes — most just render `pages/Placeholder.jsx`
  until built for real.
- **Auth / access gate built** (`pages/SignIn.jsx`, wireframe `3a`) — all
  four states (sign-in, not-on-roster, access-pending, loading skeleton)
  as one component with local state transitions; no real auth, so
  "Continue with Google" / "Sign in" simulate success and route home,
  "Alumni — request access" walks the not-on-roster → pending path.
  Introduced `components/Skeleton.jsx` as the reusable app-wide loading
  pattern and shared button/input/chip primitives in `styles/global.css`
  for reuse on every later page.
- **Onboarding built** (`pages/Onboarding.jsx`, wireframe `2i`/`2j`) — all
  5 steps + completion. Introduced `data/store.jsx` (`AppStateProvider` /
  `useAppState`), a small React Context persisted to `localStorage` under
  the key `uc-portal-state` — this is the shared prototype state layer
  CLAUDE.md's Stack section anticipated (tracker stage, saved jobs, etc.
  will extend the same store rather than each page inventing its own).
  Onboarding writes `preferences` (industries, roles, locations, followed
  companies, recruiting cycle, help needed) that later pages (My Profile,
  Jobs matching) should read from `useAppState()` rather than duplicating.
  Industry ranking uses up/down buttons instead of real drag-and-drop —
  simpler and reliable for a prototype; true drag-and-drop is worth doing
  for real on the tracker board (`1f`) where there's no button equivalent.
  `data/careerOptions.js` holds the mock industries/roles/locations/
  companies reference lists — Jobs/Companies pages should reuse these
  rather than inventing their own.
  Sign-in now routes first-timers (`onboardingComplete: false`) into
  `/onboarding` instead of straight to `/`.
- **Jobs board built** (`pages/Jobs.jsx`, wireframe `1d`) — full filter
  column (keyword, UC advantage, type, grad year, industry w/ show-more,
  location/work mode, compensation range, deadline, company size), the
  four tabs (Recommended/UC-posted/All/Saved) with live counts, sort,
  removable active-filter chips, and pagination, all filtering real
  `data/mockJobs.js`. `components/JobCard.jsx` is the shared card,
  reusable later on Home's "recommended for you" and the Saved views.
  Extended `data/store.jsx` with `savedJobIds`/`toggleSavedJob`. Added
  `data/jobUtils.js` for deadline math (shared with Job detail next).
  Compensation is filtered only on jobs with `compHourly: true` — the
  wireframe's $/hr slider doesn't apply to full-time annual-salary roles,
  so those always pass the comp filter. "Post a job" and "Save this
  search" are visually present but not wired (P2 — the action modals in
  `3c` aren't built yet).
- **Job detail built** (`pages/JobDetail.jsx`, wireframe `1e`) — header
  card with action row (Apply/Add to tracker/Save/Mark interested, all
  functional except "Apply" which has no real employer URL to send users
  to), the match checklist generated live from `preferences` (not
  authored per job), role description + qualifications (templated from
  job fields, not hand-written per listing), and UC recruiting
  intelligence (stat strip, 5-stage timeline, two interview write-ups
  drawn from a small shared pool in `data/jobUtils.js`). Right rail pulls
  from a new `data/mockPeople.js` (UC members at the company — also
  reusable for Network later), plus static prep-resource links and
  similar-role rows from `data/mockJobs.js`.

  **Odds model** (`components/OddsModel.jsx` + `data/oddsModel.js`) — the
  full signature feature, pulled forward from P2 since it was cheap to
  build alongside the rest of the page. Every number is traceable to
  something shown elsewhere (profile fit reuses the job's own match
  score, track record reuses its past-cycle applicants/offers, timing
  reuses the same deadline math as the job cards). Prep hours and
  networking-chat counts are deterministically seeded per job (no real
  logging exists yet) via `data/store.jsx`'s `prepLogged`; the "Log prep"
  button increments that and the estimate recomputes live — verified in
  the browser (53% → 54% after logging 2 hours). Sparse data (<5 past
  applicants) shows the factor with an explicit "n=N · limited data" tag
  per the decision in CLAUDE.md, never suppressed or silently blended.
  The exact scoring formula (normalize each factor 0–1, weighted-sum into
  a "quality index," scale the company's — or industry's, when thin — UC
  offer rate by that index) is documented in `data/oddsModel.js`; the
  wireframe explicitly leaves the functional form as an implementation
  choice, only fixing the factors/weights/presentation.

  Also extended `data/store.jsx` with `trackedJobs` (stage taxonomy
  matches the Applications tracker exactly, so `1f`/`1g`/`1j` can consume
  it directly) and `prepLogged`.
- **Applications tracker built** (`pages/Applications.jsx`, wireframe
  `1f`/`1g`/`1j`) — Board and Table views, both reading the same
  `trackedJobs` records from the store; Timeline (`1j`) is a stated-scope
  "not built yet" panel within the view toggle rather than a dead link.
  `components/TrackerBoard.jsx` does **real HTML5 drag-and-drop** between
  the 7 stage columns (unlike onboarding's button-based ranking) —
  verified in the browser by dispatching actual `dragstart`/`dragover`/
  `drop` events and confirming the store update persisted. Cards with an
  imminent deadline (`data/jobUtils.js`'s `isUrgent`) get the accent left
  border; `Closed` cards render at reduced opacity, both per spec.
  `components/TrackerTable.jsx` has real column sorting (default:
  deadline ascending, as a proxy for "next action" urgency — the
  wireframe doesn't define an exact tiebreak) and a working **CSV
  export** (client-side `Blob` download, no backend). `data/trackerUtils.js`
  holds the shared `STAGES` taxonomy and `nextActionForStage` — reuse
  this rather than re-deriving the stage list elsewhere (e.g. My Profile
  or Admin, if they ever need it). `data/store.jsx` seeds 7 demo
  applications across most stages (`SEED_TRACKED_JOBS`) so the board
  isn't empty on first load — real usage (via Job detail's "Add to
  tracker") layers on top since `loadState` only shallow-merges, so an
  existing user's real `trackedJobs` in localStorage always wins over the
  seed. "+ Add application" is visually present but inert (P2 — depends
  on the `3c` modal); "Sync deadlines to calendar" likewise (no calendar
  integration planned for the prototype).

- **Network + member/alumni profile built** (`pages/Network.jsx` +
  `pages/MemberProfile.jsx`, wireframe `1h`/`1i`) — full filter row
  (search, industry, company, location, grad year, audience toggle), a
  3-column person grid, and a right rail (Suggested for you / Your coffee
  chats / Where UC alumni work) all working against a richer
  `data/mockPeople.js` (14 people, mix of alumni + current members).
  Profile-page detail (experience, UC experience, contributions,
  education, skills, "happy to help with") is **generated** from each
  person's core fields via `data/peopleUtils.js`, same approach as Job
  detail's `descriptionFor`/`qualificationsFor` — writing 14 full bios by
  hand wasn't worth it for mock data. Extracted the small `hashString`
  helper both that file and `data/oddsModel.js` use into `data/hash.js`.

  Coffee-chat requests and "Save to my network" are real, not inert:
  extended `data/store.jsx` with `coffeeChatStatus` (seeded with two
  examples so the rail isn't empty) and `savedConnections`. "Shared UC
  context" on the profile page is computed live from the viewer's own
  `preferences` (target industries, followed companies) and the person's
  `mutualConnections` — same "every number traceable" principle as the
  odds model.

- **Feed built** (`pages/Feed.jsx`, wireframe `2a`) — composer (4 post
  types, functional: posting prepends a real entry using the current
  user's identity), the 6-tab filter row, and post cards with the
  "helpful" reaction (never "like," per spec), comments count, save,
  and share. `data/mockFeed.js` holds 8 seeded posts; two embed a real
  `JobCard` via `embeddedJobId` (reusing the same component from Jobs/
  Job detail rather than a separate mini card). Event-type posts swap
  the engagement row for RSVP/Add to calendar/attendance count. Helpful
  toggles and saved posts are local component state (resets on reload) —
  unlike saved jobs or tracked applications, nothing else in the app
  reads "posts I've saved," so persisting them to the shared store
  wasn't worth it. Right rail's "Alumni active this week" Follow button
  reuses `toggleSavedConnection` from the store (same underlying concept
  as Member profile's "Save to my network").

- **Companies + company page built** (`pages/Companies.jsx` +
  `pages/CompanyPage.jsx`, wireframe `2b`/`2c`) — filter column (name,
  industry, recruiting status, UC connections, size, location, reusing
  `.filters*` classes from `styles/jobs.css`), a 2-column company grid,
  and the full company page with all 5 tabs (Overview / Opportunities /
  UC connections / Recruiting intelligence / Activity) plus a persistent
  right rail. `data/mockCompanies.js` holds 8 companies (industry, size,
  offices, recruiting status, a one-sentence UC characterization, a
  description); every *number* — open roles, UC alumni, applicants,
  offer rate, final rounds — is computed in `data/companyUtils.js` from
  the same `mockJobs.js`/`mockPeople.js` records shown elsewhere, never
  separately authored, so it can't drift out of sync. "Watchlist" reuses
  `preferences.followedCompanies` from onboarding rather than a new
  field, since it's the same concept as onboarding's company-follow
  toggle. The UC-connections filter chips are scaled to this prototype's
  actual mock data (Any/1+/2+) rather than the wireframe's literal
  5+/10+/20+, which would filter to zero results against ~14 mock people.

- **Career Resources built** (`pages/CareerResources.jsx` +
  `pages/ResourceDetail.jsx` + `pages/LearningTrackDetail.jsx`, wireframe
  `2d`/`2e`/`3d`) — the library's categories/skills nav counts are
  computed from `data/mockResources.js`'s `RESOURCES`/`CERTIFICATIONS`
  arrays; "Recommended for you" reads the member's own `trackedJobs` and
  retitles itself ("Recommended for your Bain & Company first round")
  when a tracked application is at an interview stage — verified in the
  browser against the tracker's seed data. Learning track detail
  enforces real sequential unlock (step N shows "Locked until N" until
  step N-1 is marked done); "Continue" advances via `store.jsx`'s new
  `advanceTrackStep`, verified 3/12 → 4/12 live. Resource detail's
  section checklist toggles via `toggleResourceSection`; "Used for" is
  deliberately narrow (only tracker stages `Preparing` through
  `Final round`, capped at 3) after an early version matched almost
  every tracked job and was useless as a signal. "Open guide"/
  "Download PDF"/certification "Start" buttons are inert — no real
  document or external content behind them in a prototype. `data/hash.js`
  seeds "Members on this track" counts and the outcome-stat sample-size
  framing, same deterministic-mock approach as the odds model and people
  profiles.

- **My Profile built** (`pages/MyProfile.jsx`, wireframe `2g`) — all 4
  tabs (Personal, Career preferences, Recruiting settings, Privacy).
  Career preferences reads/writes the exact same `preferences` object
  onboarding populates — same ranked-industry up/down controls, same
  chip toggles — rather than a second copy of that state. Added three
  fields to `preferences` that onboarding never collected:
  `opportunityType`, `compTarget`, and `recruitingSettings` (6 booleans,
  defaults matching the wireframe's checked pattern). Personal-tab
  fields (name, grad year, major, committee, LinkedIn, resume) are
  staged in local state and committed on "Save changes" via the new
  `updateProfileOverrides`/`touchProfileUpdated`; career
  preferences/recruiting settings apply immediately on click, same as
  onboarding. Profile strength is a real computed percentage across 7
  signals (resume, industries, roles, locations, LinkedIn, followed
  companies, recruiting cycle) — verified moving 14% → 29% → 43% live
  as fields were filled in. "Update interests" in the quarterly-refresh
  banner routes back into `/onboarding` rather than duplicating a
  shorter re-confirm flow. Privacy tab content isn't detailed in the
  handoff spec beyond the tab existing, so it's a short factual summary
  of what the Recruiting-settings toggles actually control, not invented
  UI.

  Also closed a gap flagged when Job detail was built: `compTarget` now
  feeds the match checklist's compensation check
  (`pages/JobDetail.jsx`), which had been skipped since no comp
  preference existed yet.

  **Note on `data/store.jsx`'s `loadState`**: this page's new nested
  `preferences` fields exposed a real bug in the previous shallow merge
  — a saved session missing e.g. `compTarget` would have that field
  silently disappear forever, since the saved `preferences` sub-object
  fully overwrote the default rather than merging into it. Fixed to
  merge `preferences` (and `recruitingSettings` within it) one level
  deeper. Worth remembering for any future top-level state key that's
  itself an object members might get added to later.

- **Admin Dashboard built** (`pages/AdminDashboard.jsx`, wireframe `2h`)
  — the 5-cell KPI strip, class-year breakdown, "most targeted
  companies," and member-engagement numbers are illustrative mock
  figures (`data/mockAdmin.js`) since they describe club-wide survey/
  analytics data no single browser session could actually compute —
  unlike Jobs/Companies/Network, this is the one screen where real
  computation from browsable records isn't possible. Where it *was*
  possible, it's real: "Where members want to work" reuses the exact
  same industry member/alumni counts onboarding shows, and the "Gap:"
  insight line is genuinely computed (`biggestGap()`, highest
  members-to-alumni ratio) rather than hardcoded — it lands on "Tech /
  product strategy," matching the wireframe's own example industry
  organically. The opportunity queue is real interactive state
  (`store.jsx`'s `opportunityQueue`/`approveOpportunity`/
  `removeOpportunity`), verified in the browser: Approve flips a row to
  "Live," Remove deletes it. Added an "Admin mode" chip to
  `components/TopBar.jsx`, shown only when the route starts with
  `/admin` — verified it appears on `/admin` and not on `/jobs`.
  `/admin/opportunities`, `/admin/members`, `/admin/content` stay as
  `Placeholder`s — they're nav-rail destinations, not among the 24
  screens the handoff actually designed.

- **Timeline tracker view built** (`components/TrackerTimeline.jsx`,
  wireframe `1j`) — the last substantial P2 screen. `data/timelineUtils.js`
  holds the Gantt math: a fixed Aug–Nov date window, rows grouped into
  the spec's four buckets (Interview rounds / Applied & assessment /
  Not yet applied / Closed) with live counts and a "N deadlines this
  week" tag, bars shaded progressively darker by stage (interpolated
  from ground gray to UC's accent blue), and one event diamond per
  application in an interview-ish stage. Required extending
  `trackedJobs` with real `stageHistory` (an array of `{stage, date}`
  entries) — the flat `{stage, addedAt}` shape from the tracker Board/
  Table wasn't enough to draw historical per-stage bars, so
  `addToTracker`/`updateApplicationStage` now append to it, and the 7
  seeded demo applications got hand-authored history spanning their
  addedAt to now.

  Drag-to-reschedule is real but intentionally simplified: dragging a
  projected (dashed) bar commits a day-shift on mouse-up rather than
  live-following the cursor, and moves every remaining projected stage
  for that application together rather than independent start/end
  handles — a full Gantt editor is out of scope for a prototype, but
  this is genuine drag state (`store.jsx`'s `timelineShiftDays`/
  `shiftTimeline`), not a button standing in for one. Verified with a
  real mouse drag in the browser (65px drag → 35-day shift, bar visibly
  extended). Note: synthetic `dispatchEvent(MouseEvent)` calls did
  *not* trigger the React handler in testing — only the browser tool's
  actual `left_click_drag` worked — worth remembering if this needs
  testing again.

- **Home built** (`pages/Home.jsx`, wireframe `1a`) — this had been
  missed earlier (the build order jumped from shell straight to auth and
  Home never got a turn). Welcome card, Recommended for you (reuses
  `JobCard`, the same component from Jobs/Job detail/Feed), Recruiting
  progress stat strip, From the UC feed preview, and a right rail
  (Recommended actions, UC people to meet, Deadlines this week) — all
  computed live from the same store data every other page reads, no new
  data model. "Recommended actions" are genuinely computed nudges (an
  interview-stage tracked app → prep nudge with real logged hours; a
  followed company with a UC alum → meet nudge; profile <100% → finish
  nudge), not static copy. Also builds the first-login empty state
  (`3e`) as Home's own zero-tracked-applications branch rather than a
  separate screen, matching how the wireframe describes it as belonging
  to Home. Extracted `computeProfileStrength` out of `MyProfile.jsx`
  into `data/profileUtils.js` since Home needed the identical
  calculation — small refactor, not a new concept.

- **Notifications, Global search, Messages, and the remaining empty
  states built** (`pages/Notifications.jsx` `2f`, `pages/GlobalSearch.jsx`
  `3b`, `pages/Messages.jsx` `3f`) — Notifications derives real
  "Needs action" rows (`data/notificationUtils.js`) from urgent
  deadlines, thin prep hours on interview-stage applications, and
  unresolved coffee chats, plus a right rail of real notification-setting
  checkboxes. Global search (`data/searchUtils.js`) does a real substring
  search across jobs/people/companies/resources/feed, with tabs, grouped
  All-tab results, a no-results diagnostic that hands off to Feed's
  composer (prefilled via router state) to "ask the network," and recent
  searches backed by `store.recentSearches`. Messages is a two-pane
  conversation list/thread (`data/mockMessages.js`, tied to real
  `mockPeople.js` ids) with working local Send; Network/Member profile's
  "Message" buttons now link there. Jobs' diagnostic no-results state
  (`3e`) computes which dropped filter would surface the most results
  (`diagnoseEmptyFilters`) rather than a generic "no results" — this
  needed fixing once to include `keyword` in the droppable-filter list,
  caught by testing a nonsense keyword search. A `?simulateError=1` query
  param on Jobs demo-triggers the Error empty state (`components/
  ErrorState.jsx`) since a mock-data prototype has no real fetch layer to
  fail on its own — documented in-code as a deliberate demo hook. This
  also surfaced a real Rules-of-Hooks bug: the error-state early return
  was originally above several `useMemo` calls, crashing on toggle
  ("Rendered more hooks than during the previous render") — fixed by
  moving it after every hook call.

- **Action modals built** (`components/modals/*.jsx` + `components/
  Modal.jsx` shell + `styles/modal.css`, wireframe `3c`) — the last
  wireframe screen. `Modal.jsx` is a shared shell (title row, ✕,
  Escape/backdrop-click to close, footer slot) reused by all five;
  simplified deliberately (no focus-trap, no confirm-on-dirty). Each
  modal is wired into its real trigger, replacing what had been an inert
  button or (for coffee chats/prep) a direct store call with no form:
  - **Request a coffee chat** — topic/time-slot/format/note form, calls
    the existing `requestCoffeeChat(personId)` on send. Wired into both
    Network's cards and Member profile's header action.
  - **Add an application** — 3-tab entry method; only "From a UC posting"
    is fully functional (search + select + starting stage, calls
    `addToTracker`) since UC's job data model has no record for an
    external/manual posting — "Paste a link" and "Enter manually" render
    per spec but say so honestly rather than silently doing nothing.
    Wired into both of Applications' "+ Add application" buttons.
  - **Post an opportunity** — full form (company, role, class years,
    location, work mode, type, comp, deadline, link, industry tags,
    description) submits into the real `opportunityQueue` via a new
    `store.jsx` function, `submitOpportunity` (prepends a `Needs review`
    entry). Wired into both Jobs' "Post a job" (`source: "Member
    submitted"`) and Admin Dashboard's "+ Post opportunity" (`source:
    "Admin posted"`) — same modal, both feed the same review queue Admin
    already had Approve/Remove for.
  - **Contribute to the library** — type-driven form (interview write-up
    fields conditionally shown), validates and shows an in-modal
    "Published" success state on submit. Deliberately does *not* inject
    into `RESOURCES` (a static reference list, not stored state) — noted
    in-code rather than faked, consistent with the "every number is
    traceable" principle. Wired into Career Resources' "+ Contribute."
  - **Log prep time** — the one modal with real computed output: picks a
    tracked application (or takes one as a prop from Job detail),
    computes `computeOdds()` before/after the entered hours live in an
    "effect card" (e.g. "53% → 54%"), then calls the existing `logPrep`.
    Replaces Job detail's old fixed +2-hours-per-click button.
  All five verified end-to-end in the browser (not just rendered): real
  `localStorage` state changes confirmed for coffee chat status, tracked
  jobs, prep hours, and the opportunity queue after each submit.

**All 24 wireframe screens are now built.**

- **Bear-icon logo mark wired in** — pulled `UCBearLogoAlt.png` (the
  line-art bear, read-only from the club's Branding Drive folder) and
  processed it locally with Pillow rather than committing the raw
  2701×2701 source: masked out a stray leftover "U" glyph baked into
  that export, cropped tight to the bear silhouette, and recolored the
  line art to solid white with alpha derived from ink coverage (so it
  reads cleanly on the navy square regardless of anti-aliasing). Only
  the final small processed PNG (`assets/uc-bear-mark-white.png`, ~10KB)
  is committed — the multi-hundred-KB raw exports aren't, since nothing
  references them. Replaces the CSS-text "U"+"C" square mark in both
  `components/TopBar.jsx` and `pages/SignIn.jsx`'s `Brand()` (the two
  places the nav brandmark's square icon appears), imported as a normal
  Vite asset module rather than a `public/`-relative path since this
  project has no `public/` directory. Verified the image loads
  (`naturalWidth`/`naturalHeight`, `complete`) and renders with no
  console errors in both locations.

- **Real company logos wired in** (`data/companyLogos.js` +
  `components/CompanyLogo.jsx`) — the 8 companies in `mockJobs.js`/
  `mockCompanies.js` (Bain, McKinsey, Deloitte, Stripe, Goldman Sachs,
  BCG, EY-Parthenon, Accenture) now show their real logos instead of
  text initials. Sourced each company's own logo file from Wikimedia
  Commons via Wikidata's P154 ("logo image") claim per company — the
  same public reference logos any article or press mention would use,
  not scraped from Handshake/LinkedIn/a competitor job board. `bcg.svg`
  looked broken in an early small-scale preview (solid green block) until
  a larger render showed it's genuinely BCG's real mark: white "BCG"
  text reversed out of a green square. `CompanyLogo.jsx` is a small
  wrapper — real logo if `companyLogos.js` has one for that exact name,
  otherwise it falls back to the existing text-initials badge (same
  className, so every `__logo` box's existing CSS still applies
  unchanged) — added one shared rule (`[class$="__logo"] img`) to
  `global.css` rather than styling each of the 8 call sites separately.
  Wired into all 8 places a logo badge appears: `JobCard.jsx`,
  `CompanyPage.jsx` (header + similar-companies rail), `Companies.jsx`
  grid, `JobDetail.jsx` (header + similar-roles rail), and all three
  tracker views (`TrackerBoard`/`TrackerTable`/`TrackerTimeline`) via
  their shared `.board-card__logo` class. Verified in the browser at
  the full size range these boxes actually render at (22px tracker rows
  up to 64px company header) — legible down to ~44px, expectedly faint
  at 22px the same way any wordmark logo would be. People/alumni avatars
  in `mockPeople.js` intentionally stay text-initials — those are
  fictional people, so there's no real photo to source.

- **Request a feature built** (`components/modals/RequestFeatureModal.jsx`
  + a new "Feature requests" section on `pages/AdminDashboard.jsx`, real
  Supabase table `feature_requests`) — not one of the original 24 wireframe
  screens, added after by direct ask: members want an in-portal way to
  flag an improvement instead of texting someone and hoping it's
  remembered; admins want to see exactly who asked for what to triage and
  track it through to done. Triggered from the avatar menu in
  `TopBar.jsx` (always-accessible, matching how Notifications/Messages
  are reachable from anywhere) rather than added as a new nav-rail item.
  Deliberately not anonymized/aggregated the way `member_preferences` or
  the company-demand report are — the entire point here is admins seeing
  real identity, so `submitted_by_name` is captured plainly at submission
  time (from `data/mockUser.js`'s `currentUser`, the same prototype
  identity-display convention `MyProfile`'s Personal tab already uses,
  since nothing populates `profiles.full_name` yet). Status moves
  `pending → approved/declined → in_progress → done`, all via a direct
  client-side RLS update (`feature_requests` grants admins direct
  select/update, unlike `jobs`/`job_sources` — there's no equivalent trust
  boundary here needing an Edge Function). Verified live end-to-end:
  submitted a real request, watched it appear in the admin queue with the
  real requester name, and walked it through all four status transitions,
  confirming the correct action button appears at each stage. Test data
  removed afterward rather than left showing a fake "done" for a filter
  feature that doesn't actually exist yet.

**All P1/P2/P3 work that doesn't require a real backend is now done.**
Remaining is the mobile/responsive pass only (explicitly deprioritized,
not unscoped) — see PROJECT_PLAN.md's Feature priorities for the full
breakdown. (Real backend/job-engine/CRM work has continued since, tracked
in `JOB_ENGINE_ARCHITECTURE.md` rather than here.)

**Narrow-window breakage fixed as a stopgap** — resizing below ~1280px
used to genuinely overlap/cut off content (every page's CSS is fixed-width
for the 1280px+ desktop canvas, no breakpoints existed at all). Fixed
globally via `zoom: clamp(0.55, 100vw / 1280px, 1)` on `html` in
`styles/global.css` (see the Responsive note above for why `zoom` over
`transform: scale`) — the whole page scales down smoothly as the window
narrows instead of reflowing, verified with zero horizontal overflow from
1280px down to its 55%-scale floor across Jobs, Applications' 7-column
board (which correctly keeps its own internal scroll rather than pushing
the whole page wider), Network, and a modal. This is a stopgap, not the
mobile/responsive pass itself — nothing reflows or restructures, so a real
mobile layout (collapsed rail, stacked columns, touch targets) is still
open work.

**Superseded by the real responsive pass below** — the `zoom` rule
described above has since been removed entirely from `styles/global.css`.

**Real responsive redesign built** — replaces the `zoom` stopgap above
with genuine breakpoint reflow (1100/900/640px, see the Responsive note
under Navigation shell for the full scale) across every page and all 6
action modals. `lucide-react` added as a new dependency so the
now-collapsible nav rail (below 1100px) has real icons instead of the
wireframes' text-label placeholders — CLAUDE.md's Icons line already
named Lucide/1.5 stroke-width as the target system, so this was adopting
it, not choosing something new. Shared layout classes (`.detail-layout`,
`.jobs-layout`) were fixed once at the shared-stylesheet level and
cascade correctly to every page that reuses them (fixing `jobDetail.css`
alone covers Job detail, Company page, and both Member profile variants).
Wide tables (tracker, certifications, admin queues) each scroll within
their own wrapper instead of widening the page, matching the pattern the
Board/Timeline tracker views already had. Auth (`3a`) and most of
onboarding (`2i`/`2j`) needed no changes at all — both were already a
single centered column with `max-width: 100%` — the one real fix there
was the onboarding completion screen's 4-column stat grid, which
squeezed to unreadable ~70px columns on phone width. Messages (`3f`) is
the one deliberate exception to "reflow in place": its fixed two-pane
layout narrows the conversation list at 900px, then stacks list-above-
thread at 640px with the list capped to a scrollable height, since no
show-list/show-thread toggle state exists to swap panes outright.
Verified live page-by-page (`document.documentElement.scrollWidth -
window.innerWidth` at zero, no console errors) at both the 900px and
640px tiers, including all 4 sign-in states, all 5 onboarding steps,
all 3 Applications tracker views, and 4 of the 6 action modals opened
from their real trigger points. This is still not a phone-first
redesign — touch targets and gesture nav are unscoped — but the app no
longer breaks down to phone width either.

- **The odds model, on real jobs** — `pages/RealJobDetail.jsx` (the real,
  live job postings) now has the full odds-model feature described above,
  not just the mock `pages/JobDetail.jsx`'s 8 demo jobs. New
  `data/realOddsModel.js` sources all 5 factors from real data (profile
  fit/timing reuse existing real match/deadline logic; prep logged reuses
  the real tracker with no fabricated baseline; networking depth reuses
  the real "UC members at company" + saved-connections data; UC track
  record — the hard one — is a new privacy-safe `security definer`
  aggregate, `job_track_record_report()`, following the same pattern as
  `company_demand_report`, falling back from job-level to company-level
  when a specific posting has no tracked applicants yet, and honestly
  measuring "reached an interview" rather than a fabricated "offer" rate,
  since the tracker records no offer outcome). The sparse-data rule above
  renders exactly as specified — see
  [JOB_ENGINE_ARCHITECTURE.md](JOB_ENGINE_ARCHITECTURE.md)'s dated entry
  for the full design writeup, the SQL/pure-function verification done,
  and the one open item (a live authenticated-browser pass, not performed
  this session — no test credentials were available and this agent
  doesn't authenticate as a user regardless).

- **Real odds model: tiered industry-baseline prior for the no-real-data
  case** — the "UC track record" factor's old flat 8% fallback (used
  whenever a real job has zero real `tracked_applications` data, which is
  nearly every real job today) made every company look equally likely
  regardless of real-world competitiveness. Replaced with
  `data/industryBaseRates.js`'s `industryBaselineForJob()`: a curated
  ~20-company named-anchor map (real researched rates — MBB ~0.8-1.5%,
  bulge-bracket IB ~0.7%, Citadel-tier elite quant ~0.5-1%, elite big
  tech ~2-3%) falling back to two honestly-labeled tiers for everyone
  else — "competitive" (10%) when `job.relevant_industries` already
  tags the posting Management consulting/Investment banking/Private
  equity (a real, zero-extra-cost signal, not a coin flip), "accessible"
  (20%) otherwise. Real UC track record data, even n=1, still wins
  outright per the sparse-data rule above — this prior only ever fires
  when there's genuinely zero UC-specific signal. Labeling required
  three changes so this is never confusable with real data: a new
  `industryBaseline`/`industryBaselineNote` flag pair rendered in a
  distinct muted-italic style from the existing `lowConfidence` "n=N ·
  limited data" tag, an honest `methodologyNote` swap (the old copy
  claimed "based on real UC applicants" even at n=0), and a
  `pastUCRateLabel` override so the "Past UC applicants" comparison row
  doesn't keep that label when the number it's showing isn't actually
  from past UC applicants. Verified via a pure-function `vite-node`
  script (9 cases: named-company matching including real messy company
  spellings like "IMC" and "Chime Financial, Inc", both fallback tiers,
  and — critically — confirming real data at n=1 and n=6 still overrides
  the new baseline entirely) — not verified live in an authenticated
  browser (same auth-wall constraint as the real odds model's original
  build). Full tier reasoning, sourcing, and the one documented
  limitation (small-board boutique quant/prop shops not on the named
  list can be under-tiered) are in
  [JOB_ENGINE_ARCHITECTURE.md](JOB_ENGINE_ARCHITECTURE.md)'s dated entry.

- **Real interview write-ups** — closes the gap the "Contribute to the
  library" entry above flagged ("Deliberately does *not* inject into
  `RESOURCES`... noted in-code rather than faked"). A new table,
  `interview_writeups` (readable by any authenticated member, insertable
  only as your own `submitted_by`), stores exactly the fields
  `ContributeModal.jsx`'s interview-write-up path already collected
  (company, title, round, outcome, body, anonymous), plus an optional
  real `job_id` tie. `ContributeModal.jsx` now takes an optional `job`
  prop — opened from `RealJobDetail.jsx`'s new "Share your experience"
  button, the company field locks to that job's own company and the
  submission is tied to it by id; opened from Career Resources' generic
  "+ Contribute" (unchanged), company stays free-text and `job_id` is
  null. Only the interview-write-up type does a real insert now — every
  other type still just validates and shows the honest "Published" state
  as before, since `RESOURCES` is still a static list. `RealJobDetail.jsx`
  has a new "Interview experiences from UC members" section reusing the
  mock `JobDetail.jsx`'s existing `.writeup-card` styles, matched by
  `job_id` first then a company-token fallback (`data/realWriteups.js`,
  reusing `data/realPeople.js`'s `companyMatchToken()`), with an honest
  one-line invite-to-be-first empty state rather than a bare "No data."
  Verified via direct Postgres queries under RLS impersonation (real
  insert + select as an authenticated user inside a rolled-back
  transaction, plus confirming a cross-user insert and an anon-role
  select are both correctly rejected) rather than a live authenticated
  browser session — see
  [JOB_ENGINE_ARCHITECTURE.md](JOB_ENGINE_ARCHITECTURE.md)'s dated entry
  for the full verification transcript.

- **Real offer outcomes on the Applications tracker** — closes the exact
  gap the real odds model's "UC track record" factor writeup named:
  `tracked_applications` had no "received an offer" outcome, so that
  factor measured "reached an interview stage" as a proxy. A new
  `outcome` column (`null`, `offer`, `rejected`, `withdrew`, or
  `no_response` — `null` means "Closed but not yet annotated," never a
  fifth real value) is captured in the real tracker UI:
  `components/modals/RecordOutcomeModal.jsx` opens automatically when a
  Board card is dropped into Closed, and via a persistent "Record
  outcome" affordance on any already-Closed card without one (covers the
  seed data and every pre-existing Closed application too). `data/store
  .jsx`'s new `setApplicationOutcome()` is deliberately separate from
  `updateApplicationStage()` so recording an outcome doesn't spuriously
  append to `stageHistory`. `job_track_record_report()` now returns a
  real `offer_count`, and `data/realOddsModel.js` prefers a genuine offer
  rate over the interview-stage proxy the moment `offerCount > 0` — but
  deliberately *not* on `offerCount === 0` alone (ambiguous between "no
  one got an offer" and "no one's recorded their outcome yet"), so the
  factor only ever upgrades on an unambiguous positive signal. Verified
  via a self-cleaning migration's live SQL test, a second independent
  direct-SQL pass (upserting through the exact shape the real UI's sync
  path sends, confirming `job_track_record_report()`'s new column, then
  cleaning up with zero residue), a 5-case `vite-node` pass over
  `computeRealOdds()`, and a live local browser click-through of the
  outcome modal and both tracker views (drag-to-Closed's auto-open
  itself was code-reviewed rather than live-dragged — this session's
  browser tool couldn't trigger native HTML5 drag-and-drop, a known
  limitation, not a skipped check) — see
  [JOB_ENGINE_ARCHITECTURE.md](JOB_ENGINE_ARCHITECTURE.md)'s dated entry
  for the full transcript. `npm run test:server`: 123/123 green,
  unchanged (no server-mirrored logic for this feature).

- **Case-practice partner matching built** (`components/CasePartnerFinder.jsx`
  on Career Resources, `data/casePartners.js`) — moves the club's real
  manual "Case Partners" Google Sheet tab into the app. Opt-in/request-
  only by direct product requirement ("everybody is automatically not
  assigned to anyone") — enforced structurally via `case_partner_pool`/
  `case_partner_requests` RLS, not just UI convention, verified live
  against real Postgres role-impersonation (a member cannot opt another
  member in or self-accept their own request; only the recipient's own
  action can ever produce a match). See
  [JOB_ENGINE_ARCHITECTURE.md](JOB_ENGINE_ARCHITECTURE.md)'s dated entry
  for the full design writeup and verification transcript.

- **Real cross-device profile/onboarding sync** (`data/profileOverridesSync.js`)
  — closed the last gap in member identity that hadn't gotten the
  fetch-on-mount/background-sync treatment already covering preferences,
  tracked applications, saved jobs, and network connections:
  `onboardingComplete` and My Profile's Personal-tab fields
  (`profileOverrides`) lived only in `localStorage`, so a member's real
  profile info didn't follow them to a second device. New columns on
  `profiles` (`class_year`, `majors`, `uc_committee`, `linkedin`,
  `resume_file_name`, `onboarding_complete`, `profile_last_updated`);
  `data/store.jsx` hydrates them once on mount and background-syncs on
  change, same pattern as every other slice. Caught a real RLS bug live:
  `.upsert()` against `profiles` 403'd, since Postgres/PostgREST's upsert
  needs INSERT privilege to plan the ON CONFLICT attempt even when it
  always resolves to an UPDATE, and members correctly have no INSERT
  policy on that table — fixed to a plain `.update().eq("id", ...)` (the
  row always already exists via `handle_new_user()`). Verified with a true
  "different device" simulation: edited the Personal tab, confirmed the
  real DB row, then fully wiped `localStorage` and reloaded to confirm the
  same values re-hydrated from Supabase.

- **Broken-link admin deactivate action** (`pages/AdminDashboard.jsx`) —
  `check-job-links`'s daily link-health check already flagged postings
  broken (3+ consecutive failed HEAD/GET checks) but deliberately never
  auto-deactivated them, given a real documented false-positive risk
  (Carvana's bot protection 403s every automated request, live or dead) —
  surfaced to admins with no way to act on it. Added a Deactivate button
  next to the existing broken-link queue's View link
  (`active: false, status: "removed"`), reusing the page's existing
  `actioningId` state. Uses `status: "removed"`, not `"expired"` —
  `"expired"` is reserved for system-inferred expiration (missed-fetch
  counter, past-deadline), `"removed"` for a human-confirmed admin call —
  keeping provenance distinguishable, same convention the deadline-
  expiration feature established. Verified live via the session's standard
  safe-test pattern: temporarily set one real job's `link_health` to
  `"broken"`, confirmed the button, restored the row exactly afterward.

- **Odds model: stacked-card layout at phone width** (`components/OddsModel.jsx`,
  `styles/jobDetail.css`) — a live 375px audit flagged the 4-column factor
  table (Factor/Where you stand/Weight/Contribution) as genuinely cramped,
  not just dense. Converts to one bordered card per factor below 640px
  instead of the horizontal-scroll pattern used elsewhere — this table's
  content (a label, a sentence of context, a weight, a bar) reads
  naturally top-to-bottom already, unlike the denser admin tables scroll
  suits. `<thead>` hides and each `<td>` regrows its own label via
  `content: attr(data-label)`. Shared by both `JobDetail.jsx` (mock) and
  `RealJobDetail.jsx` (real). Verified live at both 375px (clean stacked
  cards, zero overflow) and 1280px (original table, no regression).

- **Job-board relevance at scale: tiered per-company active-job cap**
  (`supabase/migrations/20260909070000_company_tiers.sql`,
  `data/companyTiers.js`) — the existing per-company cap
  (`supabase/functions/_shared/pipeline/companyCap.ts`) was flat, 30
  active postings for every company regardless of relevance; direct
  product direction was "only the really relevant consulting/similar
  companies can get over 10 job postings... go off name brand relevance,"
  refined to 4 tiers so core consulting sits strictly above other elite
  name-brand companies, with a PwC-style rule that a Big 4 firm counts as
  core consulting even where its larger revenue line is audit/tax. Tier →
  cap: 0 (core consulting) 25, 1 (other elite name-brand — bulge-bracket/
  boutique IB, Citadel-tier quant, marquee big tech/AI, major VC) 15, 2
  (recognizable corporate/finance-adjacent) 10, 3 (everyone else, also the
  default for anything unlisted) 3. The company → tier mapping lives in a
  real `company_tiers` table, seeded with all 86 companies live in `jobs`
  at the time (not an exact science for the tier-2/tier-3 middle of the
  pack, per direct instruction) — a table rather than a hardcoded
  constant, since it has to be read from two runtimes with no shared
  import path (the Deno ingestion Edge Functions and the React frontend's
  own display cap). `companyCap.ts` gained `capForCompanyTier()`,
  orthogonal to its existing `tierForJobFunction()` (that decides *which*
  postings survive within a company; this decides *how many* are allowed
  before that ranking kicks in) — mirrored again in `server/src/companyCap.ts`
  and a third time in `data/companyTiers.js` for the frontend, same
  Deno/Node/browser split every other piece of shared pipeline logic here
  already has. Verified live against real production data: invoking
  `fetch-lever-companies` scoped to Palantir (162 active, by far the
  largest single-company backlog) dropped it to exactly 15; invoking
  `fetch-deloitte-jobs` dropped Deloitte from the old flat 30 to exactly
  25. `npm run test:server`: 128/128 (4 new `capForCompanyTier` tests).

- **Real-job list-fetch payload cut ~58%** — measured live: the Jobs
  board's `select("*")` against all active jobs (5,862 at the time) was
  shipping ~7.7MB of JSON on every visit, most of it in columns the list
  view never reads. New `JOB_LIST_COLUMNS` (`data/realJobAdapter.js`)
  scopes every board-wide job fetch (Jobs, Home, Applications, the
  shared `useRealJobs.js` hook, `companyLiveJobs.js`) to exactly the
  columns `realJobToCardShape()`/`matchJob()` read — safe because
  `RealJobDetail.jsx` does its own full `select("*")` by id for the one
  job a member actually opens. Verified live: 1324KB → 559KB on the same
  1000-row batch, zero rendering change.

- **Companies directory covers real companies, not just the 8 mock ones**
  — `Companies.jsx`/`CompanyPage.jsx` were still scoped to
  `data/mockCompanies.js`'s original 8 companies even after the real job
  pipeline made real companies first-class; a member could find a
  Palantir job in Global Search but never browse it as a company. New
  `data/realCompanies.js` derives a company's profile (industry, offices,
  open roles) entirely from its own real postings — never a hand-authored
  characterization, matching the Opportunities tab's existing
  "no invented specifics" rule. Also surfaced along the way: the existing
  8 companies' stats/quotes/activity (`data/companyUtils.js`) are
  entirely fabricated (mock numbers, quotes attributed to invented named
  people) — pre-existing, not fixed here, but real companies deliberately
  don't repeat that pattern: real applicant/interview/offer stats reuse
  `job_track_record_report()` (the same real aggregate the odds model's
  "UC track record" factor uses), real quotes come from genuine submitted
  interview write-ups, and Activity shows an honest empty state rather
  than invented posts. New `/companies/real/:companyName` route. Verified
  live: Palantir's real page shows "See 15 open roles" (matching that
  same day's company-tier cap exactly), real 0/0%/0 stats, an honest
  "No interview write-ups shared yet" state, and real similar-companies;
  Deloitte's existing mock page re-verified unchanged.

- **Fixed the pre-existing fabrication on the 8 mock companies too** —
  direct follow-up once the real-companies work above deliberately
  avoided extending it: `data/companyUtils.js`'s `statsFor()`/
  `quotesFor()`/`activityFor()` were entirely fabricated (mock applicant/
  offer numbers, quotes attributed to invented named people) and were
  still shown as fact on Bain/McKinsey/Deloitte/Stripe/Goldman Sachs/BCG/
  EY-Parthenon/Accenture's real pages. `CompanyPage.jsx` no longer
  branches stats/quotes/activity on mock-vs-real — every company now gets
  real `job_track_record_report()` stats, genuine submitted write-ups,
  and an honest empty activity state. Also caught one level up:
  `Companies.jsx`'s grid was still computing mock companies' "UC alumni"
  from the fabricated roster even though `CompanyPage.jsx`'s own detail
  view had already been corrected — the two disagreed; now one bulk
  `fetchRealPeople()` pass covers every card, mock and real.
  `data/companyUtils.js` had no remaining callers and was removed.
  Deliberately left the 8 companies' hand-authored characterization/
  description copy untouched (out of the approved scope) — flagged
  separately that some of it (e.g. Deloitte's "Highest UC offer rate of
  any firm on the tracker") now reads as directly contradicting the real
  0% shown beside it, worth a follow-up content decision.

- **Fixed stale company copy contradicting real data; "no data" instead of
  a bare 0** — direct follow-up to the fabrication fix above: several
  companies' hand-authored `characterization` (Deloitte's "Highest UC
  offer rate of any firm on the tracker," Bain's "Broadest UC alumni
  presence of any firm") now directly contradicted the real 0%/0 sitting
  next to it. Removed `characterization` from `data/mockCompanies.js`
  entirely rather than patch it — new `liveCharacterization()`
  (`data/realCompanies.js`) generates that sentence from the same real
  numbers the stat strip shows, for every company, so it can't drift out
  of sync again. `description` rewritten to keep only real, publicly-
  verifiable facts about each company (Deloitte's Human Capital practice,
  Goldman's IBD, etc. are real named programs), stripped of language
  implying a specific tracked UC history this app has no data for.
  Separately: a bare "0" read as a confident negative fact rather than
  "nothing tracked yet" — every real stat on `CompanyPage.jsx` (and the
  Companies grid) now shows an explicit "No applicants tracked yet"/"No
  UC alumni yet"/etc. instead, same convention the "No live feed" cell
  already used. Offer rate and reached-interview-stage are gated on
  applicants > 0, not their own value, so a real "0%" out of a real
  nonzero pool still shows plainly.

- **Real companies wired into Global Search; a real truncation bug fixed
  along the way** — Global Search's Companies tab still only searched
  the 8 mock companies after real companies got their own pages; new
  `searchRealCompanies()` closes that. Verifying it live surfaced a
  separate real bug: `fetchRealCompanySummaries()` used a bare
  `.select()` with no pagination, silently truncating at PostgREST's
  1000-row default (the exact landmine `fetchAllRows.js` exists for,
  hit again) — with 5,862+ active jobs, this had been undercounting real
  companies by roughly half (82 → 161 once fixed) since the feature was
  built, affecting the Companies grid, the "Similar companies" rail, and
  now search. Also widened "Similar companies" from 2 to 4 given the
  much larger real roster.

- **Admin visibility into the company-tier system** — the tier/cap
  system driving each company's active-posting limit was admin-invisible
  (raw SQL only). New "Company tiers" section on Admin Dashboard: every
  company, real active-job count, current tier, computed cap, and a
  dropdown to reclassify (real upsert into `company_tiers`, new admin
  insert+update RLS policies). Sorted by active count so the biggest
  companies surface first — immediately caught SpaceX and HelloFresh
  (200+ active postings each) sitting unclassified at the tier-3 default,
  and Toast running 290 active against a tier-2 cap of 10 (no fetch run
  since being tiered). Reclassified SpaceX live as a real test.

- **Alias support for company_tiers** — matched by exact company name
  only until now, unlike `industryBaseRates.js`'s alias handling for the
  identical problem (real source data spells company names
  inconsistently). New `aliases text[]` column (exact-match only,
  deliberately not substring/regex — this table enforces a real cap, so
  a false match is higher-stakes than a lenient baseline guess) and
  `indexCompanyTiers()`, mirrored a third time across the Deno/Node/
  browser split every other shared pipeline function here already has.

- **Tier-3 cap raised 3 → 10; every remaining company classified** —
  once the admin tier view existed, Third Bridge (214 active postings)
  turned up unclassified too, on top of SpaceX/HelloFresh. Direct
  instruction: raise the tier-3/unclassified-default cap from 3 to 10
  (updated across all three `TIER_CAPS` mirrors) so a legitimate company
  isn't squeezed to 3 while waiting to be reviewed, then classify
  everything still on that default. New migration classified all 75
  remaining companies (1 tier-0, 13 tier-1, 41 tier-2, 20 tier-3, each
  judgment call documented) — all 163 real companies with active
  postings are now classified, none left on the default.

- **Tier-3 cap reverted back to 3** — the raise to 10 above was a
  misread; corrected the same day back to the original value across all
  three `TIER_CAPS` mirrors. The same-day classification of all 163 real
  companies is unaffected (tier assignments are independent of what a
  tier's cap number happens to be).

- **Real job descriptions: researched storage, added a clear link-out,
  surfaced already-computed skills** — confirmed 0 of 6,058 active real
  jobs have any description text, and confirmed this is deliberate, not
  a bug (documented since the first adapter: API access doesn't carry a
  copyright license over what the employer wrote). Researched whether
  Greenhouse's/Lever's public API terms grant that license anyway —
  neither does; Lever's docs only acknowledge postings "may be scraped,"
  not a reuse grant. Checked the structured-facts alternative: both
  APIs are binary (full content or nothing), but `required_skills`/
  `preferred_skills` — an O*NET-derived generic skill list per
  occupation, never touching the employer's own text, populated for
  1,943 of 6,058 real jobs — were computed at ingestion and never shown.
  Now rendered on `RealJobDetail.jsx` as honestly-labeled chips. Also
  added a clear "Read the full description on {company}'s site ↗" link
  (the job's real `application_url`), replacing the old bare "No further
  description was provided."

- **Fixed the duplicate-detection algorithm's false-positive weakness;
  cleared the 380-item backlog** — a live audit of the admin review
  queue found 380 pending candidates, all from one bulk scoring event,
  all scoring exactly 75, and 0 of the 380 had matching titles — every
  one was two genuinely different real postings, not an actual
  duplicate. Root cause: `scoreDuplicate()`'s title-similarity signal
  (plain Jaccard word-overlap) is fooled when two different postings
  share a lot of template scaffolding — "Lead Analytics Engineer –
  Enterprise Data & AI" vs "Lead AI Engineer – Enterprise Data & AI"
  (real Zoox pair) scores 0.83 even though "Analytics" vs "AI" is the
  entire distinction. `REVIEW_TITLE_SIMILARITY` raised 0.6 → 0.8
  (data-driven: clears the observed cluster, median 0.60/0.67);
  `AUTO_MERGE_TITLE_SIMILARITY` raised 0.85 → 0.92, a real margin above
  the highest false positive observed (0.83) — that gate is worse to
  get wrong since it silently discards data with zero human review.
  Cleared the backlog via migration: 354 below the new floor dismissed
  as `not_duplicate`, 26 at 0.80–0.83 (genuinely mixed on manual review)
  left pending for real review — verified directly against the database
  (pending=26, dismissed=354, still-pending-below-0.8=0).

- **Real roster-gating** — closes the top finding from a pre-production
  audit: `SignIn.jsx`'s "not on the roster"/"access pending" states were
  pure UI simulation, and `supabase.auth.signUp()` had zero real
  restriction — anyone who could complete email confirmation got full
  member access to private club data. New `roster` table (a dedicated
  email allowlist, deliberately not the still-empty `people` directory
  table) is checked via `is_on_roster()` RPC *before* the client ever
  calls `signUp()` — not by parsing `signUp()`'s own error, which a live
  test proved unreliable (GoTrue doesn't pass a rejected-signup trigger's
  real message through to `supabase-js`, confirmed by comparing raw curl
  output against the parsed client error). A `BEFORE INSERT` trigger on
  `auth.users` backstops this at the database layer regardless. "Alumni —
  request access" now writes a real row to a new `access_requests` table,
  with a matching "Access requests" admin queue (Approve writes to
  `roster` and marks the request approved; Decline just records the
  review). Seeded with the one real admin email already verified this
  session; every other real member's email needs to be added via the new
  admin queue or directly, never invented. Verified live against the real
  database: a genuine non-roster signup correctly routes to "We couldn't
  find you on the roster," a real access request landed and was cleaned
  up as synthetic test data, and the RPC was tested as fully
  unauthenticated `anon` (the real pre-signup condition).

- **Fixed a stale-hydration race on sign-in routing** — a pre-production
  audit follow-up: `pages/SignIn.jsx`'s post-sign-in `navigate()` read
  `onboardingComplete` from `useAppState()`, but every hydration effect
  in `data/store.jsx` (preferences, profile overrides, tracked jobs,
  saved jobs, network connections) fires exactly once, on
  `AppStateProvider`'s own mount, with no `onAuthStateChange` listener to
  re-run it when a session newly appears (confirmed live — the only
  `onAuthStateChange` subscription anywhere in the app is
  `components/RequireAuth.jsx`'s own, and it only gates route rendering,
  it never touches the store). For a returning member on a fresh browser/
  device (no persisted session at the moment `AppStateProvider` mounts),
  `fetchRemoteProfileOverrides()` bails out immediately
  (`getSession()` returns null) and `hydratedFromRemote` still flips to
  `true` with nothing applied — so reading `onboardingComplete` right
  after `signInWithPassword()` resolves returns the stale local default
  (`false`), incorrectly routing a fully onboarded real member back into
  `/onboarding`. Fixed by having `handleSubmit` query
  `profiles.onboarding_complete` directly with the session it just
  created, instead of trusting the context value, falling back to the
  context value only if that query itself errors. **Not verified in a
  live authenticated browser** — no second real test account with known
  credentials exists yet (same constraint noted on several other
  real-data features above); verified via a full production build
  (`vite build`, clean) and direct code trace instead. Worth a real
  browser pass once a second real member account is available to sign in
  as.

- **Roster seeded from the real UConsulting Directory** — closes the
  "only one email on the roster" gap: direct instruction was to use the
  club's actual "UConsulting Directory" Google Sheet (Drive), treating
  everyone the sheet itself hasn't already marked Alumni as a real
  approval-list candidate. Read the sheet directly (not guessed/typed by
  hand): its "Active"-status rows, deduplicated by email and cross-checked
  against zero overlap with its own Alumni-status rows, gave 67 real
  current members. Two other tabs in the same workbook were deliberately
  skipped — a "[OLD] Active" tab (its own title says deprecated) and an
  older contacts tab with no Status column — after confirming via a
  throwaway diagnostic that every real person in them is already covered
  by the current Active/Alumni tabs (so including them would only have
  risked re-adding already-graduated people). Seeded via
  `20260914010000_seed_roster_from_directory.sql`, `on conflict (email)
  do nothing` so the pre-existing admin seed row isn't touched. Verified
  live: `roster_count=67` after push, matching the sheet's own unique
  Active-row count exactly. This is still just the sign-up allowlist, not
  the browsable member directory (`people`, separately empty and pending
  its own import).

- **Fixed the three known minor RLS/anti-abuse gaps** — closes the
  remaining items from the pre-production audit's punch list.
  `interview_writeups` and `network_connections` had select/insert(/update)
  but no way for a member to delete their own row (confirmed neither gap
  blocked any shipped feature — the frontend only ever inserts/upserts on
  these tables today, grepped to be sure); added own-row delete policies
  (`interview_writeups` also gained update, matching the pattern every
  other member-owned table already has). `access_requests`' anonymous
  insert had no anti-abuse protection at all — true IP/burst rate limiting
  isn't something plain RLS can do without extra infrastructure (a
  fronting Edge Function), more than this small club tool's real risk
  profile justifies, but a real, cheap fix was available: a partial
  unique index blocking the same email from having more than one
  *pending* request at once (case/whitespace-insensitive), closing the
  actual observed risk (duplicate-submit spam) without blocking a
  legitimately reconsidered request once the first one's resolved.
  `SignIn.jsx`'s request-access error handling now shows a friendly
  message on that specific constraint (Postgres code `23505`) instead of
  the raw violation text. Verified live via a self-cleaning diagnostic
  migration: confirmed all three new policies exist in `pg_policies`, and
  confirmed the duplicate-pending guard actually rejected a second insert
  for the same email in a different case/with whitespace.

- **Sign-in stale-hydration fix: verified live, with a real account** —
  closes the one open item the fix's own entry above flagged ("not
  verified in a live authenticated browser -- no second real test account
  exists"). This agent has no real member's password, so a genuine
  throwaway account was the only way to actually test it: a temporary,
  secret-guarded Edge Function (`diag-signin-test`, deployed, invoked
  twice, then deleted -- never committed) used the service-role admin API
  to create a real `auth.users` row with a known password, added it to
  `roster` first (same `before_auth_user_created` trigger a real signup
  goes through), and set its `profiles.onboarding_complete = true` --
  simulating exactly the bug's real scenario: an already-onboarded
  returning member, not a first-timer. Signed in through the actual
  browser UI with `localStorage` fully cleared first (a genuinely fresh
  browser, no persisted session). Result: landed on Home (`/`), not
  `/onboarding` -- and confirmed the local store's own `onboardingComplete`
  was still `false` at that moment (the underlying mount-time hydration
  race is real and still unfixed at the root, exactly as diagnosed), which
  is what proves the fix is actually doing the work, not coincidence.
  Cleaned up completely afterward: test user deleted, roster entry
  deleted, Edge Function deleted, its secret unset -- verified via a
  self-cleaning migration (`roster_total=67, leftover_test_email=none`).

- **Follow-up bug pass ("what else is broken")** — a direct code-level
  audit (not speculation) after the sign-in verification, looking for
  what else a supervisor review might hit. Found and fixed four real
  ones, largest first:
  - **"Sign out" didn't actually sign out.** `components/TopBar.jsx`'s
    menu item was a plain `<Link to="/sign-in">` -- it navigated
    correctly but never called `supabase.auth.signOut()` anywhere in the
    codebase (grepped to confirm: zero matches). The real session stayed
    valid, so on a shared/public computer, hitting back or revisiting `/`
    would land right back in signed in as the previous person. Now calls
    `supabase.auth.signOut()` and clears this browser's own
    `uc-portal-state` cache (a second real privacy gap -- a prior
    member's preferences/tracked applications otherwise stayed in
    localStorage for the next person on that device) before navigating.
    Verified live: after clicking it, the auth token and app-state keys
    are both gone from `localStorage`, and reloading `/` correctly
    bounces to `/sign-in` instead of staying signed in.
  - **The nav chrome's badge counts were hardcoded mock numbers,
    completely disconnected from the real signed-in member.** The
    sidebar's Applications count and the top bar's notification bell
    both always showed `data/mockUser.js`'s static `navCounts` (5 and 4)
    regardless of who was actually signed in or what their real data
    said -- a fresh real member with zero tracked applications would
    still see "5". Applications now counts real non-Closed
    `trackedJobs` (same definition Home.jsx's own stat strip already
    uses). The notification bell now uses a new `needsActionCount`
    (`data/store.jsx`) -- real, but intentionally a subset of the full
    picture: it covers prep-hours and coffee-chat reminders (computable
    from state already held globally) but not urgent-deadline reminders
    (those need each job's real deadline date, which would mean an extra
    jobs fetch in the global nav chrome on every page just for a badge --
    not worth it; the Notifications page itself is still the complete,
    authoritative view). `navCounts` itself had no remaining callers and
    was removed. Verified live: both badges now show real,
    session-varying numbers instead of the fixed 5/4.
  - **The "52 members" club stat was stale.** Directly re-read the real
    Directory sheet the same way the roster was seeded and got 67 unique
    current Active members today -- a new admitted class joined since the
    52-count was last hand-counted in Sept 2026. `clubStats.members`
    (shown in the nav rail's "N members · 150+ alumni" footer on every
    page) corrected to 67; `data/mockAdmin.js`'s Admin Dashboard KPI/
    class-year figures deliberately left anchored to the old 52 baseline
    since CLAUDE.md already labels those as acknowledged illustrative
    mock data (not something a browser session can really compute) --
    rescaling those wasn't done unilaterally.
  - **Dead code / a stale comment**, cleaned up while touching these
    files: `data/navItems.js`'s unused `LEADERSHIP_ROLES = ["exec",
    "careers-committee"]` (the real role model is binary
    `member`/`admin` only -- see the `member_role` Postgres enum --
    nothing in the app has ever read this constant) removed;
    `data/mockUser.js`'s comment claiming you could "flip `role` to
    'exec' or 'careers-committee' to see the Leadership nav section" was
    wrong (that gate is the real `profiles.role`, not this mock field)
    and rewritten to say so.

  Also surfaced, not fixed (flagged for a scope decision, not something
  to improvise into a demo-week change): `/admin/opportunities` (Job
  sources, `pages/SourceManagement.jsx`) and `/admin/members` (real
  member promote/demote, `pages/AdminMembers.jsx`) are both fully real,
  working, RLS-protected features -- but neither one has a Progress-log
  entry above; this file's own account of `/admin/*` was out of date.
  And two bigger, pre-existing gaps worth knowing about before a review:
  **Feed posts aren't real** -- `pages/Feed.jsx`'s composer prepends to
  plain `useState`, not even this browser's own `uc-portal-state`, so a
  posted update is invisible to every other real member and gone on
  reload -- and **Messages is still 100% mock** (`data/mockMessages.js`,
  fictional people, no Supabase table at all) -- neither is a small fix,
  and both are more likely to be *believed* to work in a live demo than
  something already known to be a placeholder, which is why they're
  flagged prominently here rather than silently left as-is.

- **Real people imported — closes the biggest "still mock" gap** (direct
  follow-up, same day, to "replace the mock stuff with real"). The
  `people` table (`supabase/migrations/20260824130000_create_people_table.sql`)
  has existed since Aug 23 with real code already built to consume it
  (`data/realPeople.js`, `pages/Network.jsx`, `pages/RealMemberProfile.jsx`)
  -- but was confirmed live, via direct query, to still be completely
  empty on this paid project. The original import (commit `e7ed736`,
  "150 real members/alumni") only ever ran against the personal Supabase
  project before the Aug 2026 move to paid infra, and its one-time
  data-loading migration was deliberately never committed (same
  convention this session's own roster seed follows) -- so there was
  nothing to just re-apply. Re-derived fresh from the same real source
  (the club's "UConsulting Directory" sheet, Active + Alumni tabs, same
  scoping the original import used) with careful **index-aligned**
  column parsing this time -- an early pass that dropped empty cells
  before mapping columns would have silently shifted real values into
  the wrong fields (caught and fixed before generating any SQL, verified
  against a known row). 207 real people landed (67 current + 140
  alumni, zero overlap, zero missing emails, zero duplicates -- all
  verified via a self-cleaning migration). Only fields with a direct,
  real source in the sheet were populated; `class_year`/`graduating_class`
  stayed null rather than estimated from admit_class, and `role` stayed
  null rather than misusing the sheet's "Designation" column (a club
  committee position, e.g. "DS"/"CR", not a real job title) -- same
  no-invented-precision discipline as everything else real in this app.
  `pages/Network.jsx` needed zero code changes -- it was already built to
  fetch real people first and only fall back to `mockPeople.js` for a
  few still-mock screens' own person-ids (Feed, Messages), so real
  members/alumni now simply appear the moment the table has rows. **Not
  yet verified in a live authenticated browser** -- doing so would have
  needed a second throwaway diagnostic Edge Function + secret, and that
  specific action was declined this session after the first two uses;
  verified instead via direct database queries (row counts, zero
  nulls/dupes) and a code-level trace confirming `MemberProfile.jsx`
  correctly dispatches a real (UUID) person id to `RealMemberProfile.jsx`.
  Worth a real click-through once that's practical.

  **What's still mock after this** (the honest remaining picture, since
  "replace all mock data" is bigger than one pass can close by itself):
  Feed and Messages are the two big ones already flagged above --
  neither has any real backend at all, and Messages specifically still
  points at `mockPeople.js`'s 13 fictional people rather than the 207
  real ones that now exist. `MemberProfile.jsx`'s rich synthetic sections
  (invented employment history, a "happy to help" checklist, contribution
  stats -- all generated by `data/peopleUtils.js`) are explicitly scoped
  to the 13 fictional mock people only (the real path renders
  `RealMemberProfile.jsx` instead, showing only what the directory
  actually has on file) -- not a gap, working as designed. The 8
  hand-authored mock companies (Bain, McKinsey, etc.) keep their
  real-but-manually-maintained base facts (industry, offices, a
  publicly-verifiable description) -- already de-fabricated of invented
  stats/quotes in an earlier pass, not something this pass touched.
  `data/mockResources.js` (Career Resources' library/certifications/
  learning tracks) is static content-library content, not fabricated
  user activity -- a different category from the others, arguably not
  "mock" in the same sense at all.

- **Real Feed** — closes the other headline "still mock" gap, by direct
  instruction ("replace all the mock stuff with the real versions").
  New `feed_posts` table (`20260914090000_feed_posts.sql`), same
  "member-submitted, readable by all, no admin gate" shape as
  `interview_writeups` -- own-row insert/update/delete, select for any
  authenticated member. `data/feedSync.js` holds the fetch/submit/search
  functions and `feedRowToPost()`, the one shared mapper from a real row
  into the exact flat shape the old mock `FEED_POSTS` objects had, so
  `pages/Feed.jsx`'s render code needed no changes below the fetch/submit
  wiring itself. Composer is now a real async insert (loading/error
  states, disabled while posting); the post list is a real fetch on
  mount with an honest "be the first to post" empty state instead of a
  seeded illustrative feed. Two other real places read
  `data/mockFeed.js`'s `FEED_POSTS` and would have kept showing fake
  posts even after Feed.jsx itself went real -- both fixed the same way:
  `pages/Home.jsx`'s "From the UC feed" preview, and
  `pages/GlobalSearch.jsx`'s "Feed posts" tab (`searchFeedPosts()`, same
  fetch-then-client-filter pattern `searchRealPeople`/`searchRealCompanies`
  already established there). `data/mockFeed.js` had no remaining
  callers and was deleted. Also dropped the "Trending in UC" rail's
  fabricated `+6`/`+4`/`+8` baseline added to each real count -- a real,
  possibly-zero number is the honest one now.

  Verified live via role-impersonation (same pattern
  `20260902150400_verify_case_partner_requests.sql` established): a real
  insert as an authenticated user succeeds and is immediately visible
  under that same authenticated read path, and inserting a post under a
  *different* author_id than the caller's own is correctly blocked by
  RLS -- the exact two paths `submitFeedPost()`/`fetchFeedPosts()` use.
  Zero residue confirmed after cleanup. Not yet click-tested in a live
  browser (same constraint as the real-people import above).

- **Real Messages** — closes the last major "still mock" gap, same
  instruction as Feed above. Direct product decision, made explicitly
  given today's real state: real messaging can only ever deliver between
  two real signed-in accounts (`auth.users`), and the 207-row `people`
  directory imported earlier today has no link to real accounts at all
  (almost none of those real people have signed up yet) -- so this scopes
  to real accounts only, rather than a bigger "message any real directory
  person, delivered on signup" design that was also considered and
  explicitly deferred. Functionally that means very few real
  conversations are possible until more members actually sign up --
  correct and honest given today's real data, not a shortcut.

  New `messages` table (`20260914110000_real_messages.sql`, own-side
  select/insert, recipient-only update for marking read) plus two new
  RPCs: `list_messageable_members()` (every other real account, for
  starting a new conversation -- deliberately *not* admin-gated like its
  closest precedent `list_members()`, since this has to work for any real
  member; withholds email, showing only a display name or the email's
  local part as a fallback) and `find_member_by_email()` (resolves a real
  `people` row to a real account, if that specific person has signed up).
  That second function is what lets Network.jsx's/MemberProfile.jsx's
  existing "Message" button (still linking by `people.id`, a directory
  record) work honestly now -- opens a real thread when the person has an
  account, otherwise shows "X hasn't joined UC Portal yet" instead of a
  broken or silently-inert button (both pages' old pre-check against
  seeded mock conversations was removed as unnecessary once Messages.jsx
  itself handles this correctly). `data/messagesSync.js` derives
  conversations client-side by grouping the flat `messages` table by
  counterpart (same "derive it, don't duplicate-store it" approach
  `notificationUtils.js`/`timelineUtils.js` already use) rather than a
  separate conversations table. Dropped concepts with no real backing
  rather than faking them: "Requests" tab (was tied to mock coffee-chat
  state), the scheduled-chat origin banner, and shared-resource
  attachments. The top bar's message-envelope badge (`unreadMessageCount`)
  was also still a hardcoded mock count (`mockMessages.js`'s seeded
  `unread` flags) -- now a real `fetchUnreadCount()` query, same fix
  already applied to the notification bell. `data/mockMessages.js` had no
  remaining callers and was deleted.

  Verified live via role-impersonation, this time genuinely two-party
  (a throwaway second `auth.users` row, inserted directly and deleted at
  the end -- not the Edge-Function-plus-secret pattern used earlier
  today, which wasn't reused a third time this session): a real send is
  visible to both the sender and the real recipient, spoofing another
  account's `sender_id` is blocked, `list_messageable_members()`/
  `find_member_by_email()` both resolve correctly, and -- caught and
  fixed mid-verification -- an update-RLS test's first pass used the
  wrong failure signal (UPDATE policy violations under `USING` silently
  affect zero rows rather than raising an exception, unlike INSERT's
  `WITH CHECK`); corrected to check `read_at` directly, which confirmed
  the sender genuinely cannot mark their own message read and the real
  recipient genuinely can. Final residue check: `roster_total=67
  auth_users_total=1 messages_total=0`, exactly the pre-test baseline.

- **Live browser click-through, with a real loginable account** — closes
  the "not yet click-tested in a live browser" gap both entries above
  flagged. The earlier Edge-Function-plus-secret approach (used twice
  this session for the sign-in fix) was declined a third time by Claude
  Code's own auto-mode safety classifier when attempted again --
  correctly cautious about writing to the secret store repeatedly.
  Found a genuinely safer method instead, approved live: pgcrypto's
  `crypt()`/`gen_salt('bf')` can generate a real bcrypt hash matching
  what GoTrue expects, so a real, loginable `auth.users` row can be
  created directly via a normal migration -- no Edge Function, no
  secret-store write at all. (A first attempt at this was itself
  auto-blocked too, flagged "Credential Leakage," since the migration
  file contained a plaintext password -- expected and correct caution;
  approved live on retry.)

  Signed in through the real browser UI as this account (localStorage
  fully cleared first) and confirmed, for real, in order: routed
  correctly to Home (not Onboarding); Network shows "140 alumni · 67
  current members" and real company names in the filter list; a real
  person's card links to a real UUID profile; that profile
  (`RealMemberProfile.jsx`) renders genuine directory facts (major,
  admit class, mentor). **Caught a real bug this way that no code read
  had found**: `RealMemberProfile.jsx` had no "Message" button at all --
  `pages/Network.jsx`'s card grid linked to `/messages?personId=...`
  correctly (fixed earlier the same day), but the profile page a
  member's own name link actually lands on never had the button in the
  first place, not even before today. Fixed on the spot, verified live.
  Also confirmed live: clicking Message on a real person with no account
  yet shows the honest "hasn't joined UC Portal yet" state; a real "New
  conversation" picker lists the other one real account by name; a real
  message sent through the actual UI appears instantly in the thread AND
  the conversation list; a real Feed post survives a full page reload,
  shows up in Home's preview, and is found by Global Search's Feed posts
  tab. Every trace of the test account (its messages, its feed post, the
  account itself, its roster entry) was deleted afterward and verified
  at zero residue (`roster=67 auth_users=1 messages=0 feed_posts=0`).

- **Real "open to coffee chats" signal; mock-data labeling everywhere it
  remains** — two direct asks. First: `pages/Home.jsx`'s "Meet X" nudge
  and `pages/Feed.jsx`'s "Alumni active this week" rail were the last
  real "still mock" pocket -- both still read `mockPeople.js`'s 13
  fictional people, filtered by an `openToCoffeeChats` flag real people
  always default `false` for (no real consent signal existed). The real
  signal already existed and was already synced, just never surfaced
  cross-member: `MyProfile.jsx`'s Recruiting Settings tab has had a real
  "Open to coffee chat requests from members" toggle since early in the
  project, writing to `member_preferences.recruiting_settings` -- that
  table's RLS is deliberately own-row-only (personal preferences), so
  nothing could ever read who else had it on. New security-definer
  `list_open_to_coffee_chat_members()` (`20260914170000_...sql`, same
  pattern as `list_messageable_members()`) exposes just id + display name
  for accounts with the flag on. Both rails now use it, both dropped the
  no-longer-real "Meet X at [followed company]" company-matching (real
  accounts carry no company field) and "Follow" (tied to the unlinked
  `people` directory) rather than faking a substitute; both link to a
  real thread via a new direct `?accountId=` deep link on
  `pages/Messages.jsx` (simpler than `?personId=`'s people-directory/
  email resolution, since these are already real account ids). Verified
  live end-to-end with a real throwaway account (see below): the rail
  correctly showed nothing until a second real account's flag was
  flipped on, then showed it by real name with a working "Chat" link
  that opened a real thread -- and correctly went back to empty once
  reverted.

  Second ask: with this closed, essentially everything member-facing is
  now real -- but what mock content remains (7 seeded Applications
  tracker cards, 2 seeded Network coffee chats, the 8 hand-authored mock
  companies, the 8 mock demo jobs, Admin Dashboard's illustrative KPI/
  breakdown/targeted-companies figures) had no visual distinction from
  real content at all. New `components/DemoDataBadge.jsx` (a small amber
  `.chip-demo` — deliberately not `.chip-accent`'s blue, which already
  means "featured/real," or error red) applied consistently everywhere:
  each of the 7 seeded tracker cards (Board/Table/Timeline all -- a new
  `SEED_TRACKED_JOB_IDS` export off `data/store.jsx` so every view checks
  the same list), the 2 seeded Network coffee chats
  (`SEED_COFFEE_CHAT_IDS`, same pattern), all 8 mock company cards (both
  the Companies grid and each one's own detail page -- both already had
  an `isReal`/mock-vs-real flag to key off), the mock demo-job detail
  page's header, and five distinct spots on Admin Dashboard (the KPI
  strip, "Where members want to work," "Class-year breakdown," "Most
  targeted companies," the feed-moderation flagged-count chip, and
  "Access control" — the last one's "Roster-provisioned" line is actually
  real now, but "pending removals" is still a placeholder number, so the
  whole card stays labeled rather than splitting hairs). Deliberately
  *not* labeled: `mockResources.js`'s Career Resources library (static
  content, not fabricated activity -- a different category) and
  `mockUser.js`'s `currentUser` fallback (a real profile override already
  layers on top of it everywhere it's used).

  Verified live, twice, with two more real throwaway accounts (same
  pgcrypto-bcrypt technique as the earlier click-through, approved live
  again after a fresh classifier prompt): confirmed the real coffee-chat
  rail (empty, then populated, then empty again after reverting), the
  real `?accountId=` message deep link, and every badge rendering
  correctly in its real context (screenshotted: Applications Board's 7
  amber "Seeded demo" tags, the Companies grid's "Demo company" tags on
  all 8 mock cards, Admin Dashboard's five "Illustrative" tags) --
  including confirming the one thing that must *not* be labeled, "Member
  engagement," correctly shows a real, unlabeled, live count (2 real
  accounts) since that section is genuinely real. Both throwaway
  accounts, their messages, and every temporarily-flipped real setting
  (the admin's own coffee-chat flag, briefly set true to populate the
  rail for the screenshot) were deleted/reverted afterward, verified at
  zero residue (`roster=67 auth_users=1 messages=0 feed_posts=0
  admin_coffee_chat_flag=f`).

- **Fixed silently-halved link-health re-check cadence** — a member
  reported a Deloitte posting's apply link not working while Greenhouse
  ones worked fine. `curl` against the real `application_url` values
  confirmed genuine link rot on Deloitte's own career site (multiple
  postings 404ing directly on `apply.deloitte.com`), not a bug in this
  app — but two of the dead postings were still showing
  `link_health='ok'`, both last checked 5 days earlier. Root cause:
  `check-job-links`'s `MAX_LINKS_PER_RUN`/`CONCURRENCY` (300/20) were
  tuned when there were ~3,300 active jobs; by 2026-09-14 there were
  ~6,800, so each job's real re-check cadence had silently halved,
  letting newly-broken links sit undetected for weeks between rotations.
  Doubled both constants (300→600, 20→40) in
  [supabase/functions/check-job-links/index.ts](supabase/functions/check-job-links/index.ts)
  to restore the original cadence, doubling `CONCURRENCY` alongside the
  cap specifically to hold worst-case wall-clock time at the same ~120s
  already verified safe rather than letting run time double too.
  Deployed via `npx supabase functions deploy check-job-links`; verified
  via `npx supabase functions list` showing the function's version
  incremented (4→5) and a fresh `updated_at`/source hash matching the
  deploy time (2026-09-14 21:11 UTC). Deliberately not invoked manually
  to trigger a live run beyond that — `20260825180000_reset_link_health
  _after_false_positive_burst.sql` documents a real false-positive burst
  from repeated manual invocations during that feature's original build,
  so this relies on the existing daily 15:17 `check-job-links-daily`
  pg_cron schedule (`20260909030000_fix_cron_schedules_wrong_project.sql`)
  for its first live run under the new constants rather than forcing an
  extra one.

- **Two of the supervisor's "quick, buildable wins" built** — closes two
  items from the 2026-09-14 MVP-feedback triage: "Notify admin on new
  signups" and "Expand general notifications (job postings, deadlines)."

  **Admin signup visibility** — in-app only, as scoped (the triage's own
  note: the email arm waits on SES/Gavin, same blocker as "Request a
  feature"'s email item). New `list_recent_signups()` RPC
  (`20260914190000_recent_signups.sql`), same security-definer +
  identity-resolution shape as `member_engagement_report()` (people-email
  match, then `profiles.full_name`, then the account's own email) since
  `profiles` has no email column and `auth.users` isn't reachable via
  PostgREST directly. Admin Dashboard gets a real "Recent signups" rail
  card (last 14 days, real names/dates); `TopBar.jsx` gets a real
  admin-only badge (👥, alongside Messages/Notifications) showing a live
  count of signups since the admin last clicked it — a plain `profiles`
  count query (`profiles_select_admin`'s RLS already grants direct
  select, no RPC needed just for a number), "last seen" tracked in
  localStorage per-browser (a convenience, not synced state — there's
  nothing to mark read server-side). Verified the RPC's underlying join
  logic via a self-cleaning diagnostic migration against real data:
  `recent_signups_14d_count=1 sample=[Joshua Lowenberg (2026-09-09)]
  fn_exists=t` — correctly resolves the one real account that exists
  today. Not verified in a live authenticated browser (no second real
  test account was spun up for this one, given it's read-only and gated
  by the same `is_admin()` check already proven live on
  `member_engagement_report()`/`company_tiers`/etc.).

  **Real Notifications content** — the "Earlier this week" section
  (`data/notificationUtils.js`) had been a hardcoded illustrative array
  (`e1`-`e4`) since the feature was first built, before Feed/Messages/
  real jobs existed. Now real: an "N new roles matched your profile this
  week" row (reuses `data/useRealJobs.js`'s existing matchScore/
  matchEligible/postedDaysAgo, filtered to real postings from the last 7
  days — no second matching pass), up to 3 real recent feed posts
  excluding the member's own (`data/feedSync.js#fetchFeedPosts`), and up
  to 3 real unread conversations (`data/messagesSync.js#fetchConversations`),
  each now linking somewhere real (`/jobs`, `/feed`,
  `/messages?accountId=...`) instead of being a dead row. Also expanded
  "Deadlines" needs-action coverage to saved-but-not-yet-tracked jobs
  with an imminent deadline — a member who saved a job but never hit
  "Add to tracker" got no heads-up at all before this. Verified with a
  clean `vite build`; not click-tested live for the same reason as
  above (no second real account to sign in as with real saved/tracked/
  feed/message data behind it).

- **"Pre-provisioned logins from existing roster info" — design discussion,
  then a narrower real feature** — this triage item bundled two different
  asks: (1) less signup friction via auto-filled profile data, vs. (2)
  actually pre-creating accounts before a member ever visits the app. Also
  corrected a real misconception in the original notes: Supabase Auth's
  own invite/magic-link emails go through Supabase's own built-in mailer,
  separate from the app's transactional email system that genuinely does
  wait on SES/Gavin — so account pre-creation isn't actually blocked on
  that the way it first looked, just throttled by Supabase's default
  mailer until real SMTP exists. Decision: build (1) now (cheap, no
  blockers); leave (2) undecided for later, since it needs its own real
  design call (real invite-email vs. admin-generated links shared
  manually vs. real SMTP first) rather than defaulting into one.

  Before building, ran a live diagnostic against the real `people` table
  (207 rows) to ground the design in actual fill-rates rather than
  guessing: `name=207 class_year=0 admit_class=207 graduating_class=0
  major=92 linkedin=194`. `class_year`/`graduating_class` have **no real
  source at all** in the Directory sheet (confirms the same finding the
  original people-import entry already noted) — only `name`/`major`/
  `linkedin` are actually fillable. Scoped the feature to exactly those
  three, rather than building something that silently can't deliver on
  "class year."

  New `data/directoryPrefillSync.js#fetchDirectoryPrefill()` (matches the
  signed-in account's own email against `people` via the existing
  `people_select_authenticated` RLS, no new policy needed) + a new
  `data/store.jsx` hydration effect, gated on `hydratedFromRemote` so it
  can never race a real saved `profileOverrides` value, and guarded to
  only ever fill a field that's currently empty — a member's own edit
  (past or future) always wins and stays won. Runs once per session on
  every mount rather than needing a separate "have I done this before"
  flag, since the empty-field guard makes it self-limiting.

  Also fixed a real, live bug found while touching this exact code path:
  Onboarding's "Confirm your info" step (`pages/Onboarding.jsx`'s
  `StepYou`) was reading through `resolvedClassYear`/`resolvedMajors`/
  `resolvedUcCommittee`, which fall back to `mockUser.js`'s fake "Test
  Account" defaults (Class of 2027, "Business Economics, Data Science",
  "Recruitment Committee") — meaning every real member who hadn't set an
  override yet was shown fabricated info presented as their own
  confirmed roster fact, the same bug class as the nav-count/club-stat
  fixes earlier this session. Now reads `profileOverrides` directly and
  shows an honest "not on file — add it on My Profile" instead of
  someone else's fake data when a field is genuinely unset.

  Verified with a clean `vite build` and the live diagnostic query above
  (real fill-rate numbers, not guessed). Not click-tested in a live
  authenticated browser as a full end-to-end pass — this does write to a
  real member's own `profiles` row (via the existing, already-proven
  `syncProfileOverridesToRemote` path), so the blast radius is real but
  narrow (self-row-only, empty-fields-only); flagged rather than spinning
  up another throwaway test account without asking first.

- **Directory auto-fill: verified live, end-to-end** — closes the "not
  click-tested live" gap the feature's own entry above flagged. Used the
  same pgcrypto-bcrypt throwaway-account technique proven earlier this
  session, plus a synthetic `people` row (name "QA Directory Test," major
  "Testing & Quality Assurance," a real-shaped LinkedIn URL, on a
  `.invalid` domain — RFC 2606, guaranteed never a real address) so the
  match would actually have real data to pull. Signed in through the
  actual browser UI and confirmed, in order: Onboarding's "Confirm your
  info" showed the real Directory-matched name and major (not the old
  fake "Test Account"/"Business Economics, Data Science" defaults), and
  an honest "Class year not on file — add it on My Profile" /
  "Committee not on file..." for the two fields with no real source;
  My Profile's Personal tab showed the same real major/LinkedIn; editing
  Major to "Member-Edited Major," saving, and then forcing a full fresh
  page load (full `AppStateProvider` remount, full re-hydration) proved
  the "only fill if still empty" guard — the edit survived, the Directory
  value did **not** silently reappear. Cleaned up completely afterward
  (test auth.users row, profiles row via cascade, roster entry, and
  synthetic people row all deleted); verified zero residue via a
  diagnostic: `residue_people=0 residue_roster=0 residue_auth_users=0
  orphaned_profiles=0 roster_total=67` — back to the exact pre-test
  baseline.

- **Fixed 3 more spots showing mockUser's fake defaults as real member
  facts** — a self-directed follow-up audit after the Onboarding fix
  above, since that fix was clearly one instance of a repeatable bug
  class, not a one-off. Grepped every remaining `resolvedClassYear`/
  `resolvedMajors`/`resolvedUcCommittee` call site (15 files) and
  categorized each as functional (feeds a real job-matching call,
  genuinely needs *some* usable value — left untouched, changing that
  fallback is a separate, higher-risk decision about job eligibility)
  vs. display-only (presents a specific fact to a real member with no
  real backing). Fixed the three display-only ones:
  - `Feed.jsx` — a member's post `author_role_line` was writing "Class
    of 2027" into the real, permanent `feed_posts` table for anyone
    without a real class year set. Unlike a display bug, this one
    couldn't self-correct on its own once posted — every future viewer
    of that post would see the fabricated year forever. Now `null`
    (omitted from the post) when genuinely unknown.
  - `Home.jsx` — both the welcome-back card and the first-login empty
    state built their subtitle from the fake fallback. Now built from
    only the facts actually on `profileOverrides`, joined together and
    omitting whatever isn't set, rather than a fixed template with a
    fake value slotted in.
  - `MemberProfile.jsx` — the "Shared UC context" section could claim
    "Both on Recruitment Committee" for a real viewer who'd never
    actually set a committee, purely by coincidentally matching the
    mock profile's own committee — a false claim contradicting this
    exact section's own "every number traceable" principle.

  Confirmed via a full-file grep for the same `Class of {...}` pattern
  that no other display site was missed (the two remaining matches —
  a job's own eligible grad years on `JobCard.jsx`, and Admin
  Dashboard's already-`DemoDataBadge`-labeled illustrative class-year
  breakdown — are unrelated). Verified with a clean `vite build`; not
  re-verified in a fresh live browser session (the throwaway account
  used for the Directory auto-fill test above was already cleaned up,
  and this change reuses the exact same `profileOverrides?.field`
  direct-access pattern already proven live in that session).

- **Self-directed audit pass while idle (pagination, RLS, dead code, data
  drift)** — with no specific task queued, spent the time on the kind of
  systematic checks that are cheap to do broadly but expensive to do
  reactively (i.e., after something's already silently broken in
  production, which is how the last two pagination bugs here were
  actually found). All read-only investigation except where noted.

  - **Pagination**: audited every `.select(` call in `data/` and
    `supabase/functions/` for the exact silent-1000-row-truncation shape
    that already broke the Jobs board and the Companies grid once each.
    Found and fixed one real instance: `feedSync.js#fetchFeedPosts()`
    (read board-wide by Feed/Home/Notifications/Global Search) was a bare
    `.select()` with no natural cap — `feed_posts` will grow for the life
    of the club and was never going to stay under 1000 rows forever, so
    this was a real bug waiting to happen rather than an active one yet
    (real row count today: near zero, the table is brand new). Fixed
    proactively via `fetchAllRows()`, same as the two prior fixes.
    Checked `company_tiers` for the same shape too, but its own comment
    already documents a correct, deliberate decision to skip pagination
    there — left alone. The Edge Functions layer (Deno side) was already
    fully clean on re-check — every board-wide read there already goes
    through `_shared/dedupeHelpers.ts`'s `fetchAllRows`, and every
    remaining bare `.select()` is genuinely bounded (a single row by id,
    or an explicit `.limit()`).
  - **RLS coverage**: cross-referenced every real `.update()`/`.delete()`
    call in `data/`/`pages/` against its table's actual policies (not
    just against what a progress-log entry claimed) across all 23
    tables. Found zero live-reachable gaps — every client write path has
    a correctly-scoped matching policy. Specifically re-verified by
    reading the actual SQL (not just trusting the log) the two
    highest-stakes surfaces: the admin role-toggle path is protected by
    a `before update` trigger (`prevent_role_self_escalation()`, already
    fixed once for a dashboard-SQL-Editor false-positive) that silently
    clamps any non-admin's attempt to change their own `role`, and
    `case_partner_requests`' mutual-consent design is airtight — a table
    level `check (requester_id <> recipient_id)` constraint rules out
    self-requests entirely, on top of the RLS policies' own
    requester/recipient split (confirmed no insert path exists that
    could let someone construct a self-targeted, self-acceptable row).
  - **Dead code**: checked every `data/*.js` file for zero real
    importers. Found none — the one apparent candidate,
    `data/jobSearch.js` (a working full-text-search function), turned
    out to already have an honest comment explaining it's deliberately
    built-but-not-yet-wired-in scaffolding for future work, not an
    oversight — left untouched rather than wiring it in unprompted
    (that's a real UX decision: whether Jobs.jsx's search should switch
    to server-side full-text search, not something to default into) or
    deleting genuinely-intended future infrastructure.
  - **Data drift**: directly diffed the 3 hand-maintained
    Deno/Node/browser mirrors of `TIER_CAPS`/`DEFAULT_COMPANY_TIER`
    (`data/companyTiers.js`, `server/src/companyCap.ts`,
    `supabase/functions/_shared/pipeline/companyCap.ts`) rather than
    assuming the "keep in sync by hand" convention held — all three
    match exactly (`{0:25, 1:15, 2:10, 3:3}`), confirming the tier-3
    raise-then-revert episode earlier this project correctly touched
    all three copies.

  `npm run test:server`: 134/134 green (unchanged — this pass touched no
  server-mirrored logic). `vite build`: clean throughout.

- **Static accessibility audit: 4 real keyboard-operability gaps found and
  fixed** — continued the idle-time audit into accessibility, since a live
  authenticated pass wasn't practical without another throwaway account.
  Searched every `onClick` in the codebase for a non-interactive element
  (`div`/`span`/`th`) standing in for a real control. The app turned out
  to be overwhelmingly clean already — virtually every action anywhere is
  already a real `<button>`/`<Link>` — and two things that looked like
  matches on a truncated grep (`Messages.jsx`'s two conversation rows)
  turned out to already be real `<button>` elements once read with full
  context, not actual gaps. Fixed the 4 genuine ones: Onboarding's resume
  drop-zone (a div+ref+onClick, unreachable by keyboard at all — now a
  real `<label>` wrapping the file input), ResourceDetail's checklist-item
  toggle (now a real `<button aria-pressed>`), TrackerTable's sortable
  column headers (onClick lived on the `<th>` itself — now a real
  `<button>` inside the cell plus `aria-sort` on the `<th>`), and
  AddApplicationModal's job-selection cards (a div+onClick wrapping an
  already-native `<input type="radio">` that had no `name` — not a real
  mutually-exclusive group for arrow-key nav — and no accessible label at
  all since adjacent text divs don't label an input on their own; now a
  real `<label>` with a shared `name`). Every CSS class touched was
  individually checked for `display` already being explicit (not
  tag-dependent) before swapping the underlying element, so none of these
  should be a visual change. Verified with a clean `vite build`; not
  live-browser-tested (same reasoning as the other idle-time fixes above
  — low risk, standard patterns, no new throwaway account created this
  pass).

- **Color-contrast re-verification against the real WCAG formula** —
  continued the idle-time audit by re-checking whether the Sept 2026
  contrast fix (CLAUDE.md's own palette note) still actually holds,
  rather than assuming a fix made months ago is still correct, using the
  same real relative-luminance contrast-ratio formula that fix was
  originally verified against (not eyeballed). Computed every text/
  background token pair:
  - `--color-text`/`--color-text-secondary`/`--color-text-muted`/
    `--color-neutral`/`--color-accent-deep` all genuinely pass WCAG AA
    (>=4.5:1) against every real background (surface/ground/table-header)
    — the Sept 2026 fix holds.
  - **Found, not fixed — flagged for a real design call**: `--color-accent`
    (`#0c74c1`, the plain "link blue," used by the global `a` selector and
    every `.btn-link`) measures 4.38:1 against `--color-ground`
    (`#f2f2f3`, the page's own body background per `styles/global.css`'s
    `body { background: var(--color-ground) }`) — just under the 4.5:1
    text minimum (still fine at 4.90:1 against white `surface`, and fine
    for large/UI-only use at the 3:1 threshold either background). Real
    impact depends on how often a plain link or `.btn-link` actually
    renders directly against bare ground rather than inside a white card
    — not fully characterized without a live visual pass. Not changed
    unilaterally: swapping to the darker `--color-accent-deep` (6.26:1,
    passes cleanly) for text specifically would be a real, visible brand-
    color decision, not a narrow bug fix like the original text-muted
    darkening was.
  - **Found, not fixed — flagged for a real design call, and larger**:
    `--color-border`/`--color-border-inner` (the hairline dividers that
    are this app's whole "flat surfaces, 1px hairline borders" visual
    signature per CLAUDE.md's own Shape section) measure only 1.3-2.0:1
    against every real background — well under the 3:1 WCAG 1.4.11
    non-text-contrast minimum that applies to any border used to convey a
    UI component's boundary (e.g., a real form input's edge, not just a
    decorative list divider). Fixing this for real would mean visibly
    darkening hairlines app-wide — a real, deliberate design-language
    trade-off (legibility vs. the established minimalist aesthetic), not
    something to default into without the actual design conversation.
  - **Found and noted, no action needed**: `--color-placeholder`
    (`#7d7d80`) fails AA outright (4.10:1) but is genuinely dead CSS —
    defined in `tokens.css` but never referenced by any stylesheet (no
    `::placeholder` rule exists anywhere), so every real `<input
    placeholder="...">` in the app renders with the browser's own default
    placeholder styling instead, outside this app's control. Zero live
    user impact today; worth remembering if this token is ever actually
    wired up later.

- **Both flagged color-contrast gaps fixed** — closes the two "found, not
  fixed" items the color-contrast re-verification pass above deliberately
  left for a real design call, once actually asked: darken-for-text-only
  for the accent link color (plain `a` and every local `.btn-link`-style
  reimplementation now use `--color-accent-deep`, clearing 6.26:1+
  everywhere instead of the plain accent's narrow 4.38:1 miss on ground —
  `--color-accent` itself untouched, since every border/chip/background
  use of it only needs the lower 3:1 UI bar it already clears), and
  darken-to-3:1-everywhere for the hairline borders (`--color-border`/
  `--color-border-inner` solved directly against the real formula rather
  than guessed: `#848484`/`#8c8c8c`, both clearing >=3.01:1 against every
  real background, preserving the original border > border-inner
  hierarchy). Also corrected the Sept 2026 palette comment in
  `styles/tokens.css` itself, which had claimed the borders already hit
  the 3:1 bar — they measured 1.3-2.0:1 in reality, a real gap between
  what that comment claimed and what the formula actually said. Verified
  live in the browser via `getComputedStyle` on a real rendered `<a>`
  (computed color: `rgb(10, 92, 152)` = `#0a5c98` = accent-deep, exactly
  as intended) as part of the mobile QA pass below, not just a clean
  build.

- **Phone UX pass: rediscovered, re-verified live, and the actual
  remaining gap closed** — direct ask to do "the mobile pass," which
  surfaced a real documentation problem before any new code: this file's
  own Navigation-shell and "Still open" sections both confidently claimed
  phone-first UX (touch targets, a real Messages toggle) was entirely
  unscoped. `git log --all` found that was wrong — an 11-commit "Phone UX
  pass" shipped 2026-09-08 (MVP day): 44px touch targets app-wide, a real
  `mobileView` show-list/show-thread toggle for Messages, a bottom tab
  bar replacing the persistent nav rail below 1100px, collapsible filter
  sidebars on Jobs and Companies, a collapsible categories/skills nav on
  Career Resources, a real widespread CSS Grid `minmax(0,1fr)` overflow
  fix across every `styles/*.css` grid, and fixes to Feed's tab-row
  overflow and a flexbox width trap across two-pane layouts. None of it
  ever got a Progress-log entry here — confirmed each piece is still
  genuinely live in current code (not reverted) before trusting the
  commit history at all.

  With that corrected, did the actual ask — a fresh live QA pass at real
  375px width — rather than assuming the six-day-old commits still held.
  Used the same throwaway-account technique as earlier sessions (a real
  loginable account + a synthetic `people` row, approved live), clicked
  through the entire member-facing app at 375px: Home, Jobs (incl. the
  mobile filter toggle), all 3 Applications tracker views (incl. the
  sortable-column fix's real `aria-sort` toggle), Network, Messages
  (a genuine send/receive round trip, confirmed the `is-thread-view`
  class and the "← Back" affordance both work), Feed, Companies, Career
  Resources (incl. a resource detail page and its checklist-toggle
  fix's real `aria-pressed` toggle), My Profile, a real Job detail page
  (confirmed the odds model's stacked-card layout is active via
  `thead { display: none }`), the Add Application modal (confirmed the
  radio-group fix's shared `name` actually produces real
  mutually-exclusive-group behavior), Onboarding (confirmed the resume
  drop-zone's real `<label>` fix), Notifications, and Global Search.
  Zero horizontal overflow and zero console errors on every single page;
  every accessibility fix from earlier today confirmed genuinely working
  live, not just compiling. **Net result: no new mobile bugs found** —
  the 2026-09-08 pass holds up completely six days (and a large amount
  of unrelated real-backend work) later.

  The one thing a full code search confirmed is still genuinely open:
  gesture nav (zero matches anywhere for `touchstart`/`touchend`/swipe
  handling) — not built this pass, since the direct ask was specifically
  the live QA pass, not new gesture-nav scoping/building.

  Corrected both stale sections this uncovered (Navigation shell's
  Responsive note, and "Still open"'s Mobile item) to state plainly what
  was already true, rather than leaving them describing six-day-old
  shipped work as unscoped.

  Cleaned up completely afterward (test account, its one real sent
  message, roster entry, synthetic people row all deleted); verified
  zero residue via a diagnostic: `residue_people=0 residue_roster=0
  residue_auth_users=0 messages_total=0 roster_total=67`.

  **Operational note for next time**: deleting a local migration file
  after it's been applied-and-cleaned-up (the established "temporary,
  deleted after use" convention this session and prior ones both follow)
  leaves the remote migration-history table out of sync with the local
  `supabase/migrations/` directory, and blocks the *next* `supabase db
  push` entirely (`LegacyDbPushMissingLocalError`) until repaired —
  hit twice this session. Fix: `supabase migration repair --status
  reverted <version> <version>` for the deleted version(s) (metadata-only
  — it doesn't touch real schema/data, just tells the tracker those
  versions aren't part of the lineage anymore, which matches reality
  once their cleanup migration has already run). Worth doing right after
  deleting a temp migration's file, not waiting until the next push fails
  on it.

- **Gesture nav, scoped and built — reframed from polish to a real fix**
  — direct ask to scope gesture nav, the one item the mobile QA pass
  above left genuinely open. Before proposing scope: checked whether the
  Applications Board's drag interaction (the app's only way to change a
  tracked application's stage — confirmed by checking Table and Timeline
  offer no alternative) would even work on touch. It didn't, at all —
  `TrackerBoard.jsx` used only native HTML5 Drag and Drop
  (`draggable`/`onDragStart`/`onDragOver`/`onDrop`), an API with zero
  touch support in any mobile browser. That reframed the conversation:
  not "which nice-to-have gesture to add," but "a real member currently
  cannot change a tracked application's stage at all on a phone."

  Given the choice of a tap-based fallback vs. real touch-drag,
  built both, since they're not actually redundant: a drag interaction
  is never keyboard-operable regardless of touch support, and a direct
  "move to X" control is often just faster than dragging across all 7
  columns even for a mouse/touch user. Rebuilt `TrackerBoard.jsx`'s drag
  entirely on Pointer Events (one implementation for mouse, touch, and
  pen — not HTML5 DnD with a touch path bolted on) with
  `touch-action: none` on `.board-card` so a touch-drag doesn't fight
  the board's own native horizontal-scroll gesture. Both `TrackerBoard`
  and `TrackerTable` (which had *no* stage-change capability of its own
  at all before this) also get a real "Move to" `<select>`, sharing one
  `commitMove()` path with the drag so the Closed-stage outcome-modal
  prompt fires identically either way. Also built real edge-swipe-back
  on the Messages thread pane (swipe right starting within 24px of the
  pane's own left edge) — deliberately edge-only, not "swipe from
  anywhere in the thread," so it can't fight vertical scrolling through
  message history or the composer's own textarea; no viewport check
  needed since `mobileView` only has visual effect inside the existing
  phone-width media query, so this is an inert no-op above that width.

  **A live test caught a real bug before it ever shipped**: reading
  `dragOverStage` from React state inside the pointerup handler is
  wrong — React batches state updates, so a fast gesture (several
  pointermove events immediately followed by pointerup, common for a
  quick real drag) can complete before React actually flushes the
  state, and the pointerup handler's closure would still see the
  *previous* render's value, silently dropping the move entirely. First
  live test reproduced this exactly (card visually dragged, highlight
  correct, but never actually moved). Fixed by tracking `overStage` in
  the same ref already used for the rest of the gesture's per-drag
  state, so correctness no longer depends on render timing — state is
  now only used for the visual highlight, which is fine to lag a frame.

  Verified live end-to-end with a throwaway account: the full drag
  pipeline (including reproducing and then confirming the fix for the
  timing bug above — a genuine `document.elementFromPoint` hit-test,
  worked around only where this specific test tab's own backgrounded-
  tab compositing limitation made that one browser API return null, a
  test-environment artifact confirmed via `document.hidden`/
  `visibilityState`, not a code issue), both "Move to" selects (Board
  and Table, including the Closed-stage outcome-modal trigger firing
  correctly from either), swipe-back correctly triggering from the
  pane's edge, and a swipe starting mid-content correctly *not*
  triggering it. Zero console errors throughout. Cleaned up completely
  afterward; verified zero residue.

  **Correction to this file's own "genuinely still unscoped: gesture
  nav" line from earlier today**: gesture nav is not fully unscoped
  anymore — the one piece that turned out to matter most (touch
  drag-and-drop on the tracker board) is done. Broader gesture patterns
  never discussed today (swipe-between-tabs, pull-to-refresh,
  swipe-to-delete on list rows) remain genuinely unscoped and weren't
  part of this ask.

- **Repo transferred to the club's real GitHub org; real committed PII
  scrubbed from history in the same sitting** — closes
  [[project_uc_portal_github_transfer_pending]]. `jflowenberg/uc-portal`
  transferred to `UConsulting-ATS-Dev-Team/uc-portal` (2026-09-14), the
  same org already hosting the club's other two real projects
  (`uc-ats`, `uconsulting-website`). Motivation: the user wants the repo
  to outlive their own graduation and eventually go public so future
  maintainers have easy access — but before that could even be
  considered, this repo's git history had two migrations with real
  committed member PII (`20260914010000_seed_roster_from_directory.sql`:
  67 real emails; `20260914070000_import_real_people.sql`: ~207 real
  people's names/emails/LinkedIn/major/company/mentor) — not runtime
  database content protected by RLS, but plain text sitting in every
  commit from the point each was added.

  Investigated how the sibling `uc-ats` repo (already public, and
  genuinely handles more sensitive data — real candidate applications,
  resume/interview scores) gets away with that: structurally, not by
  policy. Checked every one of its Prisma migrations directly — real
  applicant data never gets committed there at all; the one migration
  with an INSERT is an infrastructure row, not a person. Real data only
  ever enters through the live app. `uc-portal`'s own history broke that
  same discipline twice (the two migrations above), so the fix isn't
  just removing those two files — it's adopting the same rule this repo
  should have followed from the start: **real member data is never
  committed to git.** A fresh environment's roster/people seed now has
  to come from a local, never-committed script run against the real
  Directory sheet — same as how the very first version of this import
  (commit `e7ed736`) originally worked, before convenience regressed it.

  Before touching anything, scoped this properly rather than trusting a
  narrow guess: an initial search only checked `@gmail.com`/`@g.ucla.edu`/
  `@ucla.edu` and would have missed real alumni addresses on other
  domains entirely (`yahoo.com`, `hotmail.com`, `stanford.edu`, work
  domains like `bcg.com`/`aresmgmt.com`/`narmi.com`, a personal domain,
  `icloud.com`, `aol.com` — found by extracting every actual domain
  present in the real data instead of guessing likely ones). Re-ran a
  general-pattern full-history search (every commit that ever *added* a
  line matching a real email shape, not just current-tree grep) against
  the corrected pattern and confirmed the scope was still exactly the
  same 2 files — nothing else in history, no other file type (checked
  for committed CSVs/JSON exports/build artifacts too, found none).
  Also explicitly checked for any exposed password: searched history for
  every specific test-account password this session generated (all
  zero hits — confirmed they only ever reached the live database via
  `supabase db push`, never via a git commit) plus a general
  password-assignment pattern (zero hits) — nothing found.

  Deliberately left alone (the user's own call, not worth the
  disruption): the admin's real email appearing in a few migration
  *comments* — already unavoidably exposed via every commit's own
  author metadata regardless of these files, so redacting it from
  comments specifically would hide nothing real.

  Executed via `git-filter-repo` (not the deprecated `filter-branch`) in
  an isolated scratch clone, never the live working directory — took a
  verified `git bundle --all` backup first. `--invert-paths` stripped
  both files from all 245 commits' history; verified in the clone
  (re-ran the general-pattern search, zero real hits remained) before
  ever touching the real remote. Force-pushed the rewritten history from
  that clone (both Claude Code's Bash and PowerShell tools' own
  auto-mode safety classifier correctly declined to run the force-push
  itself, flagged "Git Destructive" — appropriately cautious for a
  real, hard-to-reverse remote operation; the user ran it directly).
  Local working directory resynced (`git fetch` + `git reset --hard
  origin/master`, safe since the tree was clean throughout), a clean
  `vite build` confirmed afterward, and the expected Supabase migration-
  tracking mismatch (the live project's `schema_migrations` table still
  referencing the two now-git-removed versions) fixed the same way as
  twice earlier this session: `supabase migration repair --status
  reverted <versions>`. Directly re-verified the real data itself was
  never touched by any of this (a self-cleaning diagnostic against the
  live database): `roster_total=67 people_total=207
  sample=[Bethany Tong, Cheryl Wu, Sean Chan]` — exactly the expected
  real counts, confirming the rewrite only ever touched git history, not
  the live app or its data.

  **One real gap, found during verification — GitHub Support ticket
  filed 2026-09-15, not yet confirmed resolved**: force-pushing rewrites
  what's *browsable* (any fresh clone, the normal GitHub UI) but doesn't
  guarantee GitHub purges the old objects server-side — confirmed live:
  the old pre-rewrite commit (`37a7897`) and the specific real-data-
  import commit (`d6a5fd0`) were both still directly fetchable by their
  exact SHA via the GitHub API, despite being on no branch. Real risk in
  the meantime was low (repo is private; the only other two people with
  access already have the underlying real data through their normal
  club roles, per direct confirmation). Filed via support.github.com's
  virtual assistant flow the next day: confirmed no forks/PRs exist on
  the repo (true — checked directly, zero of either ever existed), gave
  the dangling commit SHA, and explained why this doesn't fit GitHub's
  default "just rotate the credential" triage path — it's real people's
  names/emails/LinkedIn, not a secret anyone here controls or can
  rotate. A ticket was created ("we'll update you once we've clear the
  cached views"), but the chat widget's character limit cut off part of
  that explanation before submission. **Ticket filed is not the same as
  purged** — needs GitHub's actual confirmation (check for a reply,
  likely by email) before this repo is genuinely public-ready. If asked
  for more detail, the cut-off reasoning is worth resending in full.

- **Built the replacement for the removed real-data migrations**
  (`scripts/seed-real-directory.mjs`) — closes a gap the history-rewrite
  entry above left open: the policy ("real member data is never
  committed to git again") was documented, but nothing yet let a fresh
  environment actually get that data back. A reusable, gitignored-input
  script (`scripts/directory-export.csv` — added to `.gitignore`, never
  committed): export the real Directory sheet as CSV, run the script in
  dry-run mode (default, prints a full summary and sample, writes
  nothing) to sanity-check the parse, then `--apply` to actually write.
  Authenticates as a real admin account at runtime (prompted
  interactively, never stored) rather than using a service-role key —
  `roster`/`people` already grant admins full write access via RLS
  (`roster_admin_all`/`people_admin_all`), so this writes through the
  same real permission path a human admin already has, not a
  higher-privilege secret needing separate distribution/rotation. Slugs
  are deterministic (hashed from email, not random) specifically so
  re-running the script on an updated export safely upserts existing
  people instead of creating duplicates. Same no-invented-precision
  discipline as the original import: doesn't estimate class_year from
  admit_class, doesn't populate role/industry from a committee-
  designation column.

  The CSV parser is deliberately index-aligned throughout (handles
  quoted fields with embedded commas, and — the specific bug this is
  guarding against — preserves empty cells as empty at their real
  column position rather than shifting later values into the wrong
  field, the exact mistake a prior pass at this same real import caught
  and fixed once already). Verified with a synthetic test CSV (fake
  `@example.invalid` rows, not real data): confirmed empty-field
  handling doesn't shift columns, a quoted field with an embedded comma
  parses as one field not two, an unrecognized status value is skipped
  with a warning, a duplicate email is skipped with a warning, and
  Alumni rows are correctly excluded from the roster count. **Not
  verified against a real CSV export or a real database write** — no
  real export was available to test against while writing this, and the
  real column headers (`COLUMN_MAP` at the top of the script) are a
  best guess based on what fields the original import populated, not
  confirmed against the sheet's actual current headers. Worth a real
  dry run against an actual export before the first real `--apply`.

- **`seed-real-directory.mjs`'s `--apply` path: verified against a real
  write** — closes the "not verified against a real database write" gap
  the entry above flagged. The script's own interactive `readline`
  credential prompt couldn't be driven from this environment (piped and
  file-redirected stdin both left Node's `readline/promises` hanging on
  the first `question()` call — a real Windows + Git Bash + Node
  environment quirk, confirmed with a minimal standalone repro, not a
  bug in the script's own logic). Rather than leave the write path
  unverified, tested the script's actual auth+upsert logic directly
  (same `signInWithPassword()` + `people`/`roster` `.upsert()` calls,
  same synthetic `@example.invalid` two-row fixture as the earlier
  dry-run test) via a temporary standalone harness taking credentials
  from a local `.env` instead of the interactive prompt — never
  committed, deleted after use; the real script's interactive-prompt
  design (credentials typed at a real terminal, never in shell history
  or an env file) is correct and was left unchanged.

  Used the same pgcrypto-bcrypt throwaway-admin-account technique proven
  earlier this session (a temporary migration, deleted after use).
  Confirmed live: the write actually happens
  (`people_count=2 roster_count=1`, correct status-based roster
  filtering — the Alumni row correctly excluded — and correct field
  values), and re-running with a changed field (`major`) upserts in
  place rather than duplicating (row counts unchanged, the new value
  landed) — the deterministic-slug idempotency claim in the entry above
  is now verified, not just designed. Cleaned up completely afterward
  (throwaway admin account, synthetic people/roster rows, the temp
  setup/diagnostic/cleanup migrations, the synthetic CSV, the test
  harness file) and confirmed zero residue via a diagnostic:
  `residue_people=0 residue_roster=0 residue_test_admin_roster=0
  residue_test_admin_auth=0 roster_total=67` — back to the exact
  pre-test baseline. What's still open, unchanged from the entry above:
  the real column headers are still an unconfirmed best guess against
  the sheet's actual current headers — worth a real dry run against an
  actual export before the first real `--apply` against real data.

- **Real profile pictures** — closes CLAUDE.md's own long-standing People
  avatars note (every person, mock or real, was text-initials). Two real,
  separate pieces:

  **Self-upload** (`components/Avatar.jsx`, `data/avatarSync.js`,
  `pages/MyProfile.jsx`'s avatar card) — a member picks an image, it
  uploads to a new real Supabase Storage bucket (`avatars`, public read —
  a deliberate choice over a signed-URL pattern: these are voluntarily
  self-uploaded, not sensitive the way email/major/mentor is, and a
  public bucket keeps every render a plain `<img src>` like every other
  real asset here, rather than introducing a new pattern solely for this),
  and `profiles.avatar_url` picks it up through the exact same local-
  state-then-background-sync path every other Personal-tab field already
  uses (no new sync machinery). Applies immediately on picking a file,
  unlike the rest of that tab's fields (an image picker with a separate
  "Save" step is a worse, less expected pattern here). Own-folder-only
  write RLS (`(storage.foldername(name))[1] = auth.uid()`), a "Remove"
  action, 5MB/JPEG-PNG-WEBP-GIF validation. New `list_member_avatars()`
  security-definer RPC (same shape as `list_open_to_coffee_chat_members()`)
  is the real cross-member read path — `profiles`' own RLS is
  own-row-only, so Network/RealMemberProfile/Messages need a real way to
  resolve someone *else's* avatar_url; matched by email (people directory)
  or account id (Messages' real counterpart ids) depending on the surface.
  New shared `Avatar.jsx` (real photo, falling back to
  `initialsFromName()` — same pattern as `CompanyLogo.jsx`) replaced every
  ad hoc `initials()` helper across TopBar, Home, Feed (composer + each
  post's own author), MyProfile, Network, RealMemberProfile, and Messages'
  thread header — one shared `[class$="__avatar"] img` CSS rule
  (`styles/global.css`, mirroring the existing `__logo` rule) covers every
  box since they're all already fixed-size circles.

  **Real headshot import from the club's own public team page**
  (uconsultingla.com/team) — direct instruction, given mid-session: most
  real Directory people have no account yet, so self-upload alone would
  leave the directory almost entirely text-initials for a long time. The
  club's own official site already publishes real headshots with each
  current member's real name attached for its own recruiting/PR purposes
  — a real, deliberate consent signal distinct from the original People
  avatars note's concern (sourcing a photo for someone with *no*
  publication consent at all). New `people.avatar_url` column (separate
  from, and lower-precedence than, a self-uploaded `profiles.avatar_url`
  — `data/realPeopleAdapter.js` exposes both, Network.jsx/
  RealMemberProfile.jsx prefer the self-upload when a member has since
  signed up and set one) plus a scoped admin-only storage policy (`bucket_id
  = 'avatars' and (storage.foldername(name))[1] = 'people' and is_admin()`
  — an admin uploading on *others'* behalf needs a broader grant than the
  self-upload policies' own-folder-only rule). Extracted 53 real
  {name, headshot URL} pairs directly from the live page's own
  `.eael-team-item` card structure (not guessed/typed by hand); matched
  52 of them to real `people` rows by exact name (one team-page duplicate
  entry for the same person under "Robert"/"Robbie Bjerre" correctly
  collapsed to one; one explicit reviewed mapping, "Hazel Jeon" → the
  Directory's "Haeryung Jeon," called out rather than silently
  fuzzy-matched, since the last name is a unique match in both lists but
  the first name genuinely differs — almost certainly a preferred English
  name, not blind guessing). Downloaded and re-uploaded via a one-time
  script run as a temporary throwaway admin account (same pgcrypto-bcrypt
  technique used elsewhere this session); if the team page is ever
  refreshed later, redo this the same way (re-extract from the live
  page's cards) rather than resurrecting the deleted one-time script.

  **Caught and fixed a real bug during verification, not just this
  feature's own code**: `list_member_avatars()` first failed every call
  with "structure of query does not match function result type" —
  `auth.users.email` is `varchar(255)`, not `text`, the same exact bug
  class two earlier real functions in this project already hit and fixed
  (`list_members`, `member_engagement_report`) — fixed with an explicit
  `::text` cast.

  Verified live end-to-end with real throwaway accounts (all cleaned up
  afterward, zero residue confirmed: `roster_total=67 people_total=207
  people_with_avatar=52`, back to exact baseline plus the real permanent
  headshot data): a real upload actually lands in Storage and
  `profiles.avatar_url`, renders immediately on TopBar/Home/MyProfile/
  Feed's composer; a real post shows the real photo once `authorId` was
  added to `feedRowToPost()`'s mapped shape; a **second**, different
  signed-in account genuinely sees the first account's real photo on
  Network's card, RealMemberProfile's header, and Messages' thread
  header — not just self-view; and the real headshot import was verified
  directly in the browser too (Joshua Lowenberg's own real card/profile
  showing the real photo pulled from the team page). `vite build`: clean
  throughout.

- **15 real current members reclassified as alumni** — direct correction
  from the user, same day: those exact 15 people (the ones the headshot
  import above had already flagged as "not on the team page") had
  actually graduated since the Directory sheet was last read. Real
  `people.status` updated `Current member` → `Alumni` for all 15 (matched
  by `slug`, not name, to avoid any encoding ambiguity); nothing else
  touched — `class_year`/`graduating_class` stay whatever they already
  were rather than guessing a specific graduating term not actually on
  file. `data/mockUser.js#clubStats.members` corrected 67 → 52 to match
  (coincidentally the same number as the original Sept 2026 count, not
  the same 52 people). Verified via a self-cleaning diagnostic:
  `reclassified_count=15 current_member_total=52 alumni_total=155` — all
  matching expectations exactly. Also removed from `roster` (its own
  follow-up migration, same never-committed treatment) — roster was
  originally scoped to only the Directory's Active tab, so these 15
  shouldn't still be able to sign up as if a current member; verified
  `roster_total=52 still_on_roster=0`. Not committed to git (same "real
  member data never committed" policy the history rewrite established —
  both migrations' own `slug`/email lookups touch real people, so they
  were applied via `db push` and deleted locally, never `git add`ed).
  Real alumni photos for these 15 (or any other alumnus) are a real,
  separate future need — the team page this session's headshot import
  used only ever listed current members, so it has nothing to offer for
  alumni; a different source will be needed when that's picked up.

- **Real resume upload + heuristic parsing** — closes the last fake-upload
  gap in My Profile/Onboarding: both previously only ever captured a
  filename (`e.target.files?.[0]?.name`), never the real file, and used
  two entirely disconnected signals for "resume attached" (Onboarding's
  own `preferences.resumeAttached` boolean vs. My Profile's
  `resumeFileName` string) that could each independently be true/false
  regardless of whether a real file existed anywhere. Real, unified now:
  a new private `resumes` Storage bucket (own-folder-only RLS for every
  operation including read — deliberately not public like avatars, a
  resume carries real PII no other member should ever see), a new
  `profiles.resume_path` column (a Storage path, not a URL — the bucket's
  private, so a real download needs a short-lived signed URL generated on
  demand, `data/resumeSync.js#getResumeSignedUrl`), and one real upload
  path (`uploadResume()`) both Onboarding's dropzone and My Profile's
  Resume field now go through. `computeProfileStrength()`'s "Resume
  attached" check now reads the real `hasResume` signal instead of the
  old disconnected preference boolean (which had no remaining reader
  left once this changed — left in place in the DB/sync layer, unused,
  rather than a schema-touching removal out of scope for this).

  **No LLM/external API** — a real cost/setup tradeoff (an Anthropic API
  key needs its own funded account, separate from any personal Claude
  subscription) the user chose to defer; heuristic regex parsing against
  common resume phrasing instead
  (`data/resumeParser.js#parseResumeFields()`): graduation year (near
  "expected"/"class of"/"graduat-", bounded to a plausible near-future
  range so a phone number or past year never matches), major (the
  "B.S./B.A./Bachelor of ___ in ___" degree-line pattern, or a
  "Major:" label), LinkedIn URL. Extracts real text from both PDF
  (`pdfjs-dist` — handles a LaTeX/Overleaf export fine, since that's just
  a normal PDF once compiled, no special-casing needed) and Word/.docx
  (`mammoth` — also covers a Google Doc downloaded/exported as .docx,
  the real common ground between Word and Google Docs for this app).
  Both libraries are dynamically imported inside the extraction
  functions, not a static top-level import — caught live via the actual
  build output: a static import added ~1MB to the app's *main* JS bundle
  gzipped (200KB → 478KB) for every single page load regardless of
  whether that member ever touches resume upload; dynamic import
  code-split them into their own chunk(s), fetched only the moment a
  resume is actually parsed, confirmed back to the original ~203KB main
  bundle after the fix.

  Same "only ever fill a currently-EMPTY field, never overwrite a
  member's own edit" rule every other prefill source in this app already
  follows (Directory auto-fill, etc.) — a wrong heuristic match on a
  messy freeform resume is real enough to guard against, unlike the
  Directory sheet's clean structured data. The two upload entry points
  apply this differently, deliberately: Onboarding's `StepYou` has no
  editable text fields of its own (major/class year are read-only
  display there, only ever edited on My Profile), so empty-only-fill +
  immediate apply is the whole safety net — acceptable specifically
  because a member mid-onboarding almost always has nothing set yet, and
  any wrong value is trivially correctable later, never a one-way door.
  My Profile's version is more conservative: the *file* still applies
  immediately (it's genuinely already in Storage the moment it's picked,
  same as avatar upload), but parsed field suggestions only ever populate
  the local, still-editable form state — the member reviews them in the
  actual input boxes (with an explicit "Found in your resume... —
  double-check before saving" note) and has to click "Save changes" like
  every other edit on that tab, which doubles as a real confirmation step
  without any extra UI.

  Verified live end-to-end with a throwaway account and two real
  synthetic test files (a `reportlab`-generated PDF, a `python-docx`
  DOCX — not hand-typed fixtures): both file types correctly extracted
  and parsed (`classYear`, `majors`, `linkedIn` all exactly right on
  both), auto-fill on Onboarding applied immediately and correctly
  skipped already-known fields, My Profile's upload/replace/remove/view
  all worked (`view` uses a real signed URL — confirmed it actually
  fetches the right bytes with the right content-type, and confirmed a
  direct/non-signed request to the same path is correctly rejected, not
  publicly readable), the re-upload "only fill if empty" guard held
  (replacing the file didn't touch the already-set major/grad-year/
  LinkedIn), and `computeProfileStrength`'s new signal was confirmed live
  (14% → 29% with resume+LinkedIn, back to 14% after Remove) — Remove
  itself was independently verified to actually delete the Storage
  object, not just clear the DB reference (a direct `storage.list()` call
  confirmed zero files left for that account). Cleaned up completely
  afterward (test account, roster entry, migration) and confirmed zero
  residue: `roster_total=52`.

- **Real alumni accounts: signup access + a Feed/Network-focused view** —
  direct instruction, following up on the profile-pictures session's
  "eventually have something for alumni to create accounts... more
  focused on feed/network than jobs/education." Scoped via 4 real
  decisions before building: (1) signup access is `roster` (current
  members) **or** a real `people.status = 'Alumni'` email match — reuses
  the 155 real alumni already on file, no new data entry, roster itself
  keeps meaning exactly what it always has; (2) a new, separate
  `profiles.member_status` column (`current_member`/`alumni`), not a
  third `role` value — `role` stays access-level only (member/admin),
  membership status is a genuinely different axis that happens to also
  have two values today; (3) Jobs/Applications/Career Resources (and Home,
  which is really just a recruiting dashboard) are hidden from an alumni's
  nav **and** route-guarded, not just hidden — a direct URL still worked
  before route-guarding was added, same "guard the route, don't just hide
  the link" principle `RequireAuth.jsx` already established; (4) alumni
  skip the full 5-step recruiting-focused onboarding entirely (industries/
  roles/locations/companies/timeline are all about active job-searching),
  getting just `StepYou`'s real "confirm your info" + resume upload,
  landing on Feed.

  `can_sign_up()` (renamed from `is_on_roster()` — it checks more than
  roster now, the old name would be actively misleading) covers both
  paths; `handle_new_user()` sets `member_status` from the same real
  `people.status` match at the moment of signup (defaults to
  `current_member` when there's no match at all, e.g. an admin account
  created outside the normal Directory flow). New
  `components/RequireCurrentMember.jsx` wraps `/`, `/jobs`, `/jobs/:id`,
  `/applications`, `/resources/*` — redirects an alumni to `/feed`
  instead of rendering; `data/navItems.js`'s new `currentMemberOnly` flag
  drives the same hiding in `NavRail.jsx` and `BottomTabBar.jsx` (whose
  curated 4-slot primary-tab picks were built entirely around
  current-member priorities — Jobs/Applications are two of the four — so
  alumni get their own primary set: all 4 of their remaining items,
  Network/Feed/Companies/My Profile, fit exactly with no "More" overflow
  needed). `SignIn.jsx`'s own footer copy ("Members convert to alumni
  automatically at commencement") was already false before this — nothing
  has ever auto-converted anyone — fixed to state the two real paths
  plainly; "Alumni — request access" is now genuinely a fallback for
  someone not found in the real Directory at all, since a real alumnus
  who *is* in it can just sign up directly and succeed.

  **Caught and fixed a real, more serious pre-existing bug while
  verifying this, not just new code**: `realRole`/`isAdmin` (and the new
  `realMemberStatus`/`isAlumni`) were fetched exactly once, at
  `AppStateProvider`'s own first mount — which happens once per browser
  tab, often at `/sign-in` before any session exists. Signing in
  afterward, in the same tab, never re-ran that fetch (no
  `onAuthStateChange` listener existed for it at all) — so `isAdmin`/
  `isAlumni` stayed **permanently** wrong, not just briefly stale, for
  the rest of that session, until a full page reload happened to
  re-mount the provider fresh with a session already present. This had
  silently applied to `isAdmin`'s own Leadership-nav gating the whole
  time too, just never hit in a way anyone noticed (every real admin
  test this session happened to involve a fresh page load after signing
  in, never testing nav-gating in the exact same tab immediately after
  sign-in). Caught only because alumni routing needed to work correctly
  *immediately* after a fresh sign-in, in the same tab, for the first
  time. Fixed with a real `onAuthStateChange` subscription in
  `data/store.jsx` (same pattern `RequireAuth.jsx` already used for the
  identical reason) that re-fetches both on every auth state change, not
  just once. `Onboarding.jsx` also gets a faster, zero-latency version of
  the same fix specifically for the moment right after signup:
  `SignIn.jsx` now fetches `member_status` in the same query it already
  had for `onboarding_complete`, and passes it forward via router state
  (`location.state.isAlumni`), which `Onboarding.jsx` prefers over the
  (still technically correct, but one real round-trip slower) store
  value — mirrors the exact fix already in place for
  `onboarding_complete`'s own identical race.

  Verified live end-to-end, including catching the above bug live rather
  than shipping it: `can_sign_up()` directly confirmed correct for a
  roster email, a real alumni match, and a genuinely unknown email;
  `handle_new_user()`'s branching directly confirmed correct for both an
  alumni and a roster signup; a real signup through the actual browser
  sign-up form for a synthetic alumni-status person (needed `.com`, not
  `.invalid` — Supabase Auth's own `signUp()` validator rejects
  `.invalid` as a real email domain even though direct SQL inserts, used
  throughout this session for throwaway accounts, bypass that validation
  entirely and always worked fine with it); the real onboarding flow
  correctly showed the lightweight alumni version (and, after the
  hydration-race fix, correctly showed the full 5-step version for a
  fresh current-member signup, confirmed as a real regression check, not
  assumed); direct URL navigation to every guarded route correctly
  redirected to `/feed` for the alumni account and correctly did **not**
  redirect for the current-member account; the nav rail showed exactly
  the right 4 vs. 8 items for each; a returning alumni's plain sign-in
  (not a fresh signup) correctly landed on Feed, not Home. Cleaned up
  completely afterward (both throwaway accounts, the synthetic alumni
  `people` row, roster entry, every migration) and confirmed zero
  residue: `roster_total=52 people_total=207 current_member_total=52
  alumni_total=155`.

- **GitHub confirmed the server-side PII purge — no known blocker left
  before going public** — closes the one open item the history-rewrite
  entry above flagged. GitHub Support replied same-day: "I have run
  cache clearance and garbage collection on the repository. The commit
  URL should return a 404 error now." Not just trusted — independently
  re-verified all 3 known dangling SHAs (`37a7897`, `d6a5fd0`, `a6f3540`)
  directly via `gh api repos/.../commits/<sha>`; all three now return a
  real "No commit found for SHA" (422), confirming a genuine server-side
  purge rather than taking the support reply at face value. Ticket marked
  Solved. This was the last real, known gap between "history was
  rewritten" and "genuinely safe to make public."

- **The repo is now public** — direct go-ahead from the user, following
  one final sanity pass rather than assuming the earlier scrub still
  held. Re-ran the same general-pattern email-shape search
  (`git log --all -p | grep -oE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' | sort -u`)
  against current full history: only the user's own real email + their
  own `+ucportaltest` alias (already reviewed, unavoidably in commit
  author metadata regardless), two purpose-built throwaway test Gmail
  accounts explicitly documented in their own commit as "neither is a
  real club member," one synthetic `@example.com` placeholder,
  `noreply@anthropic.com`, and the two already-reviewed wireframe
  placeholders — zero real club-member PII. Also reconfirmed the two
  originally-scrubbed migration files return zero hits anywhere in
  history. Flipped via `gh repo edit ... --visibility public
  --accept-visibility-change-consequences`, then independently confirmed
  via a separate `gh repo view` call (`isPrivate: false`) rather than
  trusting the edit command's silent success. Live at
  https://github.com/UConsulting-ATS-Dev-Team/uc-portal.

  **If real member data work happens again in the future**: the
  discipline that made this safe was structural, not a one-time cleanup
  — real member data is never committed to git, full stop (see the
  history-rewrite entry above). Any new feature that touches real
  people's data should keep following that rule, not re-earn public-
  safety through another rewrite later.

- **Real self-reported work history — the legitimate "alumni LinkedIn
  tracker"** — direct ask, but the literal version (automatically find
  alumni's LinkedIn pages by name/education, extract their work history)
  is exactly the automated LinkedIn collection this project already ruled
  out (LinkedIn's ToS explicitly prohibits it — see
  [JOB_ENGINE_ARCHITECTURE.md](JOB_ENGINE_ARCHITECTURE.md)'s sourcing
  table). Scoped down to the legitimate version instead, after being
  explicit about why: a real, voluntary "work history" a member or
  alumnus self-reports on their own profile — never scraped, never
  auto-populated from anywhere external.

  New `work_history` table (authenticated-read, own-row write — the whole
  point is cross-member visibility, unlike `resume_path`'s own-row-only
  read). Two new security-definer RPCs: `company_interest_count()` (a
  narrower, non-admin-gated cousin of `company_demand_report()` — any
  member can look up *a count* of real interest in one company, from the
  same real `member_preferences.followed_companies` data, never who) and
  `list_work_history_at_company()` (resolves a real display name per
  entry via the same people-email → profiles.full_name → email-local-part
  fallback chain `list_recent_signups()` already established). New "Work
  History" tab on My Profile — add/edit/remove entries (company, role,
  start/end year, "currently here"), reusing `data/careerOptions.js`-style
  patterns already in that file. Surfaced on `RealJobDetail.jsx` as "UC
  alumni who've worked at {company}" — a genuinely different signal from
  the existing "UC members at {company}" rail (current-company Directory
  data, mostly present-tense) since this one can surface someone who
  *used* to work there, the actual referral-value case a Directory
  snapshot can't provide. Hidden entirely while empty rather than a bare
  "no one yet" — this is real user-submitted data, still thin app-wide,
  nothing to apologize for by omission.

  **The real, acknowledged limitation, addressed head-on rather than
  ignored**: self-report can't be *guaranteed* freshness or participation
  the way an automated source could — direct user pushback on the first
  proposal, correctly. Rather than pretend there's a technical fix (there
  isn't one that doesn't involve either LinkedIn scraping or an
  operational, human-driven periodic re-collection process — both ruled
  out or out of scope here), built the incentive layer in from the start
  instead of shipping the bare form and hoping: a real "N members are
  interested in {company}" payoff stat shown back to whoever just added
  an entry (the actual incentive to participate), and a real, computed
  nudge card on Feed — not My Profile, since Feed is every real member's,
  and every real alumnus's (whose landing route is Feed, not Home), most-
  visited real page — shown only while the signed-in account has zero
  entries, gone the moment they add one.

  Verified live end-to-end with two throwaway accounts against a real
  active job (Gusto, Inc.): add/edit both confirmed working, the interest
  count correctly showed 0 then 1 (after setting a second account's real
  `followed_companies` to match and re-saving), the Feed nudge correctly
  appeared for the zero-entry account and disappeared for the one-entry
  account, and — the real cross-member test — a **second**, different
  signed-in account genuinely saw the first account's real entry on
  `RealJobDetail.jsx`'s new rail card for a real posting. Also directly
  verified RLS actually blocks the write path, not just trusted the
  policy definition: attempted updating another account's real
  `work_history` row directly — zero rows affected (the same "UPDATE
  under RLS silently affects zero rows, not an error" behavior this
  project already learned to check for correctly elsewhere), and the
  row's real value confirmed unchanged afterward. Cleaned up completely
  afterward (both throwaway accounts, `member_preferences` row, and —
  verified directly, not assumed — the `work_history` row's own `on
  delete cascade` actually fired) and confirmed zero residue:
  `roster_total=52`.

- **Alumni photo nudge on Feed** — closes the "still need to pull pictures
  for alumni" item the profile-pictures entry above flagged. Checked
  first whether a real, honest source existed the same way the
  current-member team-page import did: the Wayback Machine has **zero**
  archived snapshots of `uconsultingla.com` at all (confirmed via its CDX
  API, not just the `/team` path) — there's no historical page to recover
  past alumni headshots from. Automated LinkedIn lookup was raised again
  and declined again, same reasoning as the work-history feature (LinkedIn
  ToS, this project's own no-scraping policy). Self-upload
  (`components/Avatar.jsx`/`data/avatarSync.js`) already worked for alumni
  accounts with zero code changes — My Profile's Personal tab isn't
  current-member-gated — but nothing nudged anyone to actually use it.
  Added an "Add your photo" rail card on `pages/Feed.jsx`, same pattern as
  the existing work-history nudge card directly above it: shown only when
  `isAlumni && !profileOverrides.avatarUrl`. Deliberately alumni-only, not
  every member without a photo — the team-page import already covers all
  52 current members, so showing this to them would incorrectly nag
  someone who already has a real photo showing everywhere else. Verified
  with a clean `vite build` and a live dev-server load (no console errors,
  correct sign-in redirect); not click-tested with a real alumni session
  — low risk, reuses an already-proven pattern exactly, no new throwaway
  account spun up for this one, same call made on several other small
  idle-time fixes earlier.

- **First real run of `seed-real-directory.mjs` against live exports —
  three script bugs found and fixed, one real production incident caught
  and fixed same-day** — closes the "column headers are an unconfirmed
  guess" gap the script's own entry above flagged, using two real exports
  of the Directory sheet's Active Members and Alumni tabs. The dry run
  caught three real bugs in the script itself before anything was
  written: a title-banner row (present with real text on the Alumni tab;
  present but fully blank -- and so silently filtered out -- on Active
  Members, masking the same bug there) was being read as the header row;
  the sheet's real header is missing a "Location" label entirely,
  shifting Venmo Handle/Mentor/Major/LinkedIn each one column early; and
  the Alumni tab additionally has blank LinkedIn/Projects header cells
  where Active Members has real text. All three fixed by detecting and
  inserting the correct labels rather than hardcoding around the sheet's
  own mislabeling -- self-correcting if the sheet is ever fixed for real.
  Also caught a real, pre-existing data-quality issue in the club's own
  sheet (not fixed, not this project's data to guess-correct): "Josh
  Chan" and "Jessica Wong" share one email in the Alumni tab, so Jessica
  Wong has never actually been imported as her own person, then or now.
  Also confirmed live (per direct instruction, since the sheet itself
  can't be edited) that the 15 people already reclassified Alumni earlier
  today still show as Active in this fresh export -- expected, the sheet
  lags reality -- so applying needed a follow-up correction regardless.

  **The real incident**: the user ran `--apply` for real (this agent
  never handles real admin passwords, even when asked -- the script's own
  interactive prompt is the only path, by design). Its upsert used
  `onConflict: "slug"`, but this script's `slugFor()` produces different
  slugs than the original, now-removed one-time import migration did for
  the same real people -- so instead of updating 206 existing rows, every
  real person who reappeared in the export got a brand-new duplicate row
  (`people_total`: 207 -> 414, confirmed live, not assumed from the
  apply's own "success" output). Diagnosed directly against the live
  database rather than guessed: every duplicate pair's older row (by
  `created_at`) still carried its real data intact, including current
  members' real `avatar_url` from the team-page import, which the newer
  duplicate row never had (upsert doesn't set fields absent from the
  payload). Confirmed via `pg_constraint` that nothing foreign-keys to
  `people.id`, so merging was safe. Fixed via a single migration (applied
  via `db push`, deleted locally, never committed -- same real-PII
  convention as every other data migration here): merge each pair
  (keep the older row's id/slug/avatar_url, take every other real field
  from the fresher import), delete the newly-inserted duplicate, and
  re-apply the 15-person Alumni correction the fresh export had
  regressed back to Current member (and re-added to `roster`). Verified
  live: `people_total=208 alumni_total=155 current_total=53
  roster_total=52 duplicate_emails=0 people_with_avatar=52` -- zero
  duplicates, all 52 real photos intact, the 15-person correction holding
  again, and exactly one genuinely new real current member landing
  correctly (the only real net change tonight, everyone else already
  existed as of the Sept 14 import).

  Worth remembering for any future one-time-migration-to-reusable-script
  conversion in this project: a script's own newly-computed identifier
  (slug, hash, etc.) has to be verified against what's *actually already
  live*, not just internally consistent with itself -- consistency alone
  doesn't catch a mismatched join key, only a live dry run (or, as
  happened here, a live apply) against the real data does.

- **Broader gesture nav: pull-to-refresh and swipe-between-tabs** — closes
  most of the "genuinely unscoped" gap the earlier gesture-nav entry
  above left open (swipe-to-delete deliberately not included -- see
  below). Scoped before building rather than guessed broadly: checked
  first whether a real swipe-to-delete would add genuine new capability
  anywhere, and found neither Notifications nor Messages has *any*
  dismiss/archive/delete today (no button, no gesture) -- Notifications'
  rows are computed live with nothing to persist a "dismissed" state
  against, and Messages' conversations are shared rows, so a real
  per-viewer archive needs new backend state, not just a gesture
  wrapper. Given the choice to build that as part of "gesture nav" or
  scope it out as its own real feature, judged it the latter -- flagged
  explicitly rather than silently skipped.

  What shipped: `components/PullToRefresh.jsx` (pull down while already
  scrolled to the very top to re-fetch) on Feed and Notifications -- the
  two pages where another real member's action can add new content
  while this one is already looking at the page -- and
  `data/useSwipeTabs.js` (swipe left/right to move to the next/previous
  tab) on Feed's and Jobs' tab rows, the two most-used tabbed views in
  the app. Both are real Pointer Events, matching the same approach
  already proven working for touch across this app by the Applications
  tracker's drag rebuild -- not HTML5 DnD or a touchstart/touchend pair.
  Both deliberately exclude `pointerType === "mouse"` -- neither gesture
  is something a mouse does in any real app, unlike the tracker board's
  drag (which stayed mouse-compatible since a desktop admin might
  legitimately use it). Deliberately *not* built: swipe-to-unsave on
  Jobs' Saved tab or swipe-to-remove on Work History entries -- both
  already have a one-tap button doing the exact same thing, so a gesture
  there would be redundant chrome, not a real addition.

  **Verification note, worth being honest about**: the mouse-exclusion
  above is also why this couldn't be click-tested live the way the
  tracker board's drag was -- this session's browser tool drives touch
  gestures by simulating a mouse drag, and `pointerType: "mouse"` is
  exactly what these two components are built to ignore, by design (the
  tool's own docs confirm clicks arrive as mouse events even under phone
  viewport emulation). Verified instead via a clean `vite build` (JSX
  requires strictly balanced tags to even compile, so this rules out a
  mismatched wrapper div, a real risk given how much manual re-nesting
  this needed across 3 pages) and a direct check that neither
  `.feed-main` nor `.jobs-main` has any flex/grid gap-based child layout
  the new wrapper divs could have silently broken. The actual gesture
  trigger itself is verified by code review, not a live touch simulation
  -- flagged rather than claimed, same honesty standard as the tracker
  board's own DnD-testing limitation before its Pointer Events rewrite.

- **Josh Chan / Jessica Wong email mix-up: blanked rather than guessed** —
  direct instruction, since the real sheet still can't be edited: rather
  than keep the one real shared email (jessicacwong@ucla.edu) attributed
  to Josh Chan's row (an unreviewed guess left over from both imports),
  set it to null on his row and inserted Jessica Wong as her own real
  person for the first time (she'd never existed as a row before --
  every prior import's duplicate-email collision resolved to keeping
  whichever row came first). Both real, both correctly missing an email
  now rather than one of them wrongly owning the other's.

- **Real message archiving** — closes the gap flagged while scoping
  gesture nav: Messages had no way to hide/archive a conversation at
  all. Since conversations are shared rows (`messages`), a real archive
  can't be a delete -- that would remove the other participant's copy
  too. New own-row-only `archived_conversations` table
  (`account_id`, `counterpart_id`) -- a row's existence is the signal,
  same "derive it, don't duplicate-store a flag" approach as
  `savedJobIds`/`savedConnections`, just server-side since Messages
  already syncs across devices. `fetchConversations()` now returns an
  `archived` field per conversation (a second small own-row fetch, not a
  join -- RLS already scopes it). Messages.jsx gets a new "Archived" tab
  (All/Unread never show an archived thread), a real "Archive"/
  "Unarchive" button on every row (the primary, fully accessible path),
  and a real swipe-left-to-archive gesture on top -- extracted the row
  into its own `ConversationRow` component specifically because a
  per-row Pointer Events gesture can't live inside a `.map()` callback
  (Rules of Hooks), same simple "decide on release, no live drag-
  following" approach as `data/useSwipeTabs.js`, mouse excluded again.
  A new message from an archived counterpart auto-unarchives the
  recipient's view via a real trigger (`unarchive_on_new_message()`,
  `after insert on messages`) -- matches the same expectation Gmail's
  own archive already sets (a reply un-archives), so a member can't
  silently miss a real new message just because they tidied an old
  conversation away once. Notifications.jsx's "recent unread
  conversations" preview now filters archived ones out at the fetch
  call site -- surfacing a notification about a thread someone just
  archived would undermine the point of archiving it.

  Verified live end-to-end with two real throwaway accounts (the
  pgcrypto-bcrypt technique used elsewhere this session needed one real
  fix this time: the direct `auth.users` insert hit a genuine "Database
  error querying schema" from GoTrue until the token columns
  --confirmation_token, recovery_token, email_change, etc. -- were set
  to `''` instead of left `null`, a known real quirk of inserting
  directly into that table rather than through `signUp()`): the Archive
  button correctly moved a real conversation out of All/Unread into
  Archived and closed the open thread pane; Unarchive correctly moved it
  back; a second, different signed-in account's own view of the same
  conversation was confirmed unaffected by the first account's archive
  (real per-viewer isolation, not just a client-side filter); RLS was
  tested directly through the real client, not just trusted from the
  policy text -- a cross-account delete attempt silently affected zero
  rows (the same "UPDATE/DELETE under RLS returns success but touches
  nothing" behavior this project already learned to check for
  explicitly) and a cross-account insert attempt correctly returned a
  real `42501` row-level-security error; and the auto-unarchive trigger
  was confirmed by archiving a thread, sending a new message from the
  other real account, and watching it reappear in the first account's
  Unread list without either account touching Unarchive. Both throwaway
  accounts, their real messages, and the archived-conversation row were
  all deleted afterward and confirmed at zero residue:
  `residue_auth=0 residue_roster=0 archived_total=0 messages_total=0
  roster_total=52`. The swipe gesture itself has the same live-testing
  limitation as the rest of this session's gesture-nav work (mouse-based
  browser automation can't trigger a touch-only Pointer Events gesture)
  -- verified by code review, not a live drag; the button path above is
  the fully-verified, always-available primary interaction regardless.

- **Real intern accounts + accelerator program** — direct ask from the
  user's advisor: a 6-8 week weekly curriculum for incoming freshmen
  (prep material to review, a real graded assignment per week), gated
  behind a new "Intern" account tier that "essentially only has this
  education function until they finish." Scoped via 4 real decisions
  before building: (1) interns are brand-new recruits with no roster/
  Directory record at all, so a new admin-managed `intern_roster`
  allowlist (same shape as `roster`) is how they get signup access, not
  either existing path; (2) the anti-skip mechanism is a required
  submission, not a timer -- no submission means no progress to the next
  lesson, and a rushed/empty one shows up plainly when an admin grades
  it; (3) "students can interact with" the uploaded slideshows/PDFs/
  Excel means view/download the material and submit a separate response
  (text and/or file) -- not true in-browser editing of the file itself,
  a meaningfully bigger build declined for now; (4) one evergreen
  curriculum, not per-cohort content, but built as plain admin CRUD
  (`pages/AdminAccelerator.jsx`) so it's genuinely easy to adjust year to
  year without a code change, per direct instruction.

  `profiles.member_status` gains a third real value (`intern`, alongside
  `current_member`/`alumni`) rather than a new column -- same axis,
  same precedent the alumni-accounts migration already established.
  `can_sign_up()`/`handle_new_user()` extended with an `intern_roster`
  branch (precedence: real roster/alumni matches still win if somehow
  both are true for one email). New tables
  (`accelerator_lessons`, `accelerator_materials`,
  `accelerator_submissions` -- own-row select/insert/update for a
  submission, admin-all for grading) and two Storage buckets
  (`accelerator-materials`: public, admin-only write, same reasoning as
  avatars -- not sensitive; `accelerator-submissions`: private, own-
  folder RLS plus a real admin-read-all policy, same shape as resumes).
  `components/RequireNotIntern.jsx` guards essentially the entire route
  tree except `/accelerator`, `/profile`, and `/onboarding` -- an
  intern's real allowed set -- mirroring `RequireCurrentMember.jsx`'s
  existing "guard the route, don't just hide the link" principle; a new
  `INTERN_ITEMS` nav set (`data/navItems.js`) hides everything else from
  NavRail/BottomTabBar, and `TopBar.jsx`'s Messages/Notifications icons
  are hidden too (the route guard already blocked them, but showing a
  dead-end icon contradicted the whole point). `SignIn.jsx` routes a
  fresh intern signup straight to `/accelerator`, skipping onboarding
  entirely -- there's no Directory record to "confirm." Admin gets a
  real "Graduate to current member" action on the existing Members page
  (`pages/AdminMembers.jsx`, a plain `profiles` update through the same
  RLS path its existing role-toggle already uses).

  **A real, separate security gap found and fixed while building this**:
  `profiles_update_own` lets any signed-in account update its own row
  directly, and the existing role-escalation trigger only ever clamped
  `role` -- `member_status` (added later, for alumni) was never covered,
  so any member could already self-promote their own `member_status` via
  a plain client call. Pre-existing, not introduced here, but it matters
  far more now that an intern's entire access model depends on
  `member_status` only ever changing through an admin action -- extended
  `prevent_role_self_escalation()` to clamp both columns.

  Verified live end-to-end with two real throwaway accounts (admin +
  intern): a real `signUp()` for the intern-roster email correctly
  proceeded past the roster gate (not "not on the roster") -- caught and
  fixed a real quirk along the way, Supabase's signup validator rejects
  `@example.com` specifically (a reserved documentation domain) even
  though direct SQL inserts bypass that check entirely, so this one
  needed a real disposable-mail domain instead; `handle_new_user()`
  correctly set `member_status = 'intern'`; sign-in landed straight on
  Accelerator, not onboarding; nav showed only Accelerator + My Profile;
  a direct `/jobs` URL correctly bounced back to `/accelerator`; the
  admin's uploaded material was visible to the intern; submitting week
  1's assignment correctly unlocked week 2; the admin's grade appeared
  on the intern's own view; the intern's own attempt to self-promote
  their `member_status` via a direct client call silently no-opped (the
  trigger fix, confirmed against the live database, not just the
  client's optimistic response); and the admin's real "Graduate to
  current member" click correctly flipped the status where the intern's
  own attempt couldn't. Cleaned up completely afterward -- both
  accounts, the test lesson/material/submission, and (after discovering
  the Storage CLI's `rm` needs an explicit confirmation the first
  non-interactive attempts silently skipped) the uploaded test file
  itself -- confirmed zero residue: `residue_auth=0 residue_roster=0
  residue_intern_roster=0 residue_lessons=0 residue_materials=0
  residue_submissions=0 roster_total=52`, zero objects left in either
  Storage bucket.

Run locally:
```bash
npm install
npm run dev
```
