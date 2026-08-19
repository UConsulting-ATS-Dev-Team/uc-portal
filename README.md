# UC Portal — UC Career prototype

Clickable prototype of **UC Career**, a private career/professional-
development platform for a university consulting club. See
[CLAUDE.md](CLAUDE.md) for the full page inventory, design conventions,
and open decisions, sourced from the wireframe handoff in
[design/handoff/](design/handoff).

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
  assets/            icons, placeholder logos, etc.
  design/            wireframe handoff — reference only, not app source
    handoff/          exported Claude Design wireframes + README spec
```

## Status

Scaffolding only — no pages built yet. Next: confirm the page list/design
read in CLAUDE.md, then build screens starting with the shell → auth →
onboarding → jobs → job detail → tracker, per the handoff's suggested
order (everything else depends on those).
