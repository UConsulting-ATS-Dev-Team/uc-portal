import { useState } from "react";
import Modal from "../Modal.jsx";
import { supabase } from "../../data/supabaseClient.js";
import { currentUser } from "../../data/mockUser.js";
import { useAppState } from "../../data/store.jsx";
import { displayName } from "../../data/profileUtils.js";
import "../../styles/onboarding.css";

const CATEGORIES = ["Jobs & search", "Applications tracker", "Network & messaging", "Career resources", "Admin tools", "Other"];

// Writes a real row to feature_requests -- submitted_by is the signed-in
// member's real auth id (so RLS lets them see their own request later);
// submitted_by_name uses displayName(), which prefers the member's own
// real profileOverrides.fullName and only falls back to mockUser.js's
// fake "Test Account" name when genuinely unset -- found live (2026-09-24)
// this used to read currentUser.firstName/lastName directly, meaning a
// real member's real submission would get permanently attributed to
// "Test Account" in the admin queue unless they'd already set their name
// on My Profile. Unlike the company-demand aggregate or
// member_preferences, this is deliberately not anonymized -- the entire
// point (per the admin side of this feature) is that an admin sees
// exactly who asked for what, so getting the real name right matters.
export default function RequestFeatureModal({ onClose }) {
  const { profileOverrides } = useAppState();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("feature_requests").insert({
      submitted_by: user.id,
      submitted_by_name: displayName(currentUser, profileOverrides),
      title: title.trim(),
      description: description.trim(),
      category,
    });

    setSubmitting(false);
    if (error) {
      setSubmitError(error.message);
      return;
    }
    setSubmitted(true);
    setTimeout(onClose, 1200);
  }

  const canSubmit = title.trim() && description.trim() && !submitting;

  return (
    <Modal
      title="Request a feature"
      onClose={onClose}
      width={560}
      footer={
        submitted ? (
          <span className="modal__footer-note">Sent to Exec for review.</span>
        ) : (
          <>
            <span className="modal__footer-note">
              {submitError ? <span style={{ color: "#B3261E" }}>{submitError}</span> : "Admins can see and track every request."}
            </span>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!canSubmit} onClick={handleSubmit}>
              {submitting ? "Submitting…" : "Submit request"}
            </button>
          </>
        )
      }
    >
      <label className="field-label">What would help?</label>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Let me filter jobs by comp range"
      />

      <label className="field-label">Category</label>
      <div className="chip-row">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            className={`chip-toggle${category === c ? " is-selected" : ""}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <label className="field-label">Details</label>
      <textarea
        rows={4}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What's the problem this would solve, or what would it let you do?"
      />
    </Modal>
  );
}
