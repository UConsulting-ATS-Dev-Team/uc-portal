import { useState } from "react";
import Modal from "../Modal.jsx";
import { OUTCOMES } from "../../data/trackerUtils.js";
import { useAppState } from "../../data/store.jsx";
import "../../styles/onboarding.css";

// Captures what actually happened on a Closed application -- see migration
// 20260902130000_tracked_application_outcome.sql and its own comment for
// why "Closed" alone was ambiguous. Not one of the original 24 wireframe
// screens, same as Request a feature -- reuses the shared Modal shell
// (wireframe 3c's pattern) anyway since it's the established lightweight-
// form convention for a small, focused capture like this.
//
// Opened two ways from Applications.jsx: automatically right after a card
// is dropped/set to Closed (TrackerBoard's handleDrop), and via a
// persistent "Record outcome" affordance on any already-Closed card with
// no outcome yet -- covers the seed data and anything that reached Closed
// before this feature existed, not just new transitions.
//
// Calls the store's own setApplicationOutcome() rather than writing to
// Supabase directly (unlike e.g. RequestFeatureModal/PostOpportunityModal)
// -- outcome is just another field on the same trackedJobs record
// data/trackerSync.js already syncs to tracked_applications in the
// background, so this follows that existing local-first pattern instead of
// inventing a second write path for one field.
export default function RecordOutcomeModal({ jobId, job, currentOutcome, onClose }) {
  const { setApplicationOutcome } = useAppState();
  const [outcome, setOutcome] = useState(currentOutcome || null);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    if (!outcome) return;
    setApplicationOutcome(jobId, outcome);
    setSaved(true);
    setTimeout(onClose, 900);
  }

  return (
    <Modal
      title="What happened?"
      onClose={onClose}
      width={480}
      footer={
        saved ? (
          <span className="modal__footer-note">Outcome recorded.</span>
        ) : (
          <>
            <button className="btn btn-secondary" onClick={onClose}>Skip for now</button>
            <button className="btn btn-primary" disabled={!outcome} onClick={handleSave}>
              Save outcome
            </button>
          </>
        )
      }
    >
      <p className="meta" style={{ marginTop: 0, marginBottom: "var(--space-4)" }}>
        {job ? `${job.company} — ${job.role} ` : "This application "}
        moved to Closed. Recording what actually happened feeds UC's own real track-record data — the odds
        model's "UC track record" factor can only report a real offer rate once enough members log this.
      </p>
      <div className="chip-row">
        {OUTCOMES.map((o) => (
          <button
            key={o.key}
            type="button"
            className={`chip-toggle${outcome === o.key ? " is-selected" : ""}`}
            onClick={() => setOutcome(o.key)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </Modal>
  );
}
