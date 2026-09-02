import { Link } from "react-router-dom";
import { nextActionForStage, formatDate, outcomeLabel } from "../data/trackerUtils.js";
import { deadlineLabel } from "../data/jobUtils.js";
import CompanyLogo from "./CompanyLogo.jsx";

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

// onRequestOutcome: (jobId) => void, optional -- same callback TrackerBoard
// takes, passed down from Applications.jsx so the one outcome-capture
// modal works from either view. Table has no stage-change interaction of
// its own (sorting/export only), so this column is read-only except for
// the "Record outcome" link on a Closed row with nothing recorded yet.
export default function TrackerTable({ applications, sortColumn, sortDirection, onSort, onExportCsv, onRequestOutcome }) {
  return (
    <div>
      <div className="tracker-table__scroll">
        <table className="tracker-table">
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th key={col.key} onClick={() => onSort(col.key)}>
                  {col.label}
                  {sortColumn === col.key && (sortDirection === "asc" ? " ↑" : " ↓")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {applications.map(({ jobId, job, stage, addedAt, outcome }) => (
              <tr key={jobId} className={stage === "Closed" ? "is-closed" : ""}>
                <td>
                  <Link to={`/jobs/${jobId}`} className="tracker-table__company" style={{ textDecoration: "none" }}>
                    <CompanyLogo name={job.company} initials={job.logoInitials} className="board-card__logo" />
                    {job.company}
                  </Link>
                </td>
                <td>{job.role}</td>
                <td>
                  <span className="chip">{stage}</span>
                </td>
                <td>{formatDate(addedAt)}</td>
                <td>{job.rolling ? "Rolling" : deadlineLabel(job)}</td>
                <td>{nextActionForStage(stage)}</td>
                <td>{job.ucConnections}</td>
                <td>
                  {stage !== "Closed" ? (
                    "—"
                  ) : outcome ? (
                    <span className="chip">{outcomeLabel(outcome)}</span>
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
          <button className="btn-link">Sync deadlines to calendar</button>
        </div>
      </div>
    </div>
  );
}
