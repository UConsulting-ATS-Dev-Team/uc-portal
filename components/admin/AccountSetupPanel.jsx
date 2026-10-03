import { useEffect, useState } from "react";
import { listUnclaimedAccounts, preProvisionAccounts, inviteMessage } from "../../data/accountSetupSync.js";

// Admin tooling for pre-creating accounts so people only have to set a
// password when they get to it. Nothing here emails anyone -- creating an
// account sends nothing, and there is deliberately no "send invite email"
// button: people who aren't expecting an email may take it for spam. An
// account is "unclaimed" until its owner signs in for the first time
// (they claim it themselves via "Forgot your password?"). Messages sent to
// an unclaimed account are waiting for them when they do. "Copy invite
// message" gives an admin text to share personally.
export default function AccountSetupPanel({ onAccountsChanged }) {
  const [unclaimed, setUnclaimed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null); // "roster" | "alumni"
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState("");

  async function load() {
    setLoading(true);
    try {
      setUnclaimed(await listUnclaimedAccounts());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handlePreProvision(audience) {
    const label = audience === "alumni" ? "every alumnus in the directory who has an email on file" : "every current member on the roster";
    if (!window.confirm(`Create accounts for ${label}? No emails are sent to anyone. Accounts that already exist are skipped.`)) return;
    setBusy(audience);
    setMessage(null);
    setError(null);
    try {
      const result = await preProvisionAccounts(audience);
      setMessage(
        `Created ${result.createdCount} account${result.createdCount === 1 ? "" : "s"}; ${result.alreadyExists.length} already existed${
          result.errors.length ? `; ${result.errors.length} failed (${result.errors[0].message})` : ""
        }.`
      );
      await load();
      onAccountsChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(inviteMessage());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Couldn't copy to the clipboard in this browser.");
    }
  }

  const shown = unclaimed.filter((a) => {
    const q = filter.trim().toLowerCase();
    return !q || a.display_name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q);
  });

  return (
    <div className="detail-section">
      <h2 className="detail-section__title">Account setup</h2>
      <p className="meta" style={{ marginTop: 0 }}>
        Pre-create accounts so people only have to set a password when they get around to it. Nobody is emailed — people claim their account
        themselves with "Forgot your password?", or you can tell them directly. Messages sent to an unclaimed account are waiting for them when they
        do.
      </p>

      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", marginBottom: "var(--space-4)" }}>
        <button className="btn btn-secondary" disabled={!!busy} onClick={() => handlePreProvision("roster")}>
          {busy === "roster" ? "Creating…" : "Pre-create current-member accounts"}
        </button>
        <button className="btn btn-secondary" disabled={!!busy} onClick={() => handlePreProvision("alumni")}>
          {busy === "alumni" ? "Creating…" : "Pre-create alumni accounts"}
        </button>
        <button className="btn btn-secondary" onClick={copyMessage}>
          {copied ? "Copied ✓" : "Copy invite message"}
        </button>
      </div>

      {message && <p className="meta">{message}</p>}
      {error && <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>}

      <p style={{ fontWeight: 700, marginBottom: "var(--space-2)" }}>Unclaimed accounts ({loading ? "…" : unclaimed.length})</p>
      <input
        type="text"
        placeholder="Search unclaimed accounts"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{ minWidth: 220, marginBottom: "var(--space-3)" }}
      />

      <div className="queue-table__scroll" style={{ maxHeight: 320, overflowY: "auto" }}>
        <table className="queue-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((a) => (
              <tr key={a.member_id}>
                <td>{a.display_name}</td>
                <td className="meta">{a.email}</td>
                <td className="meta">{a.member_status === "alumni" ? "Alumni" : a.member_status === "intern" ? "Intern" : "Current member"}</td>
                <td className="meta">{new Date(a.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</td>
              </tr>
            ))}
            {!loading && shown.length === 0 && (
              <tr>
                <td colSpan={4} className="meta">
                  {unclaimed.length === 0 ? "Every account has been claimed." : "No matches."}
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={4} className="meta">
                  Loading…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
