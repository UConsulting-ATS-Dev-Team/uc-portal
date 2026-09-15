# UC Portal

A private, members-only career and professional-development platform for
[UConsulting](https://www.uconsultingla.com/) (UC), a UCLA business/consulting
club — jobs, an applications tracker, an alumni directory, a club feed,
messaging, and career resources, all annotated with the club's own private
data (who worked where, what past applicants actually experienced, how UC
members have historically performed at each firm).

Started as a clickable prototype (mock data only); the real product now runs
on a real backend. See [CLAUDE.md](CLAUDE.md) for the full page inventory,
design conventions, decisions, and a dated build log of every real feature;
[PROJECT_PLAN.md](PROJECT_PLAN.md) for the original problem statement, MVP
scope, and timeline; and [JOB_ENGINE_ARCHITECTURE.md](JOB_ENGINE_ARCHITECTURE.md)
for the real job-ingestion/matching pipeline's design.

## What's real

- **Auth & access** — real Supabase Auth, gated to the club's actual roster
  (current members) and Directory-confirmed alumni; alumni get their own
  Feed/Network-focused experience rather than the full recruiting flow.
- **Jobs** — real daily ingestion from Greenhouse, Lever, and a Deloitte RSS
  feed, deduplicated and ranked, plus member/admin submissions through a real
  review queue. Each job carries the odds model (the signature feature): a
  real probability estimate built from UC's own track record, prep logged,
  networking depth, profile fit, and application timing — every number
  traceable to something else visible in the app.
- **Applications tracker** — Board/Table/Timeline views against real tracked
  applications, with real touch-drag (Pointer Events, not HTML5 DnD) and a
  "Move to" control for phones.
- **Network, Feed, Messages** — a real member/alumni directory (207 real
  people), a real club feed, and real 1:1 messaging between signed-in
  accounts.
- **Profile** — real profile photos (self-upload, plus real headshots
  imported from the club's own team page) and real resume upload with
  heuristic parsing (no LLM) to pre-fill profile fields.
- **Career Resources & Admin** — a real resource/certification library,
  case-partner matching, and an admin dashboard (company-tier management,
  broken-link review, access requests, feature requests).

## Stack

React (Vite + React Router) frontend, no separate app server — talks
directly to [Supabase](https://supabase.com/) (Postgres + Auth + Storage +
Edge Functions) for everything real. `server/` holds the job-matching
pipeline's core algorithms (normalization, dedup, ranking) as plain,
database-agnostic TypeScript with its own test suite — the real Deno Edge
Functions in `supabase/functions/` mirror this logic against the live
database.

## Running it

```bash
npm install
cp .env.example .env   # fill in a Supabase project's URL + anon key
npm run dev
```

Real features (auth, jobs, tracker, etc.) need a real Supabase project
behind those env vars — see `supabase/migrations/` for the full schema.

```bash
npm run test:server       # job-matching pipeline tests
npm run typecheck:server
```

## Folder structure

```
uc-portal/
  index.html          Vite entry HTML
  main.jsx             React root + router setup
  App.jsx               route table
  pages/               one component per screen/route
  components/          shared UI (nav shell, cards, chips, modals, ...)
  styles/              tokens.css (design tokens) + global.css (base styles)
  data/                fetch/sync/parsing logic + reference data
  assets/              icons, brand assets
  supabase/
    migrations/          the full real Postgres schema, RLS policies, and
                          data migrations, in applied order
    functions/            real Deno Edge Functions (job ingestion, link
                          health checks, etc.)
  server/              job-matching pipeline core algorithms (see server/README.md)
  scripts/             one-off/reusable admin scripts (e.g. real directory re-seeding)
  design/              wireframe handoff + brand guide — reference only, not app source
    handoff/              exported wireframes + README spec
    branding/              UConsulting's 2020 style guide
```

## Status

All 24 original wireframe screens are built, and nearly everything
member-facing runs on real data — see CLAUDE.md's dated Progress log for
the full, evidence-based history of what shipped and how each piece was
verified.
