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
  `document.documentElement.scrollWidth` overflow, no console errors);
  Messages' fixed two-pane layout is the one deliberate exception, since
  stacking it needed a capped-height scrollable list rather than a real
  show-list/show-thread toggle (no state for that exists). Nothing here
  is phone-first — touch targets, gesture nav, and true mobile UX are
  still unscoped — but the app now reflows correctly at laptop/tablet
  widths and doesn't break down to phone width either.

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
   640px instead of scaling via the old `zoom` stopgap. What's still
   genuinely unscoped is phone-first UX proper — touch targets, gesture
   nav, a real show-list/show-thread toggle for Messages instead of its
   capped-height stacked fallback — none of that was in scope for this
   pass, which targeted "doesn't break down to phone width," not "designed
   for phone first."
2. **People avatars** — still text-initials placeholders, intentionally,
   for both `mockPeople.js`'s fictional entries and the real UConsulting
   Directory import (Progress below) — the latter are real people, so
   sourcing photos for them without consent would be worse than not
   having one, not just a mock-data convenience. Only companies got real
   logos (see Progress below).

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

Run locally:
```bash
npm install
npm run dev
```
