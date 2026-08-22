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

const FETCH_STATUS_LABEL = { success: "Success", failed: "Failed", skipped: "Skipped" };

// Short, glanceable text for a log row's summary -- the full JSON is in the
// DB for anyone who needs it, but this page just needs "is this healthy."
function summarizeFetchLog(log) {
  if (!log) return null;
  if (log.status === "failed") return log.summary?.error ?? "Unknown error";
  if (log.status === "skipped") return log.summary?.reason ?? "Skipped";
  const s = log.summary ?? {};
  return `${s.fetched ?? "?"} fetched, ${s.inserted ?? 0} new, ${s.merged ?? 0} merged, ${s.flaggedDuplicate ?? 0} flagged`;
}

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

    // US-51: the most recent source_fetch_log row per source, if any --
    // written by every scheduled fetcher on every run (success or
    // failure), see fetch-greenhouse-stripe's header comment. Submission
    // sources (admin/member) never fetch on a schedule, so they'll always
    // show "Never" here, which is correct, not a bug.
    const { data: logs } = await supabase.from("source_fetch_log").select("*").order("created_at", { ascending: false });
    const latestLogBySource = {};
    for (const log of logs ?? []) {
      if (!latestLogBySource[log.source_id]) latestLogBySource[log.source_id] = log;
    }

    setSources((sourcesData ?? []).map((s) => ({ ...s, activeJobCount: activeCountBySource[s.id] ?? 0, lastFetch: latestLogBySource[s.id] ?? null })));
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
            <th>Last fetch</th>
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
              <td className="meta" style={{ maxWidth: 220 }}>
                {s.lastFetch ? (
                  <>
                    <span style={{ color: s.lastFetch.status === "failed" ? "#B3261E" : "inherit", fontWeight: 700 }}>
                      {FETCH_STATUS_LABEL[s.lastFetch.status] ?? s.lastFetch.status}
                    </span>
                    <div>{new Date(s.lastFetch.completed_at ?? s.lastFetch.started_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
                    <div>{summarizeFetchLog(s.lastFetch)}</div>
                  </>
                ) : (
                  "Never"
                )}
              </td>
              <td className="meta" style={{ maxWidth: 300 }}>
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
              <td colSpan={7} className="meta">
                No sources registered.
              </td>
            </tr>
          )}
          {loading && (
            <tr>
              <td colSpan={7} className="meta">
                Loading…
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
