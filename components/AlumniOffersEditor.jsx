import { useEffect, useState } from "react";
import { AVAILABILITY_OPTIONS, HELP_TOPICS, fetchOwnAlumniOffer, saveOwnAlumniOffer } from "../data/alumniOffers.js";

// The two things an alumnus fills in about how they can help: topics (a checklist) and availability (one choice). Used by the
// alumni first-run flow and by My Profile, so both write the same record the same way.
export default function AlumniOffersEditor({ topics, availability, onChange, idPrefix = "offers" }) {
  const toggle = (topic) => onChange({ topics: topics.includes(topic) ? topics.filter((t) => t !== topic) : [...topics, topic], availability });
  return (
    <div>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="meta" style={{ padding: 0, marginBottom: "var(--space-3)" }}>
          I'm happy to help with
        </legend>
        <div className="chip-row">
          {HELP_TOPICS.map((topic) => (
            <button key={topic} type="button" className={`chip-toggle${topics.includes(topic) ? " is-selected" : ""}`} aria-pressed={topics.includes(topic)} onClick={() => toggle(topic)}>
              {topic}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="field" style={{ marginTop: "var(--space-6)" }}>
        <label htmlFor={`${idPrefix}-availability`}>How available are you?</label>
        <select id={`${idPrefix}-availability`} value={availability} onChange={(e) => onChange({ topics, availability: e.target.value })}>
          <option value="">Not set</option>
          {AVAILABILITY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      <p className="meta" style={{ marginBottom: 0 }}>
        UC members see this on your profile. You can change it any time on My Profile.
      </p>
    </div>
  );
}

// The My Profile version: loads what the alumnus saved before and saves with its own button, so it works beside the rest of the
// page without joining that form's "Save changes".
export function AlumniHelpSection() {
  const [offer, setOffer] = useState({ topics: [], availability: "" });
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    fetchOwnAlumniOffer()
      .then((saved) => saved && setOffer({ topics: saved.helpTopics, availability: saved.availability }))
      .finally(() => setLoaded(true));
  }, []);

  async function save() {
    setStatus({ kind: "saving" });
    try {
      await saveOwnAlumniOffer({ helpTopics: offer.topics, availability: offer.availability });
      setStatus({ kind: "saved" });
    } catch (err) {
      setStatus({ kind: "error", text: err.message });
    }
  }

  return (
    <div className="detail-section">
      <h2 className="detail-section__title">How you can help</h2>
      {!loaded ? (
        <p className="meta">Loading…</p>
      ) : (
        <>
          <AlumniOffersEditor topics={offer.topics} availability={offer.availability} onChange={({ topics, availability }) => { setOffer({ topics, availability }); setStatus(null); }} idPrefix="profile" />
          <div style={{ marginTop: "var(--space-5)", display: "flex", gap: "var(--space-4)", alignItems: "center" }}>
            <button className="btn btn-primary" type="button" onClick={save} disabled={status?.kind === "saving"}>
              {status?.kind === "saving" ? "Saving…" : "Save"}
            </button>
            {status?.kind === "saved" && <span className="meta">Saved</span>}
            {status?.kind === "error" && <span className="meta" style={{ color: "var(--color-danger)" }}>{status.text}</span>}
          </div>
        </>
      )}
    </div>
  );
}
