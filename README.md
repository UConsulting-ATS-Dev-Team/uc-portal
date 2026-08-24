# UC Portal

Clickable prototype of **UC Portal**, a private career/professional-development platform for UConsulting. See
[CLAUDE.md](CLAUDE.md) for the full page inventory, design conventions,
and open decisions, sourced from the wireframe handoff in
[design/handoff/](design/handoff), and [PROJECT_PLAN.md](PROJECT_PLAN.md)
for the problem statement, MVP scope, timeline, and user stories.

## Stack

React (Vite + React Router), no backend — mock data only. Chosen for a
24-screen prototype with heavy shared components (nav shell, job/person/
resource cards, modals) and state that needs to stay in sync across pages
(applications tracker, odds model, saved jobs). See CLAUDE.md's "Stack"
section for the full rationale.

## Running it

```bash
npm install
npm run dev
```

## Folder structure

```
uc-portal/
  index.html        Vite entry HTML
  main.jsx           React root + router setup
  App.jsx             route table
  pages/             one component per screen/route
  components/        shared UI (nav shell, cards, chips, modals, ...)
  styles/            tokens.css (design tokens) + global.css (base styles)
  data/              mock data modules (no backend, no real auth)
  assets/            icons, placeholder logos, etc.
  design/            wireframe handoff + brand guide — reference only, not app source
    handoff/          exported Claude Design wireframes + README spec
    branding/          UConsulting 2020 style guide (source of the real brand tokens)
```

## Status

Nav shell built (top bar, left rail, routing to every screen — most as
placeholders). Next, per the build order in CLAUDE.md: auth → onboarding →
jobs → job detail → tracker.
