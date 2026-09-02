import { useState } from "react";
import Modal from "../Modal.jsx";
import { sendRequest } from "../../data/casePartners.js";
import "../../styles/onboarding.css";

const NOTE_LIMIT = 300;

function initials(name) {
  return name.split(" ").map((p) => p[0]).join("");
}

// candidate: a data/casePartners.js fetchCandidates() row
// ({memberId, displayName, industries, roles, recruitingCycle}).
// onSent: () => void, called after the request lands so the caller can
// refresh its own request list. onClose: () => void.
export default function RequestCasePartnerModal({ candidate, onClose, onSent }) {
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      await sendRequest(candidate.memberId, note.trim());
      setSent(true);
      onSent?.();
      setTimeout(onClose, 1100);
    } catch (err) {
      setError(err.message);
      setSending(false);
    }
  }

  return (
    <Modal
      title="Request a case partner"
      onClose={onClose}
      footer={
        sent ? (
          <span className="modal__footer-note">Request sent to {candidate.displayName}.</span>
        ) : (
          <>
            {error && <span className="modal__footer-note" style={{ color: "var(--color-danger, #b3261e)" }}>{error}</span>}
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={sending} onClick={handleSend}>
              {sending ? "Sending…" : "Send request"}
            </button>
          </>
        )
      }
    >
      <div className="modal-context-card">
        <div className="person-card__avatar">{initials(candidate.displayName)}</div>
        <div>
          <div style={{ fontWeight: 700 }}>{candidate.displayName}</div>
          <div className="meta">
            {candidate.industries.length > 0 ? candidate.industries.join(", ") : "No target industries set"}
            {candidate.recruitingCycle ? ` · ${candidate.recruitingCycle}` : ""}
          </div>
        </div>
      </div>

      <p className="meta" style={{ marginBottom: "var(--space-4)" }}>
        This only sends a request -- you're not paired up until {candidate.displayName.split(" ")[0]} accepts it themselves.
        You'll see it under "My case partners" either way.
      </p>

      <label className="field-label">Note (optional)</label>
      <textarea
        rows={3}
        maxLength={NOTE_LIMIT}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={`Tell ${candidate.displayName.split(" ")[0]} what you're looking to practice (e.g. market-sizing cases, twice a week).`}
      />
      <div className="char-limit">{note.length}/{NOTE_LIMIT}</div>
    </Modal>
  );
}
