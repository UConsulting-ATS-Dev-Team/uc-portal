import { useEffect, useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { addSuppression, deleteContact, fetchContacts, fetchSuppressions, importContacts, removeSuppression } from "../../data/commsSync.js";
import { parseContactList } from "../../supabase/functions/_shared/comms/importParse.ts";
import Modal from "../Modal.jsx";
import "../../styles/comms.css";

const REASON_LABEL = { unsubscribed: "Unsubscribed", bounced: "Bounced", complained: "Marked as spam", manual: "Added by an admin" };

function ImportModal({ onClose, onDone }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const parsed = useMemo(() => parseContactList(text), [text]);

  async function readFile(e) {
    const file = e.target.files?.[0];
    if (file) setText(await file.text());
    e.target.value = "";
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      setResult(await importContacts(parsed.rows));
      await onDone();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <Modal
      title="Import contacts"
      onClose={onClose}
      width={680}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            {result ? "Done" : "Cancel"}
          </button>
          {!result && (
            <button className="btn btn-primary" onClick={save} disabled={busy || parsed.rows.length === 0}>
              {busy ? "Importing…" : `Import ${parsed.rows.length} contact${parsed.rows.length === 1 ? "" : "s"}`}
            </button>
          )}
        </>
      }
    >
      {error && <p className="meta" style={{ color: "var(--color-danger)", marginTop: 0 }}>{error}</p>}
      {result ? (
        <p style={{ marginTop: 0 }}>
          Added {result.added}, updated {result.updated}, already on the list {result.skipped}.
        </p>
      ) : (
        <>
          <p className="meta" style={{ marginTop: 0 }}>
            One person per line: email, name, tags (separate several tags with | ). A header row works too. Anyone who has unsubscribed stays unsubscribed.
          </p>
          <div className="field">
            <label htmlFor="ml-text">Contacts</label>
            <textarea id="ml-text" rows={9} value={text} onChange={(e) => setText(e.target.value)} placeholder={"email,name,tags\npat@example.com,Pat Example,alumni|speaker series"} />
          </div>
          <label className="btn btn-secondary" style={{ cursor: "pointer" }}>
            <Upload size={14} strokeWidth={1.5} aria-hidden="true" /> Choose a CSV file
            <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={readFile} style={{ display: "none" }} />
          </label>
          {text.trim() && (
            <p className="meta" style={{ marginBottom: 0 }}>
              {parsed.rows.length} valid{parsed.duplicates ? `, ${parsed.duplicates} repeated in this list` : ""}
              {parsed.problems.length ? `, ${parsed.problems.length} with a problem` : ""}.
            </p>
          )}
          {parsed.problems.length > 0 && (
            <ul className="recipient-list recipient-list--compact">
              {parsed.problems.slice(0, 20).map((p) => (
                <li key={p.line}>
                  <span>Line {p.line}: {p.text}</span>
                  <span className="meta comms-fail">{p.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Modal>
  );
}

// People who aren't portal members but an admin chose to be able to email (alumni who never signed up, speakers, partners). The
// alumni directory is never mailed automatically: its addresses have to be imported here on purpose.
export function MailingListTab({ onChanged }) {
  const [contacts, setContacts] = useState(null);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [filter, setFilter] = useState("");

  const load = () =>
    fetchContacts()
      .then(setContacts)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  async function remove(c) {
    if (!window.confirm(`Remove ${c.email} from the mailing list?`)) return;
    try {
      await deleteContact(c.id);
      await load();
      onChanged?.();
    } catch (e) {
      setError(e.message);
    }
  }

  const visible = (contacts ?? []).filter((c) => {
    const q = filter.trim().toLowerCase();
    return !q || c.email.includes(q) || (c.name ?? "").toLowerCase().includes(q) || (c.tags ?? []).some((t) => t.toLowerCase().includes(q));
  });

  return (
    <div>
      <div className="comms-toolbar">
        <input type="search" aria-label="Search the mailing list" placeholder="Search by name, email or tag" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <span className="meta">{contacts ? `${contacts.length} contact${contacts.length === 1 ? "" : "s"}` : ""}</span>
        <button className="btn btn-primary" onClick={() => setImporting(true)}>
          <Upload size={14} strokeWidth={1.5} aria-hidden="true" /> Import contacts
        </button>
      </div>
      {error && <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>}
      {contacts === null && <p className="meta">Loading…</p>}
      {contacts?.length === 0 && <p className="meta">The mailing list is empty. Import people who don't have a portal account.</p>}
      <ul className="comms-list">
        {visible.slice(0, 500).map((c) => (
          <li key={c.id}>
            <div className="comms-list__main">
              <strong>{c.name || c.email}</strong>
              {!c.subscribed && <span className="accel-tag accel-tag--flag">Unsubscribed</span>}
              {(c.tags ?? []).map((t) => (
                <span className="chip" key={t}>
                  {t}
                </span>
              ))}
              <div className="meta">{c.name ? c.email : ""}</div>
            </div>
            <div className="comms-list__actions">
              <button className="btn-link" onClick={() => remove(c)}>
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      {visible.length > 500 && <p className="meta">Showing the first 500.</p>}
      {importing && <ImportModal onClose={() => setImporting(false)} onDone={async () => { await load(); onChanged?.(); }} />}
    </div>
  );
}

// Addresses that will never be emailed. Unsubscribe links add to this automatically; an admin can add or remove one.
export function UnsubscribesTab({ onChanged }) {
  const [rows, setRows] = useState(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);

  const load = () =>
    fetchSuppressions()
      .then(setRows)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!email.includes("@")) return setError("Enter a valid email address.");
    try {
      await addSuppression(email);
      setEmail("");
      setError(null);
      await load();
      onChanged?.();
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove(row) {
    if (!window.confirm(`Let ${row.email} be emailed again? Only do this if they asked to be back on the list.`)) return;
    try {
      await removeSuppression(row.email);
      await load();
      onChanged?.();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <div className="comms-toolbar">
        <input type="text" aria-label="Email to stop messaging" placeholder="Email address to stop messaging" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="btn btn-secondary" onClick={add}>
          Add
        </button>
      </div>
      {error && <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>}
      {rows === null && <p className="meta">Loading…</p>}
      {rows?.length === 0 && <p className="meta">Nobody has unsubscribed.</p>}
      <ul className="comms-list">
        {rows?.map((r) => (
          <li key={r.email}>
            <div className="comms-list__main">
              <strong>{r.email}</strong>
              <span className="chip">{REASON_LABEL[r.reason]}</span>
              <div className="meta">{new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</div>
            </div>
            <div className="comms-list__actions">
              <button className="btn-link" onClick={() => remove(r)}>
                Allow emails again
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
