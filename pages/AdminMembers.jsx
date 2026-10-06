import { useEffect, useMemo, useState } from "react";
import { Ban, Copy, Pencil, Plus, RotateCcw } from "lucide-react";
import { supabase } from "../data/supabaseClient.js";
import { fetchAccounts, updateAccount, createAccount, deactivateAccount, reactivateAccount } from "../data/adminUsersSync.js";
import { initialsFromName } from "../data/profileUtils.js";
import AccountSetupPanel from "../components/admin/AccountSetupPanel.jsx";
import Modal from "../components/Modal.jsx";
import AdminDashboard from "./AdminDashboard.jsx";
import "../styles/jobDetail.css";
import "../styles/admin.css";

const STATUS_LABEL = { current_member: "Current member", alumni: "Alumni", intern: "Intern" };
const ROLE_OPTIONS = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
];
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Unknown");

function activityText(account) {
  if (!account.last_active_at) return "No activity yet";
  const days = Math.floor((Date.now() - new Date(account.last_active_at).getTime()) / 86400000);
  const when = days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
  return `Last active ${when}`;
}

function UserCard({ account, isSelf, busy, onRole, onEdit, onToggleActive }) {
  const deactivated = Boolean(account.deactivated_at);
  return (
    <div className={`user-card${deactivated ? " is-deactivated" : ""}`}>
      <div className="user-card__head">
        <div className="user-card__avatar">{account.avatar_url ? <img src={account.avatar_url} alt="" /> : initialsFromName(account.display_name)}</div>
        <div className="user-card__who">
          <div className="user-card__name">{account.display_name}</div>
          <div className="user-card__email">{account.email}</div>
        </div>
      </div>
      <dl className="user-card__facts">
        <div>
          <dt>Class</dt>
          <dd>{account.class_year ?? "Not set"}</dd>
        </div>
        <div>
          <dt>Joined</dt>
          <dd>{fmtDate(account.created_at)}</dd>
        </div>
        <div>
          <dt>Membership</dt>
          <dd>{STATUS_LABEL[account.member_status]}</dd>
        </div>
        <div>
          <dt>Role</dt>
          <dd>
            <span className={`chip${account.role === "admin" ? " chip-accent" : ""}`}>{account.role === "admin" ? "Admin" : "Member"}</span>
            {deactivated && <span className="chip user-card__flag">Deactivated</span>}
          </dd>
        </div>
        <div>
          <dt>Activity</dt>
          <dd>
            {activityText(account)}
            {account.views_30d > 0 && <span className="meta"> · {account.views_30d} page views in 30 days</span>}
          </dd>
        </div>
      </dl>
      <div className="field user-card__role">
        <label htmlFor={`role-${account.member_id}`}>Change role</label>
        <select
          id={`role-${account.member_id}`}
          value={account.role}
          disabled={busy || isSelf}
          title={isSelf ? "You can't change your own role. Ask another admin." : undefined}
          onChange={(e) => onRole(account, e.target.value)}
        >
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="user-card__actions">
        <button type="button" className="btn-link" onClick={() => onEdit(account)}>
          <Pencil size={13} strokeWidth={1.5} aria-hidden="true" /> Edit
        </button>
        <button type="button" className="btn-link" disabled={busy || isSelf} title={isSelf ? "You can't deactivate your own account." : undefined} onClick={() => onToggleActive(account)}>
          {deactivated ? <RotateCcw size={13} strokeWidth={1.5} aria-hidden="true" /> : <Ban size={13} strokeWidth={1.5} aria-hidden="true" />}{" "}
          {deactivated ? "Reactivate" : "Deactivate"}
        </button>
      </div>
    </div>
  );
}

function EditModal({ account, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: account.display_name === account.email ? "" : account.display_name,
    classYear: account.class_year ?? "",
    phone: account.phone ?? "",
    memberStatus: account.member_status,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await updateAccount(account.member_id, form);
      await onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Edit user"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      {error && <p className="meta" style={{ color: "var(--color-danger)", marginTop: 0 }}>{error}</p>}
      <div className="field">
        <label htmlFor="eu-email">Email</label>
        <input id="eu-email" type="text" value={account.email} disabled />
      </div>
      <div className="field">
        <label htmlFor="eu-name">Name</label>
        <input id="eu-name" type="text" value={form.name} onChange={(e) => set({ name: e.target.value })} />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="eu-class">Class year</label>
          <input id="eu-class" type="number" min="2000" max="2100" value={form.classYear} onChange={(e) => set({ classYear: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="eu-status">Membership</label>
          <select id="eu-status" value={form.memberStatus} onChange={(e) => set({ memberStatus: e.target.value })}>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="eu-phone">Phone</label>
        <input id="eu-phone" type="text" value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="(310) 555-1234" />
        <p className="meta" style={{ marginBottom: 0 }}>Only used when an exec texts this person from their own phone.</p>
      </div>
    </Modal>
  );
}

function AddModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ email: "", name: "", classYear: "", memberStatus: "current_member", role: "member" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function save() {
    if (!form.email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createAccount(form);
      await onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Add new user"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Creating…" : "Create account"}
          </button>
        </>
      }
    >
      {error && <p className="meta" style={{ color: "var(--color-danger)", marginTop: 0 }}>{error}</p>}
      <p className="meta" style={{ marginTop: 0 }}>
        Creates the account now and sends nothing. They claim it with "Forgot your password?" on the sign-in page, or you can tell them directly.
      </p>
      <div className="field">
        <label htmlFor="au-email">Email</label>
        <input id="au-email" type="text" value={form.email} onChange={(e) => set({ email: e.target.value })} placeholder="name@ucla.edu" />
      </div>
      <div className="field">
        <label htmlFor="au-name">Full name</label>
        <input id="au-name" type="text" value={form.name} onChange={(e) => set({ name: e.target.value })} />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="au-class">Class year</label>
          <input id="au-class" type="number" min="2000" max="2100" value={form.classYear} onChange={(e) => set({ classYear: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="au-status">Membership</label>
          <select id="au-status" value={form.memberStatus} onChange={(e) => set({ memberStatus: e.target.value, role: e.target.value === "current_member" ? form.role : "member" })}>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="au-role">Role</label>
          <select id="au-role" value={form.role} disabled={form.memberStatus !== "current_member"} onChange={(e) => set({ role: e.target.value })}>
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
}

// The Members page: everyone with an account, with search and filters, a card per person, and the actions an exec needs
// (change role, edit details, deactivate or reactivate, add someone new). Deactivating also disables the sign-in.
export default function AdminMembers() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ownId, setOwnId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [showDeactivated, setShowDeactivated] = useState(false);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [deactivating, setDeactivating] = useState(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    try {
      setAccounts(await fetchAccounts());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    supabase.auth.getSession().then(({ data: { session } }) => session && setOwnId(session.user.id));
  }, []);

  const classYears = useMemo(() => [...new Set(accounts.map((a) => a.class_year).filter(Boolean))].sort(), [accounts]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter((a) => {
      if (!showDeactivated && a.deactivated_at) return false;
      if (roleFilter && a.role !== roleFilter) return false;
      if (statusFilter && a.member_status !== statusFilter) return false;
      if (classFilter && String(a.class_year) !== classFilter) return false;
      return !q || a.display_name.toLowerCase().includes(q) || (a.email ?? "").toLowerCase().includes(q);
    });
  }, [accounts, search, roleFilter, statusFilter, classFilter, showDeactivated]);

  const chips = [
    roleFilter && { label: `Role: ${roleFilter === "admin" ? "Admin" : "Member"}`, clear: () => setRoleFilter("") },
    statusFilter && { label: STATUS_LABEL[statusFilter], clear: () => setStatusFilter("") },
    classFilter && { label: `Class of ${classFilter}`, clear: () => setClassFilter("") },
  ].filter(Boolean);

  async function changeRole(account, role) {
    setBusyId(account.member_id);
    try {
      await updateAccount(account.member_id, { role });
      setAccounts((prev) => prev.map((a) => (a.member_id === account.member_id ? { ...a, role } : a)));
    } catch (err) {
      setError(err.message);
    }
    setBusyId(null);
  }

  async function confirmDeactivate() {
    const account = deactivating;
    setBusyId(account.member_id);
    try {
      await deactivateAccount(account.member_id);
      await load();
      setDeactivating(null);
    } catch (err) {
      setError(err.message);
    }
    setBusyId(null);
  }

  async function reactivate(account) {
    setBusyId(account.member_id);
    try {
      await reactivateAccount(account.member_id);
      await load();
    } catch (err) {
      setError(err.message);
    }
    setBusyId(null);
  }

  async function copySignupLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/sign-in`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy to the clipboard. The link is " + window.location.origin + "/sign-in");
    }
  }

  return (
    <div>
      <div className="jobs-header" style={{ marginBottom: "var(--space-6)" }}>
        <div>
          <h1>User management</h1>
          <p className="meta">Manage accounts, roles and access.</p>
        </div>
        <div className="jobs-header__actions">
          <button className="btn btn-secondary" onClick={copySignupLink}>
            <Copy size={14} strokeWidth={1.5} aria-hidden="true" /> {copied ? "Copied" : "Copy sign-up link"}
          </button>
          <button className="btn btn-primary" onClick={() => setAdding(true)}>
            <Plus size={14} strokeWidth={1.5} aria-hidden="true" /> Add new user
          </button>
        </div>
      </div>

      {error && <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>}

      <div className="user-filters">
        <input type="search" placeholder="Search by name or email" aria-label="Search users" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Filter by role" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">All roles</option>
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select aria-label="Filter by membership" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All memberships</option>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select aria-label="Filter by class year" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
          <option value="">All classes</option>
          {classYears.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
        {chips.map((c) => (
          <span className="active-filter-chip" key={c.label}>
            {c.label}
            <button type="button" onClick={c.clear} aria-label={`Remove ${c.label}`}>
              ✕
            </button>
          </span>
        ))}
        <span className="meta">
          {loading ? "Loading…" : `${visible.length} user${visible.length === 1 ? "" : "s"}`}
        </span>
        <label className="user-filters__toggle">
          <input type="checkbox" checked={showDeactivated} onChange={() => setShowDeactivated((v) => !v)} /> Show deactivated
        </label>
      </div>

      {!loading && visible.length === 0 && <p className="meta">No one matches those filters.</p>}
      <div className="user-grid">
        {visible.map((a) => (
          <UserCard
            key={a.member_id}
            account={a}
            isSelf={a.member_id === ownId}
            busy={busyId === a.member_id}
            onRole={changeRole}
            onEdit={setEditing}
            onToggleActive={(acc) => (acc.deactivated_at ? reactivate(acc) : setDeactivating(acc))}
          />
        ))}
      </div>

      <AccountSetupPanel onAccountsChanged={load} />
      <AdminDashboard view="people" />

      {editing && <EditModal account={editing} onClose={() => setEditing(null)} onSaved={load} />}
      {adding && <AddModal onClose={() => setAdding(false)} onSaved={load} />}
      {deactivating && (
        <Modal
          title="Deactivate account"
          onClose={() => setDeactivating(null)}
          width={460}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setDeactivating(null)} disabled={busyId === deactivating.member_id}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={confirmDeactivate} disabled={busyId === deactivating.member_id}>
                {busyId === deactivating.member_id ? "Deactivating…" : "Deactivate"}
              </button>
            </>
          }
        >
          <p style={{ marginTop: 0 }}>
            <strong>{deactivating.display_name}</strong> will be signed out and won't be able to sign in again, and won't receive mass messages. Their
            posts and messages stay. You can reactivate the account at any time.
          </p>
        </Modal>
      )}
    </div>
  );
}
