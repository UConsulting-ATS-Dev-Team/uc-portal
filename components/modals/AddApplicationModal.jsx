import { useEffect, useMemo, useState } from "react";
import Modal from "../Modal.jsx";
import { JOBS as MOCK_JOBS } from "../../data/mockJobs.js";
import { searchRealJobs } from "../../data/realJobAdapter.js";
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
  const [realMatches, setRealMatches] = useState([]);
  const [realSearchLoading, setRealSearchLoading] = useState(false);

  const trackedJobIds = useMemo(() => Object.keys(trackedJobs), [trackedJobs]);

  const mockMatches = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return MOCK_JOBS.filter((j) => !trackedJobs[j.id] && (j.company.toLowerCase().includes(q) || j.role.toLowerCase().includes(q))).slice(0, 6);
  }, [search, trackedJobs]);

  // Debounced (250ms) real-job search -- this fires a real Supabase query
  // per distinct search term (searchRealJobs, a bounded .limit() query, not
  // fetchAllRows), so it shouldn't fire on every keystroke. Real matches
  // shown first below (mock jobs are legacy demo content at this point);
  // the mock search above stays synchronous/instant, no debounce needed.
  useEffect(() => {
    if (!search.trim()) {
      setRealMatches([]);
      return;
    }
    let cancelled = false;
    setRealSearchLoading(true);
    const timer = setTimeout(() => {
      searchRealJobs(search, trackedJobIds)
        .then((results) => {
          if (!cancelled) setRealMatches(results);
        })
        .catch(() => {
          if (!cancelled) setRealMatches([]);
        })
        .finally(() => {
          if (!cancelled) setRealSearchLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, trackedJobIds]);

  const matches = [...realMatches, ...mockMatches];

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
          {search.trim() && realSearchLoading && matches.length === 0 && <p className="meta">Searching…</p>}
          {search.trim() && !realSearchLoading && matches.length === 0 && (
            <p className="meta">No untracked roles match "{search}".</p>
          )}
          {matches.map((j) => (
            // A real <label> wrapping the radio, not a div+onClick -- the
            // radio previously had no `name` (so it wasn't a real
            // mutually-exclusive group for arrow-key nav) and no
            // accessible name at all (adjacent text divs don't label an
            // input on their own). The label now provides both: a proper
            // accessible name, and native click/keyboard activation with
            // no extra JS.
            <label
              key={j.id}
              className="modal-context-card"
              style={{ cursor: "pointer", borderColor: selectedJobId === j.id ? "var(--color-accent)" : undefined }}
            >
              <input type="radio" name="add-application-job" checked={selectedJobId === j.id} onChange={() => setSelectedJobId(j.id)} />
              <div>
                <div style={{ fontWeight: 700 }}>{j.role}</div>
                <div className="meta">{j.company} · {j.location}</div>
              </div>
            </label>
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
