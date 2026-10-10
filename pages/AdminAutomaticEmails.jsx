import { useEffect, useState } from "react";
import { AUTO_EMAILS, effectiveCopy } from "../supabase/functions/_shared/comms/autoEmails.ts";
import { MERGE_FIELDS, fillMergeFields, mergeVarsFor, unknownMergeFields } from "../supabase/functions/_shared/comms/render.ts";
import { fetchAutoEmailSettings, fetchProviderStatus, saveAutoEmailSetting, sendCommunication } from "../data/commsSync.js";
import { supabase } from "../data/supabaseClient.js";
import Modal from "../components/Modal.jsx";
import MessageEditor from "../components/comms/MessageEditor.jsx";
import "../styles/jobDetail.css";
import "../styles/comms.css";

function EditModal({ def, setting, onClose, onSaved }) {
  const copy = effectiveCopy(def, setting);
  const [subject, setSubject] = useState(copy.subject);
  const [body, setBody] = useState(copy.body);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const allowed = [...MERGE_FIELDS, ...def.fields];

  async function save(reset = false) {
    const unknown = unknownMergeFields(`${subject}\n${body}`, allowed);
    if (!reset && unknown.length) return setError(`{{${unknown[0]}}} isn't a field this email can use.`);
    if (!reset && (!subject.trim() || !body.trim())) return setError("The subject and message can't be empty.");
    setSaving(true);
    try {
      await saveAutoEmailSetting({ key: def.key, enabled: setting?.enabled ?? false, subject: reset ? null : subject, body: reset ? null : body });
      await onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  return (
    <Modal
      title={`Edit: ${def.label}`}
      onClose={onClose}
      width={720}
      footer={
        <>
          <button className="btn-link" style={{ marginRight: "auto" }} onClick={() => save(true)} disabled={saving}>
            Reset to the original wording
          </button>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => save(false)} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      {error && <p className="meta" style={{ color: "var(--color-danger)", marginTop: 0 }}>{error}</p>}
      <div className="field">
        <label htmlFor="ae-subject">Subject</label>
        <input id="ae-subject" type="text" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <MessageEditor value={body} onChange={setBody} channel="email" subject={subject} fields={allowed} sampleVars={def.sample} />
    </Modal>
  );
}

// Emails the portal sends by itself. Each is off until an admin turns it on here, and each can be reworded. Nothing goes out
// while email isn't connected, and switching one on never sends a backlog: the daily run only looks at what is due now.
export default function AdminAutomaticEmails() {
  const [settings, setSettings] = useState(new Map());
  const [status, setStatus] = useState(null);
  const [editing, setEditing] = useState(null);
  const [confirmOn, setConfirmOn] = useState(null);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const [own, setOwn] = useState(null);

  const load = () =>
    fetchAutoEmailSettings()
      .then(setSettings)
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
    fetchProviderStatus()
      .then(setStatus)
      .catch(() => setStatus({ email: { configured: false }, unsubscribeSecretSet: false }));
    supabase.auth.getUser().then(({ data }) => setOwn(data.user?.email ?? null));
  }, []);

  const connected = Boolean(status?.email?.configured && status?.unsubscribeSecretSet);

  async function toggle(def, enabled) {
    const current = settings.get(def.key);
    try {
      await saveAutoEmailSetting({ key: def.key, enabled, subject: current?.subject ?? null, body: current?.body ?? null });
      await load();
      setConfirmOn(null);
    } catch (e) {
      setError(e.message);
    }
  }

  async function sendTest(def) {
    const copy = effectiveCopy(def, settings.get(def.key));
    const vars = { ...mergeVarsFor({ name: "Pat Example", email: own }), ...def.sample };
    setNotice(null);
    try {
      const result = await sendCommunication({ action: "test", channel: "email", subject: fillMergeFields(copy.subject, vars), body: fillMergeFields(copy.body, vars), audience: { match: "all", groups: [] } });
      setNotice({ kind: "ok", text: result.failed ? "The test didn't go through. See Master communications, Logs." : `Test of "${def.label}" sent to ${own}, with sample details.` });
    } catch (e) {
      setNotice({ kind: "error", text: e.code === "email_not_configured" ? "Email isn't connected yet." : e.message });
    }
  }

  return (
    <div>
      <div className="jobs-header" style={{ marginBottom: "var(--space-5)" }}>
        <div>
          <h1>Automatic emails</h1>
        </div>
      </div>

      {status && !connected && (
        <div className="comms-banner" role="status">
          <strong>Email isn't connected yet.</strong> You can reword these and switch them on now; nothing goes out until the email account is connected, and test emails switch on then too.
        </div>
      )}
      {error && <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>}
      {notice && <p className="comms-notice" style={{ color: notice.kind === "error" ? "var(--color-danger)" : "var(--color-text)" }}>{notice.text}</p>}

      <ul className="comms-list" style={{ maxWidth: 980 }}>
        {AUTO_EMAILS.map((def) => {
          const setting = settings.get(def.key);
          const copy = effectiveCopy(def, setting);
          const on = Boolean(setting?.enabled);
          return (
            <li key={def.key} className="comms-list__block">
              <div className="comms-list__row">
                <div className="comms-list__main">
                  <strong>{def.label}</strong>
                  <span className={on ? "accel-tag accel-tag--good" : "accel-tag accel-tag--optional"}>{on ? "On" : "Off"}</span>
                  {setting?.subject || setting?.body ? <span className="chip">Reworded</span> : null}
                  <div className="meta">{def.description}</div>
                  <div className="meta">When: {def.when}. Who: {def.who}.</div>
                  <div className="meta">Subject: {copy.subject}</div>
                </div>
                <div className="comms-list__actions">
                  <button className="btn btn-secondary" onClick={() => setEditing(def)}>
                    Edit wording
                  </button>
                  <button className="btn btn-secondary" disabled={!connected} title={!connected ? "Email isn't connected yet." : undefined} onClick={() => sendTest(def)}>
                    Send me a test
                  </button>
                  <button className={on ? "btn btn-secondary" : "btn btn-primary"} onClick={() => (on ? toggle(def, false) : setConfirmOn(def))}>
                    {on ? "Turn off" : "Turn on"}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {editing && <EditModal def={editing} setting={settings.get(editing.key)} onClose={() => setEditing(null)} onSaved={load} />}
      {confirmOn && (
        <Modal
          title={`Turn on "${confirmOn.label}"?`}
          onClose={() => setConfirmOn(null)}
          width={480}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setConfirmOn(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={() => toggle(confirmOn, true)}>
                Turn on
              </button>
            </>
          }
        >
          <p style={{ marginTop: 0 }}>The portal will send this email on its own. You can turn it off any time.</p>
          <dl className="confirm-facts">
            <div>
              <dt>Who</dt>
              <dd>{confirmOn.who}</dd>
            </div>
            <div>
              <dt>When</dt>
              <dd>{confirmOn.when}</dd>
            </div>
          </dl>
        </Modal>
      )}
    </div>
  );
}
