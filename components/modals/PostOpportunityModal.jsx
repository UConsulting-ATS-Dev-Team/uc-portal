import { useState } from "react";
import Modal from "../Modal.jsx";
import { INDUSTRIES, LOCATIONS } from "../../data/careerOptions.js";
import { supabase } from "../../data/supabaseClient.js";
import "../../styles/onboarding.css";

// "Off-cycle / rolling" was dropped from this list -- it described deadline
// behavior, not an employment type, and didn't map to a real value in the
// jobs table's employment_type enum (internship/full_time/...). A rolling
// position is just one with no application_deadline set.
const TYPES = ["Internship", "Full-time"];
const WORK_MODES = ["Remote", "Hybrid", "In-person"];
const CLASS_YEARS = ["2026", "2027", "2028", "2029"];

// This modal writes a real row to opportunity_submissions (Stage 2) --
// submitted_by is the signed-in member's real auth id, raw_payload keeps
// every field exactly as entered (never auto-scraped, per the source
// governance compliance note in JOB_ENGINE_ARCHITECTURE.md Part 2), and
// company/role are pulled out to their own columns for the admin queue to
// display without parsing JSON. The modal is reused by both Jobs' "Post a
// job" (member-facing) and Admin's "+ Post opportunity" -- both funnel into
// the same review queue.
export default function PostOpportunityModal({ onClose }) {
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [type, setType] = useState(TYPES[0]);
  const [classYears, setClassYears] = useState([]);
  const [location, setLocation] = useState("");
  const [workMode, setWorkMode] = useState(WORK_MODES[0]);
  const [comp, setComp] = useState("");
  const [deadline, setDeadline] = useState("");
  const [link, setLink] = useState("");
  const [description, setDescription] = useState("");
  const [industries, setIndustries] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  function toggle(list, setList, value) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: inserted, error } = await supabase
      .from("opportunity_submissions")
      .insert({
        submitted_by: user.id,
        company,
        role,
        raw_payload: { company, role, type, classYears, location, workMode, comp, deadline, link, description, industries },
      })
      .select("id")
      .single();

    setSubmitting(false);
    if (error) {
      setSubmitError(error.message);
      return;
    }
    setSubmitted(true);
    setTimeout(onClose, 1200);

    // US-09 -- score for duplicates now, not only at Approve time, so the
    // admin queue can show the signal before a human reviews it. Fire-and-
    // forget: this is informational for the queue display (see that
    // function's own header comment for why it doesn't gate anything) and
    // shouldn't hold up the submitter's own confirmation.
    supabase.functions.invoke("score-submission-duplicate", { body: { submissionId: inserted.id } });
  }

  const canSubmit = company.trim() && role.trim() && location.trim() && link.trim() && !submitting;

  return (
    <Modal
      title="Post an opportunity"
      onClose={onClose}
      width={640}
      footer={
        submitted ? (
          <span className="modal__footer-note">Sent to the Exec review queue.</span>
        ) : (
          <>
            <span className="modal__footer-note">
              {submitError ? <span style={{ color: "#B3261E" }}>{submitError}</span> : "Goes to Exec for review before it's live."}
            </span>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!canSubmit} onClick={handleSubmit}>
              {submitting ? "Submitting…" : "Submit for review"}
            </button>
          </>
        )
      }
    >
      <div className="field-row">
        <div>
          <label className="field-label">Company</label>
          <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company name" />
        </div>
        <div>
          <label className="field-label">Role title</label>
          <input type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Strategy Analyst Intern" />
        </div>
      </div>

      <label className="field-label">Open to class years</label>
      <div className="chip-row">
        {CLASS_YEARS.map((y) => (
          <button key={y} type="button" className={`chip-toggle${classYears.includes(y) ? " is-selected" : ""}`} onClick={() => toggle(classYears, setClassYears, y)}>
            {y}
          </button>
        ))}
      </div>

      <div className="field-row">
        <div>
          <label className="field-label">Location</label>
          <input type="text" list="post-opp-locations" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City" />
          <datalist id="post-opp-locations">
            {LOCATIONS.map((l) => <option key={l} value={l} />)}
          </datalist>
        </div>
        <div>
          <label className="field-label">Work mode</label>
          <select value={workMode} onChange={(e) => setWorkMode(e.target.value)}>
            {WORK_MODES.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div className="field-row">
        <div>
          <label className="field-label">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Compensation</label>
          <input type="text" value={comp} onChange={(e) => setComp(e.target.value)} placeholder="$32/hr or $85k/yr" />
        </div>
      </div>

      <div className="field-row">
        <div>
          <label className="field-label">Application deadline</label>
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Application link (required)</label>
          <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" required />
        </div>
      </div>

      <label className="field-label">Industry tags</label>
      <div className="chip-row">
        {INDUSTRIES.filter((i) => i.name !== "Still figuring it out").map((i) => (
          <button key={i.name} type="button" className={`chip-toggle${industries.includes(i.name) ? " is-selected" : ""}`} onClick={() => toggle(industries, setIndustries, i.name)}>
            {i.name}
          </button>
        ))}
      </div>

      <label className="field-label">Description</label>
      <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What the role involves, who it's a fit for..." />
    </Modal>
  );
}
