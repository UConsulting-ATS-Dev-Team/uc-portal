# UC Portal — Project Plan

Master planning doc for UC Portal: problem statement, MVP scope, timeline,
feature priorities, and user stories. Source: Josh Lowenberg's "Tech & AI
Personal Initiative Plan" (UConsulting Google Drive), synthesized with the
wireframe handoff in [design/handoff/](design/handoff). For page-by-page
design detail and build conventions, see [CLAUDE.md](CLAUDE.md); this doc
is the product/project layer above that.

## Problem statement

In UC, job recruitment is mostly individual, apart from the Sophomore
Workshop. Members comb through Handshake and Indeed on their own, with no
system that surfaces UC's actual advantage: an alumni network that grows
every year and already knows which firms hire UC members, what their
interviews were like, and who's willing to help. That knowledge currently
lives in scattered spreadsheets, group chats, and Drive folders — if it
exists anywhere at all — so most members never benefit from it.

**Goal:** give every UC member, freshman through senior, a UC-specific
recruiting tool that turns the alumni network into a competitive
advantage instead of an underused asset — while giving Exec better
visibility into member interest and recruiting outcomes club-wide.

## What this tool is

A UC-specific job/internship recruitment platform that:
- **Saves time** — tailors job discovery per member instead of everyone
  independently combing through Handshake/Indeed.
- **Surfaces UC's private advantage** — every job, company, and resource
  is annotated with UC's own data (alumni presence, past-cycle outcomes,
  interview write-ups) that no public job board has.
- **Connects members who wouldn't otherwise interact** — matches by
  shared interests, industries, and target companies.
- **Keeps upperclassmen engaged** — alumni and older members stay
  connected to UC through referrals, coffee chats, and contributed
  write-ups instead of drifting away after their own recruiting cycle.
- **Gives Exec visibility** — aggregate (never individual) interest data
  so leadership can see where to recruit alumni speakers, not just react
  to Slack messages.

Full page-by-page detail (all 24 screens) is in CLAUDE.md; this doc
focuses on scope, sequencing, and why.

## Audiences

- **Members** (class years ~2026–2029) — discover opportunities, track
  applications, meet alumni, work through learning tracks/certifications.
- **Leadership** (Exec + Careers Committee) — see aggregate member
  interest, approve postings, manage content and access. Never see an
  individual member's application list — that privacy boundary is
  explicit in the design.

## Timeline

Per the initiative plan, checkpoints are weekly office hours (Tuesdays,
7:30–8:00pm): progress/demos (15 min) → questions/blockers (5 min) →
goals for next week. Two hard deadlines:

| Date | Milestone |
|---|---|
| 2026-08-18 (Tue) | Onboarding & brainstorm — idea scoped, wireframes designed |
| 2026-08-18 → 09-08 | Weekly office-hours check-ins (Aug 25, Sep 1, Sep 8) |
| **2026-09-08 (Tue)** | **MVP due** — proof of concept to Ryan, Gavin, Harshil (mockups/visual design/task tracker acceptable, not a final product) |
| 2026-09-08 → 09-25 | Iterate on feedback (Sep 15, Sep 22 check-ins) |
| **2026-09-25 (Fri)** | **Production-ready** — final demo/presentation to UC Executive Committee for club distribution |

**Where we are (as of 2026-08-18):** stack + scaffold set up, real UC
brand applied, navigation shell built and clickable across all 24
screens' routes (most still placeholders), sign-in/access-gate flow
built (`3a`, all four states), onboarding built (`2i`/`2j`, all 5 steps +
completion, preferences persist via a shared store so later pages can
read them), Jobs board built (`1d`, filters/tabs/sort/save all working
against mock data), Job detail built (`1e`, incl. the full odds model
with live recompute and sparse-data handling — pulled forward from P2),
Applications tracker built (`1f`/`1g`, Board with real drag-and-drop +
Table with sorting/CSV export; Timeline `1j` still pending — most
complex of the three), Network + member/alumni profile built (`1h`/`1i`,
filters, coffee-chat requests, and shared-context all working against
mock data), Feed built (`2a`, composer/tabs/helpful reactions/embedded
job cards/events all working), Companies + company page built (`2b`/`2c`,
filters/watchlist/5 tabs all working, every stat computed from real
job/people data), Career Resources built (`2d`/`2e`/`3d` — library,
resource detail, learning track detail; sequential step-unlock,
section-completion tracking, and tracker-driven recommendations all
verified working), My Profile built (`2g`, all 4 tabs: Personal,
Career preferences, Recruiting settings, Privacy — Career preferences
edits the same `preferences` object onboarding writes to, so nothing's
duplicated), Admin Dashboard built (`2h`, KPI strip, gap analysis
computed from real industry-interest data, class-year breakdown, and a
working opportunity review queue with Approve/Remove), and the
Timeline tracker view built (`1j`, Gantt-style — grouped rows, real
per-stage bars, projected/dashed segments, event diamonds, and a
working mouse-drag reschedule interaction). Home/Dashboard (`1a`),
Notifications (`2f`), Global search (`3b`), Messages (`3f`), all five
empty/first-run states (`3e`), and all 5 action modals (`3c`) are also
now built. **All P1 and P2 scope from the Feature priorities list below
is complete** — every wireframe screen is built and clickable against
mock data. Remaining work is P3/stretch only: mobile responsive pass,
bear-icon logo asset, real company logos — none required for the
Sept 8 MVP or Sept 25 production-ready bar.

## MVP plan

The initiative plan defines the MVP narrowly — narrower than the full
24-screen wireframe. MVP scope:

1. **User profile** — personal info + job/internship interests
   (wireframe `2g` My Profile, populated via `2i`/`2j` onboarding)
2. **Job discovery** — filters, triage/bookmark, fit signal
   (wireframe `1d` Jobs, `1e` Job detail)
3. **Application stage tracking** — indicate what stage each job is at
   (wireframe `1f` Applications board, at minimum)
4. **Admin tab** — leadership access to member information
   (wireframe `2h` Admin Dashboard, at minimum a members view)

Everything else in the 24-screen handoff (Network, Feed, Companies,
Career Resources, Messages, full odds model, Table/Timeline tracker
views, notifications) is real product vision but sits in **P2/P3**,
targeted for the production-ready milestone or beyond — see priorities
below. This keeps the Sept 8 deadline honest: a focused proof of concept,
not a race to build all 24 screens.

## Feature priorities

P1 = required for MVP (Sept 8). P2 = required for production-ready (Sept
25) — the initiative plan's stated bar is "at least P2s done." P3 =
stretch / beyond this initiative's timeline.

**P1 — MVP**
- [x] Navigation shell (top bar, left rail, routing)
- [x] Sign-in / access gate (`3a`) — all four states (sign-in, not-on-roster,
      pending, loading skeleton) built and clickable
- [x] My Profile (`2g`) — personal info + career preferences
- [x] Onboarding (`2i`/`2j`) — all 5 steps + completion built, with the
      live-match-count payoff working
- [x] Jobs board (`1d`) — filters, match score, save/bookmark all working
- [x] Job detail (`1e`) — match checklist, role info, and the full odds
      model (pulled forward from P2 since it's the signature feature and
      was cheap to build alongside the rest of the page)
- [x] Applications tracker — Board view (`1f`) with real drag-and-drop
- [x] Admin — a members view with access to member info (subset of `2h`)
      — superseded by the full Admin Dashboard build

**P2 — Production-ready**
- [x] Full odds model with sparse-data handling (`1e`, see CLAUDE.md) —
      done as part of Job detail
- [x] Applications tracker — Table view (`1g`), sortable + CSV export
- [x] Applications tracker — Timeline view (`1j`), Gantt-style —
      grouped rows, real per-stage bars, projected dashed segments,
      event diamonds, and a genuine mouse-drag reschedule interaction
- [x] Full Admin Dashboard — KPIs, gap analysis, opportunity queue (`2h`)
- [x] Network / alumni directory + profile (`1h`, `1i`)
- [x] Feed with alumni engagement (`2a`) — explicitly called out in the
      initiative notes
- [x] Companies directory + company page (`2b`, `2c`)
- [x] Career Resources / education hub (`2d`, `2e`, `3d`) — explicitly
      called out in the initiative notes ("go here for any help
      career-wise")
- [x] Notifications (`2f`)
- [x] Global search (`3b`)
- [x] Empty/first-run states (`3e`) — Home first-login, Applications
      empty, Jobs diagnostic no-results, Network no-connections, and a
      demo-triggered Error state all built (`/jobs?simulateError=1`)
- [x] Action modals (`3c`) — all 5 built and wired into their real
      trigger points: Request a coffee chat (Network, Member profile),
      Add an application (Applications), Post an opportunity (Jobs,
      Admin Dashboard), Contribute to the library (Career Resources),
      Log prep time (Job detail, replacing the old fixed +2hr direct call)

**P3 — Stretch / beyond this initiative**
- [x] Messages (`3f`)
- [ ] Mobile/responsive pass (explicitly deprioritized for now)
- [x] Bear-icon logo asset wired into the brandmark
- [ ] Real company logos / avatar uploads — on hold: would mean
      downloading trademarked third-party logos rather than the club's
      own Drive assets, so needs an explicit go-ahead first
- [ ] Anything requiring a real backend: persistence, real auth, job
      scraping, email integration, Slack "Opportunities" channel sync —
      out of scope for a clickable prototype; would be the next phase
      after production-ready if the club adopts this

## User stories

Written from the member/alumni/leadership perspectives, per the
initiative plan's ask. P1 stories map to MVP scope above.

**Member (current student)**
- As a member, I want to fill out my industries, roles, and locations
  once, so that the jobs I see are already filtered to what I care about. *(P1 — onboarding/profile)*
- As a member, I want to see how many UC connections and past applicants
  a job has, so that I know where my alumni advantage actually is. *(P1 — jobs board)*
- As a member, I want to save/bookmark a job and track what stage I'm at,
  so that I stop losing track of applications across spreadsheets and email. *(P1 — jobs + tracker)*
- As a member, I want a realistic sense of my odds at a specific company,
  so that I know whether to keep investing prep time there or refocus. *(P2 — odds model)*
- As a member, I want to find and message alumni at companies I'm
  targeting, so that I can ask for advice or a referral directly. *(P2 — network)*
- As a member, I want a place to see interview write-ups and prep
  resources specific to UC's own recruiting history, so that I'm not
  relying on generic internet advice. *(P2 — career resources / feed)*

**Alumnus**
- As an alumnus, I want to post a referral-eligible opportunity, so that
  current members get a real inside track instead of a cold application. *(P2 — post opportunity, feed)*
- As an alumnus, I want to indicate what I'm happy to help with (case
  practice, resume review, referrals), so that members reach out for the
  right thing instead of guessing. *(P2 — profile / network)*
- As an alumnus, I want to write up my interview experience once and have
  it reachable by every future applicant to that company, so that my
  knowledge doesn't just live in one group chat. *(P2 — feed / job detail)*

**Leadership (Exec / Careers Committee)**
- As a Careers Committee member, I want to see aggregate interest by
  industry and where UC lacks alumni coverage, so that I know where to
  focus alumni-speaker outreach — without seeing any individual's
  application list. *(P1 for a basic member view; P2 for the full gap-analysis dashboard)*
- As a Careers Committee member, I want submitted opportunities to land
  in a review queue before they're visible club-wide, so that postings
  stay trustworthy. *(P2 — admin opportunity queue)*
- As an Exec member, I want to see which members haven't engaged with the
  platform at all, so that I can nudge them before they disengage from UC
  entirely. *(P2 — admin member engagement)*

## Build checklist (sequencing)

Matches the dependency order from CLAUDE.md — each screen after the first
few depends on the shell and data model being in place.

- [x] Stack + scaffold (Vite + React Router, real UC brand tokens)
- [x] Navigation shell
- [x] Auth / access gate
- [x] Onboarding
- [x] Jobs board
- [x] Job detail (incl. odds model)
- [x] Applications tracker (Board + Table + Timeline)
- [x] Network + member/alumni profile
- [x] Feed
- [x] Companies + company page
- [x] Career Resources
- [x] My Profile (full tabs)
- [x] Admin Dashboard
- [x] Home / Dashboard (`1a`) — this was missed earlier in the sequence
      (jumped straight from shell to auth); caught and built now, incl.
      the first-login empty state (`3e`)
- [x] Cross-cutting: search, notifications, modals, messages, empty states

## Risks & blockers

From the initiative plan, plus what's come up building this so far:

- **Adoption risk** — this has to be simpler to use than just staying on
  Handshake/Indeed, or members won't switch. UI-before-functionality and
  keeping the MVP narrow are both hedges against over-building before
  validating that.
- **Upkeep** — job postings need to stay current; stale listings erode
  trust fast. Out of scope for the prototype itself, but worth deciding
  moderation ownership before production-ready.
- **Access control** — needs a real mechanism to keep this UC-only
  (roster-provisioned per the wireframes) before any real member data
  goes anywhere near it. The prototype uses no real data, so this is a
  pre-launch requirement, not a prototype requirement.
- **Odds model credibility** — a confident-looking percentage built on
  n=1 would undermine trust in the whole feature. Already decided (see
  CLAUDE.md): low-confidence labeling below ~5 applications.
- **Scope creep** — the wireframe handoff describes significantly more
  than the initiative plan's MVP text. Tracked explicitly via the P1/P2/P3
  split above so "the full 24 screens" doesn't quietly become the Sept 8
  bar.

## Sustainability (post-initiative)

Per the initiative plan: keep the codebase on GitHub with normal
maintenance, keep the Tech & AI team informed of what's built, and design
data flows (e.g. alumni database integration) so non-admins can maintain
postings without needing a developer. Underclassmen using the tool during
this build should already understand it well enough to take over
maintenance after Josh graduates.

## Open action items (not code)

- Reach out to Alumni Relations for updated alumni database info,
  interview testimonials, and alumni advice content (per initiative plan
  — this is a Josh/club task, not something this repo can do).

## References

- Initiative plan: "Tech & AI Personal Initiative Plan - Josh Lowenberg"
  (UConsulting Google Drive)
- Wireframes + design spec: [design/handoff/](design/handoff)
- Brand guide: [design/branding/](design/branding)
- Technical/design reference: [CLAUDE.md](CLAUDE.md)
