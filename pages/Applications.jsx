import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { JOBS as MOCK_JOBS } from "../data/mockJobs.js";
import { daysUntil } from "../data/jobUtils.js";
import { STAGES, outcomeLabel, rejectionStageLabel } from "../data/trackerUtils.js";
import { useAppState } from "../data/store.jsx";
import { fetchAllRows } from "../data/fetchAllRows.js";
import { matchJob } from "../data/jobMatch.js";
import { realJobToCardShape, JOB_LIST_COLUMNS } from "../data/realJobAdapter.js";
import { currentUser } from "../data/mockUser.js";
import { resolvedClassYear } from "../data/profileUtils.js";
import TrackerBoard from "../components/TrackerBoard.jsx";
import TrackerTable from "../components/TrackerTable.jsx";
import TrackerTimeline from "../components/TrackerTimeline.jsx";
import AddApplicationModal from "../components/modals/AddApplicationModal.jsx";
import RecordOutcomeModal from "../components/modals/RecordOutcomeModal.jsx";
import "../styles/tracker.css";
import "../styles/timeline.css";
import "../styles/home.css";

const VIEWS = ["Board", "Table", "Timeline"];

function toCsv(applications) {
  const header = ["Company", "Role", "Stage", "Applied", "Deadline", "Outcome", "Rejected at"];
  const rows = applications.map(({ job, stage, addedAt, outcome, rejectionStage }) => [
    job.company,
    job.role,
    stage,
    addedAt ? new Date(addedAt).toISOString().slice(0, 10) : "",
    job.rolling ? "Rolling" : job.deadlineDate || "",
    outcome ? outcomeLabel(outcome) : "",
    outcome === "rejected" && rejectionStage ? rejectionStageLabel(rejectionStage) : "",
  ]);
  return [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
}

function downloadCsv(csv) {
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "uc-portal-applications.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function Applications() {
  const { trackedJobs, updateApplicationStage, timelineShiftDays, shiftTimeline, preferences, profileOverrides } = useAppState();
  const [view, setView] = useState("Board");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("All stages");
  const [sortColumn, setSortColumn] = useState("deadline");
  const [sortDirection, setSortDirection] = useState("asc");
  const [showAddModal, setShowAddModal] = useState(false);
  const [outcomeModalJobId, setOutcomeModalJobId] = useState(null);

  // Tracked jobs used to only ever resolve against data/mockJobs.js's 8
  // demo jobs -- fine while the only way to track anything was that same
  // mock-only list, but real jobs can now genuinely reach the tracker
  // (RealJobDetail.jsx's new "Add to tracker" button, and this page's own
  // "+ Add application" modal now searching real postings too). Same
  // real-jobs fetch pages/Home.jsx and pages/Jobs.jsx already use.
  const classYear = resolvedClassYear(currentUser, profileOverrides);
  const [rawJobs, setRawJobs] = useState([]);
  useEffect(() => {
    // JOB_LIST_COLUMNS, not "*" -- same ~58% payload cut as pages/Jobs.jsx's
    // identical fetch (see data/realJobAdapter.js's own comment); this page
    // reads the exact same fields via the same realJobToCardShape/matchJob
    // pipeline, so the trim is safe here for the same reason.
    fetchAllRows("jobs", JOB_LIST_COLUMNS, (q) => q.eq("active", true))
      .then(setRawJobs)
      .catch(() => {});
  }, []);
  const realJobs = useMemo(
    () => rawJobs.map((job) => realJobToCardShape(job, matchJob(job, preferences, classYear))),
    [rawJobs, preferences, classYear]
  );

  const applications = useMemo(() => {
    return Object.entries(trackedJobs)
      .map(([jobId, info]) => {
        const job = realJobs.find((j) => j.id === jobId) || MOCK_JOBS.find((j) => j.id === jobId);
        if (!job) return null;
        return { jobId, job, ...info };
      })
      .filter(Boolean)
      .filter((a) => {
        if (stageFilter !== "All stages" && a.stage !== stageFilter) return false;
        if (!search) return true;
        const q = search.toLowerCase();
        return a.job.company.toLowerCase().includes(q) || a.job.role.toLowerCase().includes(q);
      });
  }, [trackedJobs, realJobs, search, stageFilter]);

  const sortedForTable = useMemo(() => {
    const withKey = applications.map((a) => {
      let key;
      if (sortColumn === "company") key = a.job.company.toLowerCase();
      else if (sortColumn === "role") key = a.job.role.toLowerCase();
      else if (sortColumn === "stage") key = STAGES.indexOf(a.stage);
      else if (sortColumn === "applied") key = a.addedAt || "";
      else if (sortColumn === "connections") key = a.job.ucConnections;
      else key = a.job.rolling ? Infinity : daysUntil(a.job.deadlineDate) ?? Infinity;
      return { ...a, sortKey: key };
    });
    withKey.sort((x, y) => {
      if (x.sortKey < y.sortKey) return sortDirection === "asc" ? -1 : 1;
      if (x.sortKey > y.sortKey) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return withKey;
  }, [applications, sortColumn, sortDirection]);

  function handleSort(column) {
    if (column === sortColumn) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  }

  return (
    <div>
      <div className="tracker-header">
        <div>
          <h1>Applications</h1>
          <p className="meta">{applications.length} tracked</p>
        </div>
        <div className="tracker-controls">
          <div className="tracker-view-toggle">
            {VIEWS.map((v) => (
              <button key={v} className={view === v ? "is-active" : ""} onClick={() => setView(v)}>
                {v}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Search company or role"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
            <option>All stages</option>
            {STAGES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Add application</button>
        </div>
      </div>

      {Object.keys(trackedJobs).length === 0 ? (
        <div className="empty-state">
          <h1 style={{ fontSize: "var(--text-title-min)" }}>Nothing tracked yet</h1>
          <p>
            Add a role you're just considering, not only ones you've already applied to — the tracker is
            useful before you apply, not just after.
          </p>
          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "center", marginTop: "var(--space-5)" }}>
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Add your first application</button>
            <Link to="/jobs" className="btn btn-secondary">
              Browse {realJobs.filter((j) => j.matchScore >= 70).length} matched roles
            </Link>
          </div>
        </div>
      ) : (
        <>
          {view === "Board" && (
            <TrackerBoard
              applications={applications}
              onMoveStage={updateApplicationStage}
              onRequestOutcome={setOutcomeModalJobId}
            />
          )}

          {view === "Table" && (
            <TrackerTable
              applications={sortedForTable}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={handleSort}
              onExportCsv={() => downloadCsv(toCsv(applications))}
              onMoveStage={updateApplicationStage}
              onRequestOutcome={setOutcomeModalJobId}
            />
          )}

          {view === "Timeline" && (
            <TrackerTimeline
              applications={applications}
              timelineShiftDays={timelineShiftDays}
              onShiftTimeline={shiftTimeline}
            />
          )}
        </>
      )}

      {showAddModal && <AddApplicationModal onClose={() => setShowAddModal(false)} />}

      {outcomeModalJobId && (
        <RecordOutcomeModal
          jobId={outcomeModalJobId}
          job={realJobs.find((j) => j.id === outcomeModalJobId) || MOCK_JOBS.find((j) => j.id === outcomeModalJobId)}
          currentOutcome={trackedJobs[outcomeModalJobId]?.outcome}
          currentRejectionStage={trackedJobs[outcomeModalJobId]?.rejectionStage}
          stageHistory={trackedJobs[outcomeModalJobId]?.stageHistory}
          onClose={() => setOutcomeModalJobId(null)}
        />
      )}
    </div>
  );
}
