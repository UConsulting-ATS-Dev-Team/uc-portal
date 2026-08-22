import { useEffect, useState } from "react";
import { supabase } from "../data/supabaseClient.js";
import "../styles/jobs.css";
import "../styles/admin.css";

const STATUS_LABEL = {
  approved: "Approved",
  approved_with_restrictions: "Approved (restricted)",
  requires_review: "Requires review",
  not_approved: "Not approved",
  disabled: "Disabled",
};

// The one UI surface for §3.7's source registry -- until now, flipping a
// source's authorization_status (the actual kill-switch every ingestion
// path checks before writing anything, per approve-submission and
// fetch-greenhouse-stripe's own header comments) required running SQL by
// hand. sources already grants admins full RLS access
// (sources_admin_all + grants.sql), so this reads/writes directly through
// the client -- no Edge Function needed, unlike the other admin actions on
// this app that touch jobs/job_sources (tables admins have no direct write
// access to at all).
export default function SourceManagement() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  async function loadSources() {
    setLoading(true);
    const { data: sourcesData, error: sourcesError } = await supabase.from("sources").select("*").order("name");
    if (sourcesError) {
      setError(sourcesError.message);
      setLoading(false);
      return;
    }

    // "Active jobs" per source -- how many currently-live listings trace
    // back to it, via job_sources. One query for all rows rather than one
    // count query per source.
    const { data: jobSourceRows } = await supabase.from("job_sources").select("source_id, jobs!inner(active)");
    const activeCountBySource = {};
    for (const row of jobSourceRows ?? []) {
      if (row.jobs?.active) activeCountBySource[row.source_id] = (activeCountBySource[row.source_id] ?? 0) + 1;
    }

    setSources((sourcesData ?? []).map((s) => ({ ...s, activeJobCount: activeCountBySource[s.id] ?? 0 })));
    setLoading(false);
  }

  useEffect(() => {
    loadSources();
  }, []);

  // Only approved <-> disabled is a casual one-click toggle. requires_review
  // and not_approved are deliberately not flippable from here -- §3.7's
  // whole point is that those need an actual human review decision, not a
  // reflexive click, so this page shows them as informational only.
  async function toggleStatus(source) {
    const nextStatus = source.authorization_status === "disabled" ? "approved" : "disabled";
    setTogglingId(source.id);
    setError(null);
    const { error: updateError } = await supabase
      .from("sources")
      .update({ authorization_status: nextStatus, last_reviewed_at: new Date().toISOString() })
      .eq("id", source.id);
    if (updateError) setError(updateError.message);
    await loadSources();
    setTogglingId(null);
  }

  const canToggle = (status) => status === "approved" || status === "approved_with_restrictions" || status === "disabled";

  return (
    <div>
      <div className="jobs-header" style={{ marginBottom: "var(--space-6)" }}>
        <div>
          <h1>Job sources</h1>
          <p className="meta">
            Every job on the board traces back to one of these -- a disabled or unapproved source can't
            contribute a single row, regardless of what any submission form or scheduled fetch tries to do.
          </p>
        </div>
      </div>

      {error && <p className="meta" style={{ color: "#B3261E" }}>{error}</p>}

      <table className="queue-table">
        <thead>
          <tr>
            <th>Source</th>
            <th>Type</th>
            <th>Status</th>
            <th>Active jobs</th>
            <th>Notes</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td style={{ textTransform: "capitalize" }}>{s.type.replace("_", " ")}</td>
              <td>
                <span className={`chip${s.authorization_status === "disabled" ? "" : " chip-accent"}`}>
                  {STATUS_LABEL[s.authorization_status] ?? s.authorization_status}
                </span>
              </td>
              <td>{s.activeJobCount}</td>
              <td className="meta" style={{ maxWidth: 360 }}>
                {s.storage_restrictions && <div>⚠ {s.storage_restrictions}</div>}
                {s.notes}
              </td>
              <td>
                {canToggle(s.authorization_status) ? (
                  <button className="btn btn-secondary" disabled={togglingId === s.id} onClick={() => toggleStatus(s)}>
                    {togglingId === s.id ? "Updating…" : s.authorization_status === "disabled" ? "Enable" : "Disable"}
                  </button>
                ) : (
                  <span className="meta">Needs manual review</span>
                )}
              </td>
            </tr>
          ))}
          {!loading && sources.length === 0 && (
            <tr>
              <td colSpan={6} className="meta">
                No sources registered.
              </td>
            </tr>
          )}
          {loading && (
            <tr>
              <td colSpan={6} className="meta">
                Loading…
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
