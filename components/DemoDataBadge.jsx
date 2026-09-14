// One consistent, visible marker for the handful of places that still
// show illustrative/seed content instead of real club data -- direct ask
// ahead of a supervisor review: make it obvious at a glance what's real
// vs. placeholder, rather than relying on someone reading CLAUDE.md's own
// notes on which screens are still mock. Reused wherever a whole card/row
// is demo content (Applications tracker's 7 seeded applications, the 8
// hand-authored mock companies, Admin Dashboard's KPI figures) --
// `label` overrides the default text for a more specific claim (e.g.
// "Illustrative" for admin stats, where "Demo data" would misleadingly
// suggest fake club data rather than an acknowledged estimate).
export default function DemoDataBadge({ label = "Demo data", title }) {
  return (
    <span className="chip chip-demo" title={title || `${label} — not from a real UC member or real club activity`}>
      {label}
    </span>
  );
}
