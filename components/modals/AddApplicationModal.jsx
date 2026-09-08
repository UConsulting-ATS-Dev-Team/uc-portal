import { useMemo, useState } from "react";
import Modal from "../Modal.jsx";
import { JOBS } from "../../data/mockJobs.js";
import { STAGES } from "../../data/trackerUtils.js";
import { useAppState } from "../../data/store.jsx";

const TABS = ["From a UC posting", "Paste a link", "Enter manually"];

// onAdded: () => void, called after a UC-posting application is actually
// added to the tracker (lets Applications.jsx switch the stage filter, etc).
export default function AddApplicationModal({ onClose, onAdded }) {
  const { trackedJobs, addToTracker } = useAppState();
  const [tab, setTab] = useState(TABS[0]);
  const [search, setSearch] = useState("");
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [stage, setStage] = useState("Interested");
  const [externalNote, setExternalNote] = useState(false);

  const matches = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return JOBS.filter((j) => !trackedJobs[j.id] && (j.company.toLowerCase().includes(q) || j.role.toLowerCase().includes(q))).slice(0, 6);
  }, [search, trackedJobs]);

  function handleAdd() {
    if (tab === TABS[0] && selectedJobId) {
      addToTracker(selectedJobId, stage);
      onAdded?.();
      onClose();
    }
  }

  return (
    <Modal
      title="Add an application"
      onClose={onClose}
      footer={
        <>
          <span className="modal__footer-note">Stage: {stage}</span>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={tab === TABS[0] && !selectedJobId} onClick={handleAdd}>
            Add to tracker
          </button>
        </>
      }
    >
      <div className="entry-tabs">
        {TABS.map((t) => (
          <button key={t} className={tab === t ? "is-active" : ""} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === TABS[0] && (
        <>
          <label className="field-label">Search UC-posted &amp; UC-intelligence roles</label>
          <input
            type="text"
            placeholder="Company or role"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedJobId(null);
            }}
          />
          {search.trim() && matches.length === 0 && <p className="meta">No untracked roles match "{search}".</p>}
          {matches.map((j) => (
            <div
              key={j.id}
              className="modal-context-card"
              style={{ cursor: "pointer", borderColor: selectedJobId === j.id ? "var(--color-accent)" : undefined }}
              onClick={() => setSelectedJobId(j.id)}
            >
              <input type="radio" checked={selectedJobId === j.id} onChange={() => setSelectedJobId(j.id)} />
              <div>
                <div style={{ fontWeight: 700 }}>{j.role}</div>
                <div className="meta">{j.company} · {j.location}</div>
              </div>
            </div>
          ))}
        </>
      )}

      {tab === TABS[1] && (
        <>
          <label className="field-label">Job posting URL</label>
          <input type="url" placeholder="https://" value="" onChange={() => setExternalNote(true)} />
          {externalNote && (
            <p className="meta">
              We can't pull details from an outside link yet — use "Enter manually" instead, or ask Exec to
              add the posting via "Post a job."
            </p>
          )}
        </>
      )}

      {tab === TABS[2] && (
        <>
          <div className="field-row">
            <div>
              <label className="field-label">Company</label>
              <input type="text" placeholder="Company name" />
            </div>
            <div>
              <label className="field-label">Role</label>
              <input type="text" placeholder="Role title" />
            </div>
          </div>
          <p className="meta">
            Manually entered roles won't have an odds model or UC intelligence attached — this isn't wired up
            yet, so nothing will actually be saved.
          </p>
        </>
      )}

      {tab === TABS[0] && (
        <>
          <label className="field-label">Starting stage</label>
          <select value={stage} onChange={(e) => setStage(e.target.value)}>
            {STAGES.filter((s) => s !== "Closed").map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </>
      )}
    </Modal>
  );
}
