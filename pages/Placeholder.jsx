// Generic stand-in for screens not yet built. Gets replaced with a real
// page component (per the wireframe id) as we work through the build order
// in CLAUDE.md.
export default function Placeholder({ title, screenId }) {
  return (
    <div>
      <h1>{title}</h1>
      {screenId && <p className="meta">Wireframe {screenId} — not built yet.</p>}
    </div>
  );
}
