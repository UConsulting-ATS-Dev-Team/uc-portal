import { useMemo, useState } from "react";
import Modal from "../Modal.jsx";
import { JOBS } from "../../data/mockJobs.js";
import { computeOdds } from "../../data/oddsModel.js";
import { useAppState } from "../../data/store.jsx";

const ACTIVITIES = ["Case practice", "Behavioral prep", "Technical / skills drill", "Mock interview with a peer", "Resource reading"];

// job: optional -- when opened from Job detail, pre-selects that job and
// hides the picker. onClose: () => void. computeOddsFn: optional, defaults
// to the mock data/oddsModel.js's computeOdds -- pages/RealJobDetail.jsx
// passes a real-odds-backed function instead (bound to that job's already-
// fetched data/realOddsModel.js inputs) so this same modal/effect-preview
// works for a real job without duplicating the before/after UI. Only
// reachable when `job` is provided (the picker below is mock-only), so a
// real-job caller never exercises the JOBS/trackedList picker path at all.
export default function LogPrepModal({ job, onClose, computeOddsFn = computeOdds }) {
  const { trackedJobs, prepLogged, logPrep } = useAppState();
  const trackedList = useMemo(
    () => Object.keys(trackedJobs).map((id) => JOBS.find((j) => j.id === id)).filter(Boolean),
    [trackedJobs]
  );
  const [selectedId, setSelectedId] = useState(job?.id || trackedList[0]?.id || null);
  const [activity, setActivity] = useState(ACTIVITIES[0]);
  const [hours, setHours] = useState(2);
  const [withWhom, setWithWhom] = useState("");
  const [logged, setLogged] = useState(false);

  const selectedJob = job || trackedList.find((j) => j.id === selectedId);

  // before = odds at currently-logged hours; after = odds with this
  // session's hours added on top -- mirrors how JobDetail/OddsModel pass
  // prepLogged[job.id] in as extraPrepHours.
  const effect = useMemo(() => {
    if (!selectedJob) return null;
    const currentExtra = prepLogged[selectedJob.id] || 0;
    const before = computeOddsFn(selectedJob, { extraPrepHours: currentExtra });
    const after = computeOddsFn(selectedJob, { extraPrepHours: currentExtra + hours });
    return { before, after };
  }, [selectedJob, hours, prepLogged, computeOddsFn]);

  function handleLog() {
    if (!selectedJob) return;
    logPrep(selectedJob.id, hours);
    setLogged(true);
    setTimeout(onClose, 1100);
  }

  return (
    <Modal
      title="Log prep time"
      onClose={onClose}
      footer={
        logged ? (
          <span className="modal__footer-note">Logged {hours} hour{hours === 1 ? "" : "s"}.</span>
        ) : (
          <>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!selectedJob} onClick={handleLog}>
              Log time
            </button>
          </>
        )
      }
    >
      {!job && (
        <>
          <label className="field-label">Which application</label>
          {trackedList.length === 0 ? (
            <p className="meta">Nothing in your tracker yet — add an application first.</p>
          ) : (
            <select value={selectedId || ""} onChange={(e) => setSelectedId(e.target.value)}>
              {trackedList.map((j) => (
                <option key={j.id} value={j.id}>{j.company} — {j.role}</option>
              ))}
            </select>
          )}
        </>
      )}

      {selectedJob && (
        <>
          <label className="field-label">Activity</label>
          <select value={activity} onChange={(e) => setActivity(e.target.value)}>
            {ACTIVITIES.map((a) => <option key={a}>{a}</option>)}
          </select>

          <div className="field-row">
            <div>
              <label className="field-label">Hours</label>
              <input type="number" min={0.5} max={12} step={0.5} value={hours} onChange={(e) => setHours(Number(e.target.value) || 0)} />
            </div>
            <div>
              <label className="field-label">With whom (optional)</label>
              <input type="text" value={withWhom} onChange={(e) => setWithWhom(e.target.value)} placeholder="e.g. a UC alum" />
            </div>
          </div>

          {effect && (
            <div className="effect-card">
              <div style={{ fontWeight: 700, marginBottom: "var(--space-2)" }}>
                Estimated effect on your {selectedJob.company} odds
              </div>
              <div className="meta">
                Brings you to {effect.after.prepHours} logged hours for this role.
              </div>
              <div style={{ fontSize: "var(--text-title-min)", fontWeight: 700, color: "var(--color-accent)", marginTop: "var(--space-2)" }}>
                {effect.before.headline}% → {effect.after.headline}%
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
