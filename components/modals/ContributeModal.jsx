import { useState } from "react";
import Modal from "../Modal.jsx";
import "../../styles/onboarding.css";

const TYPES = ["Interview write-up", "Company guide", "Resource / guide", "Question", "Event", "Job posting"];
const CATEGORIES = ["Resume", "Cover letter", "Consulting cases", "Behavioral", "Networking", "Recruiting timelines", "Industry guides", "Company guides"];
const OUTCOMES = ["Offer", "Rejected", "Withdrew", "Still in process"];
const NOTE_LIMIT = 1500;

// Contributed content isn't wired into the real Career Resources library
// (RESOURCES is a static reference list, not stored state) -- this models
// the submission flow honestly (validates, "publishes" within the modal)
// without silently pretending a static list gained a permanent new entry.
export default function ContributeModal({ onClose }) {
  const [type, setType] = useState(TYPES[0]);
  const [company, setCompany] = useState("");
  const [round, setRound] = useState("");
  const [outcome, setOutcome] = useState(OUTCOMES[0]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [categories, setCategories] = useState([]);
  const [anonymous, setAnonymous] = useState(false);
  const [published, setPublished] = useState(false);

  function toggleCategory(c) {
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  const canPublish = title.trim() && body.trim();

  if (published) {
    return (
      <Modal
        title="Contribute to the library"
        onClose={onClose}
        footer={<button className="btn btn-primary" onClick={onClose}>Done</button>}
      >
        <div className="modal-success">
          Published — thanks for contributing.
          <p className="meta" style={{ fontWeight: 400, marginTop: "var(--space-3)" }}>
            {anonymous ? "Posted anonymously." : "Posted under your name."} It'll be visible to the Careers Committee
            for the library shortly.
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Contribute to the library"
      onClose={onClose}
      width={640}
      footer={
        <>
          <span className="modal__footer-note">Every write-up strengthens the odds model for everyone.</span>
          <button className="btn btn-secondary" onClick={onClose}>Save draft</button>
          <button className="btn btn-primary" disabled={!canPublish} onClick={() => setPublished(true)}>
            Publish
          </button>
        </>
      }
    >
      <label className="field-label">Type</label>
      <div className="chip-row">
        {TYPES.map((t) => (
          <button key={t} type="button" className={`chip-toggle${type === t ? " is-selected" : ""}`} onClick={() => setType(t)}>
            {t}
          </button>
        ))}
      </div>

      {type === "Interview write-up" && (
        <div className="field-row">
          <div>
            <label className="field-label">Company</label>
            <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company name" />
          </div>
          <div>
            <label className="field-label">Round</label>
            <input type="text" value={round} onChange={(e) => setRound(e.target.value)} placeholder="e.g. First round" />
          </div>
        </div>
      )}

      {type === "Interview write-up" && (
        <>
          <label className="field-label">Outcome</label>
          <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            {OUTCOMES.map((o) => <option key={o}>{o}</option>)}
          </select>
        </>
      )}

      <label className="field-label">Title</label>
      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Give it a short, searchable title" />

      <label className="field-label">What happened / what it covers</label>
      <textarea rows={5} maxLength={NOTE_LIMIT} value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="char-limit">{body.length}/{NOTE_LIMIT}</div>

      <div className="dropzone">Drag a file here, or click to attach (optional)</div>

      <label className="field-label">Categories</label>
      <div className="chip-row">
        {CATEGORIES.map((c) => (
          <button key={c} type="button" className={`chip-toggle${categories.includes(c) ? " is-selected" : ""}`} onClick={() => toggleCategory(c)}>
            {c}
          </button>
        ))}
      </div>

      <div className="checkbox-row">
        <input type="checkbox" id="anon" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
        <label htmlFor="anon">Post anonymously</label>
      </div>
    </Modal>
  );
}
