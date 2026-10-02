import { useState } from "react";
import { Link } from "react-router-dom";
import { useLibrary } from "../data/useLibrary.js";
import {
  createLibraryResource,
  updateLibraryResource,
  deleteLibraryResource,
  createLearningTrack,
  updateLearningTrack,
  deleteLearningTrack,
} from "../data/librarySync.js";
import { CATEGORIES, SKILL_CATEGORIES, RESOURCE_FORMATS, STEP_TYPES } from "../data/libraryCategories.js";
import "../styles/jobDetail.css";
import "../styles/admin.css";

const EMPTY_RESOURCE = { title: "", category: CATEGORIES[0], format: RESOURCE_FORMATS[0], description: "", sectionsText: "", linkUrl: "", notes: "", author: "" };
const EMPTY_STEP = { title: "", type: STEP_TYPES[0], detail: "", url: "", hours: "" };
const EMPTY_TRACK = { title: "", category: SKILL_CATEGORIES[0], summary: "", steps: [{ ...EMPTY_STEP }] };

// Real admin management for Career Resources' library and learning tracks
// (library_resources / learning_tracks) -- replaces the static
// data/mockResources.js lists. Uploading the actual guide file (PDF /
// slides / spreadsheet) for a resource is done from that resource's own
// page, where admins see an upload control.
export default function AdminLibrary() {
  const { resources, tracks, loading, error: loadError, reload } = useLibrary();
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [resourceForm, setResourceForm] = useState(EMPTY_RESOURCE);
  const [editingResourceId, setEditingResourceId] = useState(null);
  const [trackForm, setTrackForm] = useState(EMPTY_TRACK);
  const [editingTrackId, setEditingTrackId] = useState(null);

  async function run(action) {
    setError(null);
    setSaving(true);
    try {
      await action();
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function startEditResource(r) {
    setEditingResourceId(r.id);
    setResourceForm({
      title: r.title,
      category: r.category,
      format: r.format,
      description: r.description,
      sectionsText: r.sections.join("\n"),
      linkUrl: r.linkUrl ?? "",
      notes: r.notes ?? "",
      author: r.author ?? "",
    });
  }

  function cancelResource() {
    setEditingResourceId(null);
    setResourceForm(EMPTY_RESOURCE);
  }

  function saveResource() {
    if (!resourceForm.title.trim()) {
      setError("A title is required.");
      return;
    }
    const input = {
      ...resourceForm,
      sections: resourceForm.sectionsText.split("\n").map((l) => l.trim()).filter(Boolean),
    };
    run(async () => {
      if (editingResourceId) await updateLibraryResource(editingResourceId, input);
      else await createLibraryResource(input);
      cancelResource();
    });
  }

  function removeResource(r) {
    if (!window.confirm(`Delete "${r.title}" for every member? This can't be undone.`)) return;
    run(() => deleteLibraryResource(r.id));
  }

  function startEditTrack(t) {
    setEditingTrackId(t.id);
    setTrackForm({
      title: t.title,
      category: t.category,
      summary: t.summary,
      steps: t.steps.length
        ? t.steps.map((s) => ({ title: s.title, type: s.type, detail: s.detail ?? "", url: s.url ?? "", hours: s.hours ?? "" }))
        : [{ ...EMPTY_STEP }],
    });
  }

  function cancelTrack() {
    setEditingTrackId(null);
    setTrackForm(EMPTY_TRACK);
  }

  function setStep(i, patch) {
    setTrackForm({ ...trackForm, steps: trackForm.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  }

  function saveTrack() {
    const steps = trackForm.steps.filter((s) => s.title.trim());
    if (!trackForm.title.trim() || steps.length === 0) {
      setError("A track needs a title and at least one step with a title.");
      return;
    }
    run(async () => {
      if (editingTrackId) await updateLearningTrack(editingTrackId, { ...trackForm, steps });
      else await createLearningTrack({ ...trackForm, steps });
      cancelTrack();
    });
  }

  function removeTrack(t) {
    if (!window.confirm(`Delete the track "${t.title}" for every member? Members' progress on it is lost.`)) return;
    run(() => deleteLearningTrack(t.id));
  }

  return (
    <div>
      <h1>Library</h1>
      <p className="meta">
        Manage what members see on Career Resources: guides, templates and decks, plus step-by-step learning tracks. To attach the
        actual PDF or slideshow, open a resource and use the admin upload link on its page.
      </p>
      {(error || loadError) && (
        <p className="meta" style={{ color: "var(--color-danger)" }}>
          {error || `Couldn't load the library (${loadError}).`}
        </p>
      )}

      <div className="detail-section">
        <p style={{ fontWeight: 700 }}>{editingResourceId ? "Edit resource" : "Add a resource"}</p>
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <div className="field" style={{ flex: "2 1 260px" }}>
            <label>Title</label>
            <input type="text" value={resourceForm.title} onChange={(e) => setResourceForm({ ...resourceForm, title: e.target.value })} />
          </div>
          <div className="field" style={{ flex: "1 1 180px" }}>
            <label>Category</label>
            <select value={resourceForm.category} onChange={(e) => setResourceForm({ ...resourceForm, category: e.target.value })}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: "1 1 140px" }}>
            <label>Format</label>
            <select value={resourceForm.format} onChange={(e) => setResourceForm({ ...resourceForm, format: e.target.value })}>
              {RESOURCE_FORMATS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Description</label>
          <textarea rows={2} value={resourceForm.description} onChange={(e) => setResourceForm({ ...resourceForm, description: e.target.value })} />
        </div>
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <div className="field" style={{ flex: "1 1 260px" }}>
            <label>Checklist sections (one per line, optional)</label>
            <textarea rows={4} value={resourceForm.sectionsText} onChange={(e) => setResourceForm({ ...resourceForm, sectionsText: e.target.value })} />
          </div>
          <div style={{ flex: "1 1 260px" }}>
            <div className="field">
              <label>External link (optional)</label>
              <input type="url" placeholder="https://…" value={resourceForm.linkUrl} onChange={(e) => setResourceForm({ ...resourceForm, linkUrl: e.target.value })} />
            </div>
            <div className="field">
              <label>Added by (optional)</label>
              <input type="text" value={resourceForm.author} onChange={(e) => setResourceForm({ ...resourceForm, author: e.target.value })} />
            </div>
          </div>
        </div>
        <div className="field">
          <label>UC-specific notes (optional)</label>
          <textarea rows={2} value={resourceForm.notes} onChange={(e) => setResourceForm({ ...resourceForm, notes: e.target.value })} />
        </div>
        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          <button className="btn btn-primary" onClick={saveResource} disabled={saving}>
            {saving ? "Saving…" : editingResourceId ? "Save" : "Add resource"}
          </button>
          {editingResourceId && (
            <button className="btn btn-secondary" onClick={cancelResource}>
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="detail-section">
        <p style={{ fontWeight: 700 }}>Resources ({resources.length})</p>
        {loading && <p className="meta">Loading…</p>}
        {!loading && resources.length === 0 && <p className="meta">Nothing yet — add the first resource above.</p>}
        {resources.map((r) => (
          <div className="step-row" key={r.id}>
            <div className="step-row__body">
              <div className="step-row__title">{r.title}</div>
              <div className="step-row__detail meta">
                {r.category} · {r.format} · updated {r.updated}
              </div>
            </div>
            <div className="step-row__state" style={{ display: "flex", gap: "var(--space-3)" }}>
              <Link to={`/resources/${r.id}`} className="btn btn-secondary">
                Open / upload file
              </Link>
              <button className="btn-link" onClick={() => startEditResource(r)}>
                Edit
              </button>
              <button className="btn-link" onClick={() => removeResource(r)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="detail-section">
        <p style={{ fontWeight: 700 }}>{editingTrackId ? "Edit learning track" : "Add a learning track"}</p>
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <div className="field" style={{ flex: "2 1 260px" }}>
            <label>Title</label>
            <input type="text" value={trackForm.title} onChange={(e) => setTrackForm({ ...trackForm, title: e.target.value })} />
          </div>
          <div className="field" style={{ flex: "1 1 200px" }}>
            <label>Category</label>
            <select value={trackForm.category} onChange={(e) => setTrackForm({ ...trackForm, category: e.target.value })}>
              {[...CATEGORIES, ...SKILL_CATEGORIES].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label>One-line summary</label>
          <input type="text" value={trackForm.summary} onChange={(e) => setTrackForm({ ...trackForm, summary: e.target.value })} />
        </div>
        <p style={{ fontWeight: 700, marginBottom: "var(--space-2)" }}>Steps (done in order)</p>
        {trackForm.steps.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "var(--space-3)" }}>
            <div className="field" style={{ flex: "2 1 200px" }}>
              <label>Step {i + 1} title</label>
              <input type="text" value={s.title} onChange={(e) => setStep(i, { title: e.target.value })} />
            </div>
            <div className="field" style={{ flex: "1 1 120px" }}>
              <label>Type</label>
              <select value={s.type} onChange={(e) => setStep(i, { type: e.target.value })}>
                {STEP_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ flex: "2 1 180px" }}>
              <label>Detail</label>
              <input type="text" value={s.detail} onChange={(e) => setStep(i, { detail: e.target.value })} />
            </div>
            <div className="field" style={{ flex: "2 1 200px" }}>
              <label>Link (optional)</label>
              <input type="url" placeholder="https://…" value={s.url} onChange={(e) => setStep(i, { url: e.target.value })} />
            </div>
            <div className="field" style={{ width: 80 }}>
              <label>Hours</label>
              <input type="number" min="0" step="0.5" value={s.hours} onChange={(e) => setStep(i, { hours: e.target.value })} />
            </div>
            <button
              type="button"
              className="btn-link"
              disabled={trackForm.steps.length === 1}
              onClick={() => setTrackForm({ ...trackForm, steps: trackForm.steps.filter((_, j) => j !== i) })}
            >
              Remove
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-secondary" onClick={() => setTrackForm({ ...trackForm, steps: [...trackForm.steps, { ...EMPTY_STEP }] })}>
          + Add step
        </button>
        <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
          <button className="btn btn-primary" onClick={saveTrack} disabled={saving}>
            {saving ? "Saving…" : editingTrackId ? "Save track" : "Add track"}
          </button>
          {editingTrackId && (
            <button className="btn btn-secondary" onClick={cancelTrack}>
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="detail-section">
        <p style={{ fontWeight: 700 }}>Learning tracks ({tracks.length})</p>
        {!loading && tracks.length === 0 && <p className="meta">No tracks yet.</p>}
        {tracks.map((t) => (
          <div className="step-row" key={t.id}>
            <div className="step-row__body">
              <div className="step-row__title">{t.title}</div>
              <div className="step-row__detail meta">
                {t.category} · {t.steps.length} step{t.steps.length === 1 ? "" : "s"}
              </div>
            </div>
            <div className="step-row__state" style={{ display: "flex", gap: "var(--space-3)" }}>
              <button className="btn-link" onClick={() => startEditTrack(t)}>
                Edit
              </button>
              <button className="btn-link" onClick={() => removeTrack(t)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
