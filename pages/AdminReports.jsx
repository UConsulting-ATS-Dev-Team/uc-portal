import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { fetchInternProgress } from "../data/acceleratorSync.js";
import { fetchStageCounts } from "../data/adminToolsSync.js";
import { downloadCsv, toCsv } from "../data/csvExport.js";
import { supabase } from "../data/supabaseClient.js";
import "../styles/jobDetail.css";
import "../styles/adminTools.css";

const STAGES = ["Interested", "Preparing", "Applied", "Assessment", "First round", "Final round", "Closed"];
const stamp = () => new Date().toISOString().slice(0, 10);
const fmt = (iso) => (iso ? new Date(iso).toISOString() : "");

// Each report loads once, shows how big it is, and downloads as a CSV. They are the same numbers the admin pages already show.
function useReport(load) {
  const [state, setState] = useState({ rows: null, error: null });
  useEffect(() => {
    let cancelled = false;
    load()
      .then((rows) => !cancelled && setState({ rows, error: null }))
      .catch((e) => !cancelled && setState({ rows: null, error: e.message }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return state;
}

function ReportCard({ title, description, note, state, summary, onDownload }) {
  return (
    <div className="report-card">
      <div className="report-card__head">
        <div>
          <h2 className="report-card__title">{title}</h2>
          <p className="meta" style={{ margin: "var(--space-2) 0 0" }}>{description}</p>
        </div>
        <button className="btn btn-secondary" onClick={onDownload} disabled={!state.rows || state.rows.length === 0}>
          <Download size={14} strokeWidth={1.5} aria-hidden="true" /> Download CSV
        </button>
      </div>
      {state.error && <p className="meta" style={{ color: "var(--color-danger)", marginBottom: 0 }}>{state.error}</p>}
      {!state.error && state.rows === null && <p className="meta" style={{ marginBottom: 0 }}>Loading…</p>}
      {state.rows && <p className="report-card__summary">{summary(state.rows)}</p>}
      {note && <p className="meta" style={{ marginBottom: 0 }}>{note}</p>}
    </div>
  );
}

export default function AdminReports() {
  const engagement = useReport(async () => {
    const { data, error } = await supabase.rpc("member_engagement_report", { inactive_threshold_days: 14 });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
  const accelerator = useReport(fetchInternProgress);
  const stages = useReport(fetchStageCounts);

  const stageTotals = (rows) =>
    STAGES.map((s) => [s, rows.filter((r) => r.stage === s).reduce((n, r) => n + r.applications, 0)]).filter(([, n]) => n > 0);

  return (
    <div>
      <div className="jobs-header" style={{ marginBottom: "var(--space-5)" }}>
        <div>
          <h1>Reports</h1>
          <p className="meta">Download the numbers behind the admin pages as spreadsheets.</p>
        </div>
      </div>

      <ReportCard
        title="Member engagement"
        description="Every signed-up account with when it was last active and how many days ago."
        note="Shows whether someone has used the portal, never what they did there."
        state={engagement}
        summary={(rows) => `${rows.length} accounts, ${rows.filter((r) => r.is_disengaged).length} with no activity in 14 or more days.`}
        onDownload={() =>
          downloadCsv(
            `uc-member-engagement-${stamp()}.csv`,
            toCsv(["name", "email", "last_active", "days_inactive", "status"], engagement.rows.map((r) => [r.display_name, r.email, fmt(r.last_active_at), r.days_inactive ?? "", r.is_disengaged ? "No activity in 14+ days" : "Active"]))
          )
        }
      />

      <ReportCard
        title="Accelerator progress"
        description="Each intern's assignments, coffee chats and required meetings so far."
        note="The same figures as the Accelerator admin page."
        state={accelerator}
        summary={(rows) => `${rows.length} intern${rows.length === 1 ? "" : "s"}.`}
        onDownload={() =>
          downloadCsv(
            `uc-accelerator-progress-${stamp()}.csv`,
            toCsv(
              ["name", "email", "assignments_complete", "assignments_incomplete", "assignments_awaiting_review", "total_lessons", "coffee_chats_counted", "coffee_chats_target", "weeks_behind_on_chats", "required_meetings_attended", "required_meetings_so_far", "last_submission"],
              accelerator.rows.map((r) => [r.displayName, r.email, r.assignmentsComplete, r.assignmentsIncomplete, r.assignmentsAwaiting, r.totalLessons, r.chatsCounted, r.chatsTarget, r.weeksBehindOnChats, r.requiredAttended, r.requiredSoFar, fmt(r.lastSubmittedAt)])
            )
          )
        }
      />

      <ReportCard
        title="Application stages"
        description="How many tracked applications sit at each stage, by class year."
        note="Counts only: no member, job or company is named. A class year with fewer than 3 members tracking anything is combined into one row."
        state={stages}
        summary={(rows) => {
          const totals = stageTotals(rows);
          return totals.length ? totals.map(([s, n]) => `${s} ${n}`).join(" · ") : "Nobody is tracking an application yet.";
        }}
        onDownload={() =>
          downloadCsv(
            `uc-application-stages-${stamp()}.csv`,
            toCsv(["stage", "class_year", "applications", "members_tracking"], stages.rows.map((r) => [r.stage, r.classYear ?? "Other (fewer than 3 members)", r.applications, r.members]))
          )
        }
      />
    </div>
  );
}
