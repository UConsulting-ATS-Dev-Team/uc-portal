import { useEffect, useState } from "react";
import { addAccountEmail, fetchAccountEmails, removeAccountEmail } from "../data/accountEmailsSync.js";

// "Other emails you can sign in with" on My Profile: any email added here signs in to this same account.
export default function AccountEmails({ mainEmail }) {
  const [emails, setEmails] = useState(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  function load() {
    fetchAccountEmails()
      .then(setEmails)
      .catch((e) => setError(e.message));
  }
  useEffect(load, []);

  async function add() {
    if (!draft.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await addAccountEmail(draft);
      setDraft("");
      load();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  async function remove(email) {
    setError(null);
    try {
      await removeAccountEmail(email);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="field">
      <label htmlFor="extra-email">Emails you sign in with</label>
      <ul className="account-emails">
        {mainEmail && (
          <li>
            {mainEmail} <span className="meta">main</span>
          </li>
        )}
        {emails?.map((e) => (
          <li key={e.email}>
            {e.email}{" "}
            <button type="button" className="btn-link" onClick={() => remove(e.email)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "stretch" }}>
        <input
          id="extra-email"
          type="email"
          autoComplete="off"
          placeholder="Add another email"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="btn btn-secondary" onClick={add} disabled={busy || !draft.trim()}>
          Add
        </button>
      </div>
      {error && <p className="meta" style={{ color: "var(--color-danger)", margin: "var(--space-2) 0 0" }}>{error}</p>}
    </div>
  );
}
