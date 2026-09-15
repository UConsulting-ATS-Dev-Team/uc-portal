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
| **2026-09-08 (Tue)** | **MVP due** — delivered on schedule, presented to Ryan, Gavin, Harshil; went well |
| 2026-09-08 → 09-25 | Iterate on feedback (Sep 15, Sep 22 check-ins) — in progress as of 2026-09-14 |
| **2026-09-25 (Fri)** | **Production-ready** — final demo/presentation to UC Executive Committee for club distribution |

**Where we are (as of 2026-09-14, supersedes the paragraph this replaced,
which was frozen at 2026-08-18 — pre-MVP and mock-data-only):** MVP
delivered on schedule (2026-09-08), presented to the club's Tech & AI
supervisors, and it went well. All 24 wireframe screens have been built
since the original 2026-08-18 status (every P1/P2/P3 item below is now
checked) — but far more significantly, this has since gone well past
"clickable prototype against mock data," which is what this doc's P1-P3
split and its old "real backend is next-phase, out of scope" framing
(see the P3 checklist below) both still assumed at the time they were
written. Nearly everything member-facing now runs on a real backend
(Supabase Postgres + Auth + Edge Functions), not mock data: real
roster-gated sign-up, a real ~200-person member/alumni directory (the
club's own Directory sheet, imported), real job postings ingested daily
from Greenhouse/Lever/Deloitte plus member/admin submissions through a
real review queue, a real Feed, real 1:1 Messages, the full real odds
model, and a real admin toolkit (opportunity queue, company-tier
management, access requests, feature requests, member engagement,
broken-link detection). Remaining demo/seed content that hasn't been
replaced with something real yet (a handful of seeded tracker cards, a
few hand-authored mock company pages, Admin Dashboard's illustrative
club-wide KPIs no single browser session could actually compute) is
now visibly labeled ("Demo data"/"Illustrative"), not presented as fact.
This doc no longer tries to re-narrate that build history play-by-play —
see [CLAUDE.md](CLAUDE.md)'s Progress log for the full, evidence-based,
dated entry-by-entry account. Genuinely still open toward the
2026-09-25 production-ready bar: real transactional email only (blocked
on AWS SES access — see Risks & blockers). Everything phone-specific
(44px touch targets, a real Messages show-list/show-thread toggle, a
bottom tab bar, collapsible filters — all shipped 2026-09-08 alongside
the responsive redesign but missed by this doc's own earlier draft,
corrected 2026-09-14) is done, and so is gesture nav for the piece that
turned out to matter: the Applications Board's stage-change interaction
didn't work via touch at all (native HTML5 Drag and Drop has no touch
equivalent, and neither Table nor Timeline offered any other way to
change stage), rebuilt on Pointer Events plus a real "Move to" control
on both Board and Table, and real edge-swipe-back on Messages' thread
pane — see CLAUDE.md's "Gesture nav, scoped and built" entry. Broader
gesture patterns (swipe-between-tabs, pull-to-refresh, swipe-to-delete)
remain genuinely unscoped, not part of this pass.

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
- [x] Responsive pass — real breakpoint reflow (1100/900/640px, see
      CLAUDE.md's Design conventions) across every page and the 6 action
      modals, replacing the earlier `zoom`-based scale-to-fit stopgap.
      Phones below ~640px specifically are still lower-priority per the
      initiative's own steer — this makes the app usable down to laptop/
      tablet widths without breaking, not a phone-first redesign.
- [x] Phone UX pass — 44px touch targets app-wide, a real Messages
      show-list/show-thread toggle, a bottom tab bar below 1100px,
      collapsible filter sidebars (Jobs/Companies/Career Resources), and
      a widespread CSS Grid overflow fix. Shipped 2026-09-08 alongside
      the responsive pass above but never logged in either planning doc
      until a 2026-09-14 re-audit found and fixed the gap (see CLAUDE.md's
      Progress log) — re-verified live at 375px the same day, still fully
      working.
- [x] Gesture nav (the piece that mattered) — real Pointer Events
      touch-drag on the Applications Board, replacing native HTML5 Drag
      and Drop (which had no touch equivalent at all, and left no way to
      change a tracked application's stage on a phone from any tracker
      view), plus a real "Move to" control on both Board and Table and
      real edge-swipe-back on the Messages thread pane. Broader gesture
      patterns (swipe-between-tabs, pull-to-refresh, swipe-to-delete)
      remain genuinely unscoped, not part of this ask.
- [x] Bear-icon logo asset wired into the brandmark
- [x] Real company logos — all 8 companies in the mock data now show
      their real logo (sourced from Wikimedia Commons), wired into
      every logo-badge spot across Jobs/Companies/Applications/Job
      detail. People avatars stay text-initials on purpose (fictional
      people, no real photo to use).
- [x] Persistence — real Supabase Postgres backend for nearly every
      feature, not mock/localStorage-only (see CLAUDE.md's Progress log
      for the feature-by-feature build history)
- [x] Real auth — real Supabase Auth, roster-gated against the club's
      real Directory, with a database-level backstop trigger
- [x] Job scraping — real daily ingestion from Greenhouse, Lever, and a
      Deloitte RSS feed, plus member/admin submissions through a real
      review queue
- [ ] Email integration — blocked on AWS SES access (see Risks &
      blockers); in-app notifications exist as a partial substitute
- [ ] Slack "Opportunities" channel sync — not started

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
  trust fast. Largely addressed by real infrastructure now (daily
  ingestion, a daily link-health checker with an admin broken-link
  queue, a quality-score flag, and an expiration state machine for
  postings a source stops reporting) — what's still a genuinely open
  question is moderation *ownership* (whose job it is to actually work
  the admin queues day to day), a people/process decision, not a code one.
- **Access control** — resolved: real roster-gating is live (a real
  `roster` email allowlist checked before signup, backstopped by a
  database-level trigger so the check can't be bypassed by calling
  Supabase Auth directly — see CLAUDE.md's "Real roster-gating" entry).
  Real member data (the ~200-person directory, real accounts, real
  applications/messages/feed posts) already sits behind this, not still
  waiting on it.
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

All Josh/club tasks, not something this repo can do — current as of
2026-09-14, gathered from the supervisor's post-MVP feedback:

- **Gavin** — AWS SES access (10k emails/day). Blocks every real-email
  item above and below (feature-request notification emails, admin
  new-signup emails, general email notifications).
- **Nikki** (Alumni Relations) — insight, likely the real source for
  updated alumni database info/interview testimonials/advice content
  (supersedes this section's older single-line version of the same ask).
- **Emma** (Corporate Relations).
- **Logan** (Education Committee) — onboarding/IT training content.
- Buy a domain for the real Vercel deploy.
- A GM walkthrough, eventually — no rush.

Two infrastructure decisions also need Josh's own explicit call before
any code work starts on them (not just outreach): moving to a new repo
under the UC GitHub account (status tangled up with the still-pending
GitHub ownership transfer to Josh's advisor), and what AWS SES unlocks
once Gavin's involved.

## References

- Initiative plan: "Tech & AI Personal Initiative Plan - Josh Lowenberg"
  (UConsulting Google Drive)
- Wireframes + design spec: [design/handoff/](design/handoff)
- Brand guide: [design/branding/](design/branding)
- Technical/design reference: [CLAUDE.md](CLAUDE.md)
