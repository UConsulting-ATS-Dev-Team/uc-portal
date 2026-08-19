import { Routes, Route } from "react-router-dom";

// Placeholder route — real pages are added under pages/ once the wireframe
// review is confirmed (see CLAUDE.md).
function Placeholder() {
  return (
    <main style={{ padding: "2rem" }}>
      <h1>UC Career</h1>
      <p>Scaffolding only. Pages are built next, from design/handoff/.</p>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Placeholder />} />
    </Routes>
  );
}
