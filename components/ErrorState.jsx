import { useState } from "react";
import { reportClientError } from "../data/errorReporting.js";

// Wireframe 3e's error state. There's no real network layer in this
// prototype to fail naturally, so this is triggered by a ?simulateError=1
// query param on Jobs for demo purposes -- wire it to a real fetch
// failure once there's a backend to fail against. "Report to Exec" now
// writes a real row to client_error_reports (same table the global error
// boundary/window handlers use, context: "manual_report") -- closes the
// gap this file used to flag itself ("no report-an-issue flow exists").
export default function ErrorState({ what = "jobs", onRetry }) {
  const [reported, setReported] = useState(false);

  function handleReport() {
    reportClientError({ message: `Member-reported: ${what} failed to load`, context: "manual_report" });
    setReported(true);
  }

  return (
    <div className="empty-state">
      <h1>We couldn't load your {what}</h1>
      <p>Give it another try, or let Exec know if it keeps happening.</p>
      <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "center", marginTop: "var(--space-5)" }}>
        <button className="btn btn-primary" onClick={onRetry}>Try again</button>
        <button className="btn btn-secondary" onClick={handleReport} disabled={reported}>
          {reported ? "Reported" : "Report to Exec"}
        </button>
      </div>
    </div>
  );
}
