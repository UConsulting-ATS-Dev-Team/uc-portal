// Wireframe 3e's error state. There's no real network layer in this
// prototype to fail naturally, so this is triggered by a ?simulateError=1
// query param on Jobs for demo purposes -- wire it to a real fetch
// failure once there's a backend to fail against.
export default function ErrorState({ what = "jobs", onRetry }) {
  return (
    <div className="empty-state">
      <h1>We couldn't load your {what}</h1>
      <p>Your tracked data is safe — this is just a loading problem, not a data problem.</p>
      <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "center", marginTop: "var(--space-5)" }}>
        <button className="btn btn-primary" onClick={onRetry}>Try again</button>
        <button className="btn btn-secondary">Report to Exec</button>
      </div>
    </div>
  );
}
