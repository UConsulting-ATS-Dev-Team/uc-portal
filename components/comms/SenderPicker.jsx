import { useEffect, useRef, useState } from "react";
import { deleteSenderPreset, fetchSenderPresets, saveSenderPreset, setDefaultSenderPreset } from "../../data/commsSync.js";
import Modal from "../Modal.jsx";
import "../../styles/comms.css";

// "Send as" for email: the name recipients see and where their replies go. The address it is sent from is the club's one verified
// address and doesn't change. Choosing none uses the account-wide defaults.
export default function SenderPicker({ value, onChange, fromEmail }) {
  const [presets, setPresets] = useState([]);
  const [managing, setManaging] = useState(false);
  const startedWithDefault = useRef(false);

  const load = () =>
    fetchSenderPresets()
      .then(setPresets)
      .catch(() => {});
  useEffect(() => {
    load();
  }, []);

  // Start on the default sender, once, unless a draft or the admin already chose something.
  useEffect(() => {
    if (startedWithDefault.current || presets.length === 0) return;
    startedWithDefault.current = true;
    const fallback = presets.find((p) => p.is_default);
    if (!value && fallback) onChange(fallback.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presets]);

  // A preset that was deleted can't stay selected.
  useEffect(() => {
    if (value && presets.length > 0 && !presets.some((p) => p.id === value)) onChange("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presets]);

  const chosen = presets.find((p) => p.id === value);

  return (
    <div className="field">
      <label htmlFor="comp-sender">Send as</label>
      <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
        <select id="comp-sender" value={value} onChange={(e) => onChange(e.target.value)} style={{ maxWidth: 320 }}>
          <option value="">Account default</option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button type="button" className="btn-link" onClick={() => setManaging(true)}>
          Manage senders
        </button>
      </div>
      <p className="meta" style={{ margin: "var(--space-2) 0 0" }}>
        {chosen ? `From ${chosen.from_name}${fromEmail ? ` <${fromEmail}>` : ""}${chosen.reply_to ? `, replies to ${chosen.reply_to}` : ""}.` : "Uses the name and reply address set for the email account."}
      </p>
      {managing && <ManageModal presets={presets} onClose={() => setManaging(false)} onChanged={load} />}
    </div>
  );
}

function ManageModal({ presets, onClose, onChanged }) {
  const [form, setForm] = useState({ name: "", fromName: "", replyTo: "", isDefault: false });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function add() {
    if (!form.name.trim() || !form.fromName.trim()) return setError("Give the sender a label and the name recipients should see.");
    if (form.replyTo.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.replyTo.trim())) return setError("The reply address isn't a valid email address.");
    setBusy(true);
    setError(null);
    try {
      await saveSenderPreset(form);
      setForm({ name: "", fromName: "", replyTo: "", isDefault: false });
      await onChanged();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await onChanged();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  return (
    <Modal title="Senders" onClose={onClose} width={620} footer={<button className="btn btn-secondary" onClick={onClose}>Done</button>}>
      <p className="meta" style={{ marginTop: 0 }}>
        A sender is the name recipients see and the address their replies go to. Every email still goes out from the club's one email address.
      </p>
      {error && <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>}
      {presets.length === 0 && <p className="meta">No senders yet.</p>}
      <ul className="comms-list">
        {presets.map((p) => (
          <li key={p.id}>
            <div className="comms-list__main">
              <strong>{p.name}</strong>
              {p.is_default && <span className="chip chip-accent">Default</span>}
              <div className="meta">
                {p.from_name}
                {p.reply_to ? ` · replies to ${p.reply_to}` : ""}
              </div>
            </div>
            <div className="comms-list__actions">
              {!p.is_default && (
                <button className="btn-link" disabled={busy} onClick={() => run(() => setDefaultSenderPreset(p.id))}>
                  Make default
                </button>
              )}
              {p.is_default && (
                <button className="btn-link" disabled={busy} onClick={() => run(() => setDefaultSenderPreset(null))}>
                  Clear default
                </button>
              )}
              <button
                className="btn-link"
                disabled={busy}
                onClick={() => window.confirm(`Delete the sender "${p.name}"? Messages already sent keep it.`) && run(() => deleteSenderPreset(p.id))}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
      <h3 style={{ margin: "var(--space-6) 0 var(--space-3)" }}>Add a sender</h3>
      <div className="field">
        <label htmlFor="sp-name">Label (only you see this)</label>
        <input id="sp-name" type="text" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Careers committee" />
      </div>
      <div className="field">
        <label htmlFor="sp-from">Name recipients see</label>
        <input id="sp-from" type="text" value={form.fromName} onChange={(e) => set({ fromName: e.target.value })} placeholder="UConsulting Careers" />
      </div>
      <div className="field">
        <label htmlFor="sp-reply">Replies go to (optional)</label>
        <input id="sp-reply" type="email" value={form.replyTo} onChange={(e) => set({ replyTo: e.target.value })} placeholder="careers@example.org" />
      </div>
      <label style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", marginBottom: "var(--space-4)" }}>
        <input type="checkbox" checked={form.isDefault} onChange={(e) => set({ isDefault: e.target.checked })} /> Use this sender by default
      </label>
      <button className="btn btn-primary" onClick={add} disabled={busy}>
        Add sender
      </button>
    </Modal>
  );
}
