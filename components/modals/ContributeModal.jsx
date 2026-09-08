import { useState } from "react";
import Modal from "../Modal.jsx";
import { submitInterviewWriteup } from "../../data/realWriteups.js";
import { currentUser } from "../../data/mockUser.js";
import "../../styles/onboarding.css";

const TYPES = ["Interview write-up", "Company guide", "Resource / guide", "Question", "Event", "Job posting"];
const CATEGORIES = ["Resume", "Cover letter", "Consulting cases", "Behavioral", "Networking", "Recruiting timelines", "Industry guides", "Company guides"];
const OUTCOMES = ["Offer", "Rejected", "Withdrew", "Still in process"];
const NOTE_LIMIT = 1500;

// Every type except "Interview write-up" is still exactly what CLAUDE.md's
// Progress entry describes: RESOURCES is a static reference list, not
// stored state, so those paths just validate and show the in-modal
// "Published" state honestly rather than pretending a static list gained a
// permanent new entry. "Interview write-up" is now the real exception --
// it writes a real row to interview_writeups (see that migration), tied to
// a real job when opened from one.
//
// `job` (optional) is the real job {id, company} this was opened from
// (RealJobDetail.jsx's "Share your experience" button) -- when present the
// company is fixed to that job's own company (not re-typable, so the
// write-up can't end up mismatched against the job it was launched from)
// and the submission carries job_id for an exact match on that job's page.
// Opened generically from Career Resources' "+ Contribute", `job` is
// undefined and company stays the original free-text field.
export default function ContributeModal({ onClose, job }) {
  const [type, setType] = useState(TYPES[0]);
  const [company, setCompany] = useState("");
  const [round, setRound] = useState("");
  const [outcome, setOutcome] = useState(OUTCOMES[0]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [categories, setCategories] = useState([]);
  const [anonymous, setAnonymous] = useState(false);
  const [published, setPublished] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  function toggleCategory(c) {
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  const isWriteup = type === "Interview write-up";
  const effectiveCompany = job ? job.company : company;
  const canPublish = title.trim() && body.trim() && (!isWriteup || effectiveCompany.trim()) && !submitting;

  async function handlePublish() {
    if (!isWriteup) {
      setPublished(true);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitInterviewWriteup({
        jobId: job?.id ?? null,
        company: effectiveCompany,
        title,
        round,
        outcome,
        body,
        isAnonymous: anonymous,
        submitterName: `${currentUser.firstName} ${currentUser.lastName}`,
      });
      setPublished(true);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

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
            {isWriteup
              ? `${anonymous ? "Posted anonymously." : "Posted under your name."} Visible now on ${effectiveCompany}'s real job listings.`
              : `${anonymous ? "Posted anonymously." : "Posted under your name."} It'll be visible to Exec for the library shortly.`}
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
          <span className="modal__footer-note">
            {submitError ? <span style={{ color: "#B3261E" }}>{submitError}</span> : "Every write-up strengthens the odds model for everyone."}
          </span>
          <button className="btn btn-secondary" onClick={onClose}>Save draft</button>
          <button className="btn btn-primary" disabled={!canPublish} onClick={handlePublish}>
            {submitting ? "Publishing…" : "Publish"}
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
            {job ? (
              <input type="text" value={job.company} disabled />
            ) : (
              <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company name" />
            )}
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
