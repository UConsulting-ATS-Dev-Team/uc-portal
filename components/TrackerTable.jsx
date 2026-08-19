import { Link } from "react-router-dom";
import { nextActionForStage, formatDate } from "../data/trackerUtils.js";
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
];

export default function TrackerTable({ applications, sortColumn, sortDirection, onSort, onExportCsv }) {
  return (
    <div>
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
          {applications.map(({ jobId, job, stage, addedAt }) => (
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
            </tr>
          ))}
        </tbody>
      </table>
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
