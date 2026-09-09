import { useMemo, useState } from "react";
import Modal from "../Modal.jsx";
import { JOBS as MOCK_JOBS } from "../../data/mockJobs.js";
import { computeOdds } from "../../data/oddsModel.js";
import { useAppState } from "../../data/store.jsx";
import { useRealJobs } from "../../data/useRealJobs.js";
import { isRealJobId } from "../../data/realJobAdapter.js";
import { currentUser } from "../../data/mockUser.js";
import { resolvedClassYear } from "../../data/profileUtils.js";

const ACTIVITIES = ["Case practice", "Behavioral prep", "Technical / skills drill", "Mock interview with a peer", "Resource reading"];

// job: optional -- when opened from Job detail, pre-selects that job and
// hides the picker. onClose: () => void. computeOddsFn: optional, defaults
// to the mock data/oddsModel.js's computeOdds -- pages/RealJobDetail.jsx
// passes a real-odds-backed function instead (bound to that job's already-
// fetched data/realOddsModel.js inputs) so this same modal/effect-preview
// works for a real job without duplicating the before/after UI.
//
// The generic picker below (no job prop -- opened from e.g. Career
// Resources / a learning track's "Log prep time") used to only ever list
// data/mockJobs.js's 8 demo jobs, so a real tracked job silently couldn't
// be selected here at all -- same bug class as the Home/Applications/
// Saved-tab fixes. It's fixed on the list side (real-first, mock-fallback,
// via useRealJobs), but the *odds* side still can't be fixed the same way:
// unlike RealJobDetail.jsx, this modal has no already-fetched
// data/realOddsModel.js inputs for a job selected generically here, and
// computing those needs an async fetch this synchronous effect-preview
// isn't set up to await. Rather than run the real job through the mock
// computeOdds (which would read its missing pastCycleApplicants/
// ucConnections fields as falsy and produce a plausible-looking but
// unearned number), a real job selected via this generic picker still logs
// the hours for real, it just skips the effect-preview card with an honest
// note instead of guessing.
export default function LogPrepModal({ job, onClose, computeOddsFn }) {
  const { trackedJobs, prepLogged, logPrep, preferences, profileOverrides } = useAppState();
  const classYear = resolvedClassYear(currentUser, profileOverrides);
  const { realJobs } = useRealJobs(preferences, classYear);
  const trackedList = useMemo(
    () =>
      Object.keys(trackedJobs)
        .map((id) => realJobs.find((j) => j.id === id) || MOCK_JOBS.find((j) => j.id === id))
        .filter(Boolean),
    [trackedJobs, realJobs]
  );
  const [selectedId, setSelectedId] = useState(job?.id || trackedList[0]?.id || null);
  const [activity, setActivity] = useState(ACTIVITIES[0]);
  const [hours, setHours] = useState(2);
  const [withWhom, setWithWhom] = useState("");
  const [logged, setLogged] = useState(false);

  const selectedJob = job || trackedList.find((j) => j.id === selectedId);
  // Only ever compute a mock-model estimate for a mock job. A real job
  // picked via the generic picker (no explicit computeOddsFn from a caller
  // that already has real odds inputs, like RealJobDetail.jsx) has no odds
  // function it's safe to use here -- see the class comment above.
  const activeComputeOddsFn = computeOddsFn || (selectedJob && !isRealJobId(selectedJob.id) ? computeOdds : null);

  // before = odds at currently-logged hours; after = odds with this
  // session's hours added on top -- mirrors how JobDetail/OddsModel pass
  // prepLogged[job.id] in as extraPrepHours.
  const effect = useMemo(() => {
    if (!selectedJob || !activeComputeOddsFn) return null;
    const currentExtra = prepLogged[selectedJob.id] || 0;
    const before = activeComputeOddsFn(selectedJob, { extraPrepHours: currentExtra });
    const after = activeComputeOddsFn(selectedJob, { extraPrepHours: currentExtra + hours });
    return { before, after };
  }, [selectedJob, hours, prepLogged, activeComputeOddsFn]);

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
          {!effect && isRealJobId(selectedJob.id) && (
            <p className="meta">
              Odds estimate isn't available from here — open {selectedJob.role} at {selectedJob.company} to see
              its full odds model. This will still log your hours.
            </p>
          )}
        </>
      )}
    </Modal>
  );
}
