import { useEffect, useState } from "react";
import { supabase } from "../data/supabaseClient.js";
import "../styles/jobDetail.css";
import "../styles/admin.css";

// Real member list + promote/demote, closing the gap flagged directly:
// "make it so admins can promote other accounts to admin." Reads via
// list_members() (a security definer function, same pattern as this
// page's sibling member_engagement_report() on the main Admin Dashboard
// -- profiles has no email column and full_name is almost always empty,
// so admin-gated server-side email resolution is the only way to show
// who's who). Writes are a direct client update against `profiles`,
// protected by the profiles_update_admin RLS policy + the existing
// self-escalation trigger (which already only allows this exact path --
// an admin changing someone ELSE's role -- see that trigger's own
// migration comment).
export default function AdminMembers() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actioningId, setActioningId] = useState(null);
  const [ownId, setOwnId] = useState(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc("list_members");
    if (error) setError(error.message);
    else {
      setError(null);
      setMembers(data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setOwnId(session.user.id);
    });
  }, []);

  async function toggleRole(member) {
    const nextRole = member.role === "admin" ? "member" : "admin";
    setActioningId(member.member_id);
    const { error } = await supabase.from("profiles").update({ role: nextRole }).eq("id", member.member_id);
    if (error) {
      setError(error.message);
    } else {
      setMembers((prev) => prev.map((m) => (m.member_id === member.member_id ? { ...m, role: nextRole } : m)));
    }
    setActioningId(null);
  }

  return (
    <div>
      <h1>Members</h1>
      <p className="meta">
        Every real signed-up account. Admins can post/edit jobs, review submitted opportunities and feature
        requests, and manage sources — everyone else is a regular member.{" "}
        {loading ? "" : `${members.length} real account${members.length === 1 ? "" : "s"} exist today.`}
      </p>

      {error && <p className="meta" style={{ color: "#B3261E" }}>{error}</p>}

      <div className="detail-section">
        <div className="queue-table__scroll">
          <table className="queue-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Email</th>
                <th>Joined</th>
                <th>Role</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const isSelf = m.member_id === ownId;
                const isBusy = actioningId === m.member_id;
                return (
                  <tr key={m.member_id}>
                    <td>{m.display_name}</td>
                    <td className="meta">{m.email}</td>
                    <td className="meta">
                      {new Date(m.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td>
                      <span className={`chip${m.role === "admin" ? " chip-accent" : ""}`}>
                        {m.role === "admin" ? "Admin" : "Member"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        disabled={isBusy || isSelf}
                        title={isSelf ? "You can't change your own admin status — ask another admin instead" : undefined}
                        onClick={() => toggleRole(m)}
                      >
                        {isBusy ? "Saving…" : m.role === "admin" ? "Demote to member" : "Promote to admin"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loading && members.length === 0 && (
                <tr>
                  <td colSpan={5} className="meta">
                    No real signed-up accounts yet.
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
    </div>
  );
}
