import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { deleteDraft, deleteTemplate, fetchDrafts, fetchTemplates, saveTemplate } from "../../data/commsSync.js";
import { describeAudience } from "../../supabase/functions/_shared/comms/audience.ts";
import { previewLine, unknownMergeFields } from "../../supabase/functions/_shared/comms/render.ts";
import Modal from "../Modal.jsx";
import MessageEditor from "./MessageEditor.jsx";
import "../../styles/comms.css";

const CHANNEL_LABEL = { email: "Email", slack: "Slack", imessage: "iMessage" };
const when = (iso) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// Saved works in progress. Opening one puts it back in the composer for its channel.
export function DraftsTab({ onOpen, refreshKey }) {
  const [drafts, setDrafts] = useState(null);
  const [error, setError] = useState(null);

  const load = () =>
    fetchDrafts()
      .then(setDrafts)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, [refreshKey]);

  async function remove(draft) {
    if (!window.confirm(`Delete the draft "${draft.name}"?`)) return;
    try {
      await deleteDraft(draft.id);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      {error && <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>}
      {drafts === null && <p className="meta">Loading…</p>}
      {drafts?.length === 0 && <p className="meta">No drafts yet. Write a message in the Email, Slack or iMessage tab and use Save draft.</p>}
      <ul className="comms-list">
        {drafts?.map((d) => (
          <li key={d.id}>
            <div className="comms-list__main">
              <strong>{d.name}</strong>
              <span className="chip">{CHANNEL_LABEL[d.channel]}</span>
              <div className="meta">
                {d.subject ? `${d.subject} · ` : ""}
                {describeAudience(d.audience)} · saved {when(d.updated_at)}
              </div>
              <div className="meta">{previewLine(d.body)}</div>
            </div>
            <div className="comms-list__actions">
              <button className="btn btn-secondary" onClick={() => onOpen(d)}>
                Open
              </button>
              <button className="btn-link" onClick={() => remove(d)}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TemplateModal({ editing, onClose, onSaved }) {
  const [form, setForm] = useState({ id: editing?.id ?? null, name: editing?.name ?? "", channel: editing?.channel ?? "email", subject: editing?.subject ?? "", body: editing?.body ?? "" });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const unknown = unknownMergeFields(`${form.subject}\n${form.body}`);

  async function save() {
    if (!form.name.trim()) return setError("Name the template.");
    if (!form.body.trim()) return setError("Write the message.");
    if (unknown.length) return setError(`{{${unknown[0]}}} isn't a field we can fill in.`);
    setSaving(true);
    try {
      await saveTemplate(form);
      await onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  return (
    <Modal
      title={editing ? "Edit template" : "New template"}
      onClose={onClose}
      width={720}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save template"}
          </button>
        </>
      }
    >
      {error && <p className="meta" style={{ color: "var(--color-danger)", marginTop: 0 }}>{error}</p>}
      <div className="field-row">
        <div className="field" style={{ flex: 2 }}>
          <label htmlFor="tpl-name">Name</label>
          <input id="tpl-name" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="tpl-channel">Channel</label>
          <select id="tpl-channel" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
            {Object.entries(CHANNEL_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>
      {form.channel === "email" && (
        <div className="field">
          <label htmlFor="tpl-subject">Subject</label>
          <input id="tpl-subject" type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
        </div>
      )}
      <MessageEditor value={form.body} onChange={(body) => setForm({ ...form, body })} channel={form.channel} subject={form.subject} />
    </Modal>
  );
}

// Reusable wording. "Use template" in a composer copies it in; editing a template never changes messages already sent.
export function TemplatesTab({ onUse }) {
  const [templates, setTemplates] = useState(null);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // null | { editing }

  const load = () =>
    fetchTemplates()
      .then(setTemplates)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  async function remove(t) {
    if (!window.confirm(`Delete the template "${t.name}"?`)) return;
    try {
      await deleteTemplate(t.id);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <div className="comms-toolbar">
        <button className="btn btn-primary" onClick={() => setModal({ editing: null })}>
          <Plus size={14} strokeWidth={1.5} aria-hidden="true" /> New template
        </button>
      </div>
      {error && <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>}
      {templates === null && <p className="meta">Loading…</p>}
      {templates?.length === 0 && <p className="meta">No templates yet.</p>}
      <ul className="comms-list">
        {templates?.map((t) => (
          <li key={t.id}>
            <div className="comms-list__main">
              <strong>{t.name}</strong>
              <span className="chip">{CHANNEL_LABEL[t.channel]}</span>
              {t.subject && <div className="meta">{t.subject}</div>}
              <div className="meta">{previewLine(t.body)}</div>
            </div>
            <div className="comms-list__actions">
              <button className="btn btn-secondary" onClick={() => onUse(t)}>
                Use
              </button>
              <button className="btn-link" onClick={() => setModal({ editing: t })}>
                Edit
              </button>
              <button className="btn-link" onClick={() => remove(t)}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
      {modal && <TemplateModal editing={modal.editing} onClose={() => setModal(null)} onSaved={load} />}
    </div>
  );
}
