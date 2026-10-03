import { useEffect, useState } from "react";
import { listUnclaimedAccounts, preProvisionAccounts, sendClaimEmails, inviteMessage } from "../../data/accountSetupSync.js";

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Admin tooling for getting real people into accounts they haven't claimed:
// pre-create accounts (no email sent), then invite people to claim them.
// An account is "unclaimed" until its owner signs in for the first time.
// Claim emails are the standard password-setup email, sent through
// Supabase's mailer -- which allows only a few emails per hour until a
// custom SMTP provider is configured, so the batch send stops at the first
// rate limit and can simply be run again later; "Copy invite message" works
// with no email infrastructure at all.
export default function AccountSetupPanel({ onAccountsChanged }) {
  const [unclaimed, setUnclaimed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null); // "roster" | "alumni" | "send-all" | an email
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
    if (!window.confirm(`Create accounts for ${label}? No emails are sent. Accounts that already exist are skipped.`)) return;
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

  function describe(totals) {
    const parts = [`Sent ${totals.sent} claim email${totals.sent === 1 ? "" : "s"}`];
    if (totals.skipped) parts.push(`${totals.skipped} skipped (already claimed)`);
    if (totals.errors.length) parts.push(`${totals.errors.length} failed (${totals.errors[0].message})`);
    if (totals.rateLimited) parts.push(`stopped early: the email service's hourly limit was reached, ${totals.notSent} not sent. Run it again later, or use "Copy invite message"`);
    return `${parts.join("; ")}.`;
  }

  async function handleSend(emails, busyKey) {
    setBusy(busyKey);
    setMessage(null);
    setError(null);
    try {
      const totals = await sendClaimEmails(emails, (p) => setMessage(`Sending… ${p.done} of ${p.total} attempted (${p.sent} sent)`));
      setMessage(describe(totals));
      await load();
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

  const neverInvited = unclaimed.filter((a) => !a.last_invited_at);
  const shown = unclaimed.filter((a) => {
    const q = filter.trim().toLowerCase();
    return !q || a.display_name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q);
  });

  return (
    <div className="detail-section">
      <h2 className="detail-section__title">Account setup</h2>
      <p className="meta" style={{ marginTop: 0 }}>
        Pre-create accounts so people only have to set a password, then invite them to claim theirs. An account counts as unclaimed until its owner
        signs in for the first time. Messages sent to an unclaimed account are waiting for them when they do.
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

      <p style={{ fontWeight: 700, marginBottom: "var(--space-2)" }}>
        Unclaimed accounts ({loading ? "…" : unclaimed.length}) · {neverInvited.length} never invited
      </p>
      <p className="meta" style={{ marginTop: 0 }}>
        Claim emails go through Supabase's built-in email service, which only allows a few per hour until a custom email provider is connected. If
        sending stops early, run it again later, or share the invite message yourself.
      </p>
      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "center", marginBottom: "var(--space-3)" }}>
        <button
          className="btn btn-primary"
          disabled={!!busy || neverInvited.length === 0}
          onClick={() => handleSend(neverInvited.map((a) => a.email), "send-all")}
        >
          {busy === "send-all" ? "Sending…" : `Send claim email to ${neverInvited.length} never invited`}
        </button>
        <input type="text" placeholder="Search unclaimed accounts" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ minWidth: 220 }} />
      </div>

      <div className="queue-table__scroll" style={{ maxHeight: 320, overflowY: "auto" }}>
        <table className="queue-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Last invited</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((a) => (
              <tr key={a.member_id}>
                <td>{a.display_name}</td>
                <td className="meta">{a.email}</td>
                <td className="meta">{a.member_status === "alumni" ? "Alumni" : a.member_status === "intern" ? "Intern" : "Current member"}</td>
                <td className="meta">{a.last_invited_at ? `${formatDate(a.last_invited_at)} (${a.invite_count}×)` : "Never"}</td>
                <td>
                  <button className="btn btn-secondary" disabled={!!busy} onClick={() => handleSend([a.email], a.email)}>
                    {busy === a.email ? "Sending…" : a.last_invited_at ? "Resend" : "Send"}
                  </button>
                </td>
              </tr>
            ))}
            {!loading && shown.length === 0 && (
              <tr>
                <td colSpan={5} className="meta">
                  {unclaimed.length === 0 ? "Every account has been claimed." : "No matches."}
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={5} className="meta">
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
