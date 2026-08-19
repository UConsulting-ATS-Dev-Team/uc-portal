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
- **Responsive**: desktop/laptop only (1280px+ designed; collapses rail to
  icons below ~1100px). Below ~900px is explicitly undefined in the
  wireframes — treat this prototype as desktop-only.

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
  since UC's style guide doesn't define a full neutral scale: ground
  `#f2f2f3`, surface `#ffffff`, borders `#d4d4d7`, inner rules `#e7e7ea`,
  table headers `#f5f5f8`.
- **Type (UC brand)**: Montserrat Bold for headings, Montserrat Light for
  body (loaded via Google Fonts). Size scale borrowed from the wireframes
  since the style guide doesn't specify sizes: body 13px, secondary 12px,
  meta 11px, section kickers 9.5px uppercase (0.12em tracking), page
  titles 22–30px, display numerals 20–46px.
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

1. **Bear-icon logo mark** — the style guide's line-art bear mark isn't
   pulled into `assets/` yet (only the CSS wordmark is built). Say the
   word if you want `UC Logo.png` downloaded for the nav brandmark's
   square icon.
2. **Mobile** — lower priority for now per your steer, but planned for
   eventually. Prototype targets desktop (1280px+, matching the
   wireframes) first; a responsive pass is future work, not unscoped.
3. **Assets** — wireframes use text-placeholder company logos and
   initials avatars, no real images. Keeping that placeholder approach for
   companies/people; only UC's own brandmark uses the real assets above.

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

**All 24 wireframe screens are now built.** Remaining work is P3/stretch
only — mobile/responsive pass, the bear-icon logo asset, real company
logos — see PROJECT_PLAN.md's Feature priorities for the full breakdown.

Run locally:
```bash
npm install
npm run dev
```
