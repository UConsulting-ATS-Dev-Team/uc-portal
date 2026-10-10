import { useEffect, useMemo, useState } from "react";
import { Download, Upload } from "lucide-react";
import { addSuppression, deleteContacts, fetchContactActivity, fetchContacts, fetchSuppressions, importContacts, removeSuppression, tagContacts } from "../../data/commsSync.js";
import { downloadCsv, toCsv } from "../../data/csvExport.js";
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

// A small prompt for the tags to add or remove on the selected contacts.
function TagModal({ count, mode, onClose, onApply }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const tags = [...new Set(text.split(/[|,;]/).map((t) => t.trim()).filter(Boolean))];
  async function apply() {
    setBusy(true);
    setError(null);
    try {
      await onApply(tags);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`${mode === "add" ? "Add tags to" : "Remove tags from"} ${count} contact${count === 1 ? "" : "s"}`}
      onClose={onClose}
      width={480}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={apply} disabled={busy || tags.length === 0}>
            {busy ? "Working…" : mode === "add" ? "Add tags" : "Remove tags"}
          </button>
        </>
      }
    >
      {error && <p className="meta" style={{ color: "var(--color-danger)", marginTop: 0 }}>{error}</p>}
      <div className="field">
        <label htmlFor="ml-tags">Tags (separate several with | or a comma)</label>
        <input id="ml-tags" type="text" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && tags.length > 0 && apply()} placeholder="alumni|speaker series" />
      </div>
    </Modal>
  );
}

const shortDate = (iso) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

// People who aren't portal members but an admin chose to be able to email (alumni who never signed up, speakers, partners). The
// alumni directory is never mailed automatically: its addresses have to be imported here on purpose.
export function MailingListTab({ onChanged }) {
  const [contacts, setContacts] = useState(null);
  const [activity, setActivity] = useState(new Map());
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [tagMode, setTagMode] = useState(null); // null | "add" | "remove"
  const [notice, setNotice] = useState(null);

  const load = () =>
    Promise.all([fetchContacts(), fetchContactActivity().catch(() => new Map())])
      .then(([rows, last]) => {
        setContacts(rows);
        setActivity(last);
        setSelected((prev) => new Set([...prev].filter((id) => rows.some((r) => r.id === id))));
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const visible = (contacts ?? []).filter((c) => {
    const q = filter.trim().toLowerCase();
    return !q || c.email.includes(q) || (c.name ?? "").toLowerCase().includes(q) || (c.tags ?? []).some((t) => t.toLowerCase().includes(q));
  });
  const shown = visible.slice(0, 500);
  const allShownSelected = shown.length > 0 && shown.every((c) => selected.has(c.id));
  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function remove(ids, label) {
    if (!window.confirm(`Remove ${label} from the mailing list?`)) return;
    try {
      await deleteContacts(ids);
      setNotice(`Removed ${ids.length}.`);
      await load();
      onChanged?.();
    } catch (e) {
      setError(e.message);
    }
  }

  async function applyTags(tags) {
    const ids = [...selected];
    await tagContacts(ids, tagMode === "add" ? { add: tags } : { remove: tags });
    setTagMode(null);
    setNotice(`${tagMode === "add" ? "Added" : "Removed"} ${tags.join(", ")} ${tagMode === "add" ? "on" : "from"} ${ids.length} contact${ids.length === 1 ? "" : "s"}.`);
    await load();
    onChanged?.();
  }

  // Exports the selection if there is one, otherwise what the search shows: who is unsubscribed and when each was last emailed too.
  function exportCsv() {
    const rows = (selected.size > 0 ? (contacts ?? []).filter((c) => selected.has(c.id)) : visible).map((c) => {
      const a = activity.get(c.id);
      return [c.email, c.name ?? "", (c.tags ?? []).join("|"), c.subscribed ? "yes" : "no", a ? a.lastEmailedAt : "", a ? a.timesEmailed : 0, c.created_at];
    });
    downloadCsv("uc-mailing-list.csv", toCsv(["email", "name", "tags", "subscribed", "last_emailed", "times_emailed", "added"], rows));
  }

  return (
    <div>
      <div className="comms-toolbar">
        <input type="search" aria-label="Search the mailing list" placeholder="Search by name, email or tag" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <span className="meta">{contacts ? `${contacts.length} contact${contacts.length === 1 ? "" : "s"}` : ""}</span>
        <button className="btn btn-secondary" onClick={exportCsv} disabled={!contacts?.length}>
          <Download size={14} strokeWidth={1.5} aria-hidden="true" /> Export {selected.size > 0 ? "selected" : "CSV"}
        </button>
        <button className="btn btn-primary" onClick={() => setImporting(true)}>
          <Upload size={14} strokeWidth={1.5} aria-hidden="true" /> Import contacts
        </button>
      </div>
      {selected.size > 0 && (
        <div className="comms-bulkbar" role="group" aria-label="Actions for the selected contacts">
          <strong>{selected.size} selected</strong>
          <button className="btn-link" onClick={() => setTagMode("add")}>
            Add tags
          </button>
          <button className="btn-link" onClick={() => setTagMode("remove")}>
            Remove tags
          </button>
          <button className="btn-link" onClick={() => remove([...selected], `${selected.size} contact${selected.size === 1 ? "" : "s"}`)}>
            Remove from list
          </button>
          <button className="btn-link" onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
        </div>
      )}
      {notice && <p className="comms-notice" role="status">{notice}</p>}
      {error && <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>}
      {contacts === null && <p className="meta">Loading…</p>}
      {contacts?.length === 0 && <p className="meta">The mailing list is empty. Import people who don't have a portal account.</p>}
      {shown.length > 0 && (
        <label className="comms-selectall">
          <input
            type="checkbox"
            checked={allShownSelected}
            onChange={() =>
              setSelected((prev) => {
                const next = new Set(prev);
                if (allShownSelected) shown.forEach((c) => next.delete(c.id));
                else shown.forEach((c) => next.add(c.id));
                return next;
              })
            }
          />
          Select {visible.length > shown.length ? `the first ${shown.length}` : "all"} shown
        </label>
      )}
      <ul className="comms-list">
        {shown.map((c) => {
          const a = activity.get(c.id);
          return (
            <li key={c.id}>
              <input type="checkbox" className="comms-list__check" aria-label={`Select ${c.name || c.email}`} checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
              <div className="comms-list__main">
                <strong>{c.name || c.email}</strong>
                {!c.subscribed && <span className="accel-tag accel-tag--flag">Unsubscribed</span>}
                {(c.tags ?? []).map((t) => (
                  <span className="chip" key={t}>
                    {t}
                  </span>
                ))}
                <div className="meta">
                  {c.name ? `${c.email} · ` : ""}
                  {a ? `Last emailed ${shortDate(a.lastEmailedAt)} (${a.timesEmailed} ${a.timesEmailed === 1 ? "email" : "emails"})` : "Never emailed"}
                </div>
              </div>
              <div className="comms-list__actions">
                <button className="btn-link" onClick={() => remove([c.id], c.email)}>
                  Remove
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {visible.length > 500 && <p className="meta">Showing the first 500.</p>}
      {importing && <ImportModal onClose={() => setImporting(false)} onDone={async () => { await load(); onChanged?.(); }} />}
      {tagMode && <TagModal count={selected.size} mode={tagMode} onClose={() => setTagMode(null)} onApply={applyTags} />}
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
