import { Link } from "react-router-dom";
import { STAGES, nextActionForStage, formatDate, outcomeLabel, rejectionStageLabel } from "../data/trackerUtils.js";
import { deadlineLabel } from "../data/jobUtils.js";
import { SEED_TRACKED_JOB_IDS } from "../data/store.jsx";
import CompanyLogo from "./CompanyLogo.jsx";
import DemoDataBadge from "./DemoDataBadge.jsx";

const COLUMNS = [
  { key: "company", label: "Company" },
  { key: "role", label: "Role" },
  { key: "stage", label: "Stage" },
  { key: "applied", label: "Applied" },
  { key: "deadline", label: "Deadline" },
  { key: "nextAction", label: "Next action" },
  { key: "connections", label: "UC connections" },
  { key: "outcome", label: "Outcome" },
];

// onMoveStage/onRequestOutcome: same callbacks TrackerBoard takes, passed
// down from Applications.jsx so both views share one outcome-capture
// modal and one stage-change path. Table used to have no stage-change
// interaction of its own at all (sorting/export only) -- closed as part
// of the 2026-09-14 mobile QA pass, which found the Board's stage-change
// interaction (then HTML5 drag-and-drop only) didn't work on touch
// either, meaning there was no way to change a tracked application's
// stage on a real phone from any view. Same real <select> control as
// the Board's own "Move to" now.
export default function TrackerTable({ applications, sortColumn, sortDirection, onSort, onExportCsv, onMoveStage, onRequestOutcome }) {
  function commitMove(jobId, stage) {
    onMoveStage(jobId, stage);
    if (stage === "Closed") onRequestOutcome?.(jobId);
  }

  return (
    <div>
      <div className="tracker-table__scroll">
        <table className="tracker-table">
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th key={col.key} aria-sort={sortColumn === col.key ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}>
                  <button type="button" onClick={() => onSort(col.key)}>
                    {col.label}
                    {sortColumn === col.key && (sortDirection === "asc" ? " ↑" : " ↓")}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {applications.map(({ jobId, job, stage, addedAt, outcome, rejectionStage }) => (
              <tr key={jobId} className={stage === "Closed" ? "is-closed" : ""}>
                <td>
                  <Link to={`/jobs/${jobId}`} className="tracker-table__company" style={{ textDecoration: "none" }}>
                    <CompanyLogo name={job.company} initials={job.logoInitials} className="board-card__logo" />
                    {job.company}
                  </Link>
                  {SEED_TRACKED_JOB_IDS.includes(jobId) && (
                    <div style={{ marginTop: "var(--space-1)" }}>
                      <DemoDataBadge label="Seeded demo" title="One of the 7 illustrative applications seeded so the tracker isn't empty on first load -- not a real application" />
                    </div>
                  )}
                </td>
                <td>{job.role}</td>
                <td>
                  <select
                    className="tracker-table__stage-select"
                    aria-label={`Move ${job.company} — ${job.role} to a different stage`}
                    value={stage}
                    onChange={(e) => commitMove(jobId, e.target.value)}
                  >
                    {STAGES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{formatDate(addedAt)}</td>
                <td>{job.rolling ? "Rolling" : deadlineLabel(job)}</td>
                <td>{nextActionForStage(stage)}</td>
                {/* Real jobs leave ucConnections undefined (data/
                    realJobAdapter.js -- that CRM/tracker-boundary data
                    doesn't exist yet), unlike mock jobs which always have
                    a number. Now that a real job can genuinely reach this
                    table (RealJobDetail.jsx's "Add to tracker"), this
                    needed the same "unknown, not zero" fallback JobCard's
                    own footer already uses elsewhere. */}
                <td>{job.ucConnections ?? "—"}</td>
                <td>
                  {stage !== "Closed" ? (
                    "—"
                  ) : outcome ? (
                    <>
                      <span className="chip">{outcomeLabel(outcome)}</span>
                      {outcome === "rejected" && rejectionStage && (
                        <div className="meta" style={{ marginTop: "var(--space-1)" }}>
                          {rejectionStageLabel(rejectionStage)}
                        </div>
                      )}
                    </>
                  ) : (
                    <button className="btn-link" onClick={() => onRequestOutcome?.(jobId)}>
                      Record outcome
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="tracker-table__footer">
        <span>
          Showing {applications.length} of {applications.length}
        </span>
        <div className="tracker-table__footer-actions">
          <button className="btn-link" onClick={onExportCsv}>
            Export CSV
          </button>
          {/* Documented limitation: no calendar integration planned for
              this prototype. Sat next to a real working "Export CSV"
              with no visual distinction before this. */}
          <button className="btn-link" disabled title="Not built yet -- no calendar integration exists in this prototype">
            Sync deadlines to calendar
          </button>
        </div>
      </div>
    </div>
  );
}
