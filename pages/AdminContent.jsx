import { useEffect, useState } from "react";
import { fetchFeedPosts, deleteFeedPost } from "../data/feedSync.js";
import { fetchAllWriteups, deleteInterviewWriteup } from "../data/realWriteups.js";
import { fetchContributions, deleteContribution } from "../data/contributionsSync.js";
import "../styles/jobDetail.css";
import "../styles/admin.css";

function truncate(text, max) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

// Real content moderation -- closes the actual gap behind the nav rail's
// long-placeholder "/admin/content" destination: admins had no way to
// remove another member's feed post, interview write-up, or library
// contribution at all (only an own-row delete existed on any of the
// three). The Admin Dashboard's "Moderate feed" link used to point at a
// fully fake FLAGGED_FEED_POSTS=2 count with nothing real behind it --
// replaced by this page's real counts and real remove actions.
export default function AdminContent() {
  const [feedPosts, setFeedPosts] = useState(null);
  const [writeups, setWriteups] = useState(null);
  const [contributions, setContributions] = useState(null);
  const [error, setError] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  function load() {
    fetchFeedPosts().then(setFeedPosts).catch((e) => setError(e.message));
    fetchAllWriteups().then(setWriteups).catch((e) => setError(e.message));
    fetchContributions().then(setContributions).catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRemove(action, id) {
    if (!window.confirm("Remove this for every member? This can't be undone.")) return;
    setRemovingId(id);
    try {
      await action(id);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div>
      <h1>Content management</h1>

      {error && (
        <p className="meta" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      )}

      <div className="detail-section">
        <p style={{ fontWeight: 700 }}>Feed posts ({feedPosts?.length ?? "…"})</p>
        <div className="queue-table__scroll">
          <table className="queue-table">
            <thead>
              <tr>
                <th>Author</th>
                <th>Type</th>
                <th>Post</th>
                <th>Posted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {feedPosts === null && (
                <tr>
                  <td colSpan={5} className="meta">
                    Loading…
                  </td>
                </tr>
              )}
              {feedPosts?.length === 0 && (
                <tr>
                  <td colSpan={5} className="meta">
                    No real posts yet.
                  </td>
                </tr>
              )}
              {feedPosts?.map((p) => (
                <tr key={p.id}>
                  <td>{p.author_name}</td>
                  <td>{p.post_type}</td>
                  <td style={{ maxWidth: 360 }}>{truncate(p.body, 160)}</td>
                  <td className="meta">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td>
                    <button className="btn-link" onClick={() => handleRemove(deleteFeedPost, p.id)} disabled={removingId === p.id}>
                      {removingId === p.id ? "Removing…" : "Remove"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="detail-section">
        <p style={{ fontWeight: 700 }}>Interview write-ups ({writeups?.length ?? "…"})</p>
        <div className="queue-table__scroll">
          <table className="queue-table">
            <thead>
              <tr>
                <th>Author</th>
                <th>Company</th>
                <th>Excerpt</th>
                <th>Posted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {writeups === null && (
                <tr>
                  <td colSpan={5} className="meta">
                    Loading…
                  </td>
                </tr>
              )}
              {writeups?.length === 0 && (
                <tr>
                  <td colSpan={5} className="meta">
                    No real write-ups yet.
                  </td>
                </tr>
              )}
              {writeups?.map((w) => (
                <tr key={w.id}>
                  <td>{w.is_anonymous ? <span className="meta">Anonymous</span> : w.submitted_by_name}</td>
                  <td>{w.company}</td>
                  <td style={{ maxWidth: 360 }}>{truncate(w.body, 160)}</td>
                  <td className="meta">{new Date(w.created_at).toLocaleDateString()}</td>
                  <td>
                    <button className="btn-link" onClick={() => handleRemove(deleteInterviewWriteup, w.id)} disabled={removingId === w.id}>
                      {removingId === w.id ? "Removing…" : "Remove"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="detail-section">
        <p style={{ fontWeight: 700 }}>Library contributions ({contributions?.length ?? "…"})</p>
        <div className="queue-table__scroll">
          <table className="queue-table">
            <thead>
              <tr>
                <th>Author</th>
                <th>Type</th>
                <th>Title</th>
                <th>Posted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {contributions === null && (
                <tr>
                  <td colSpan={5} className="meta">
                    Loading…
                  </td>
                </tr>
              )}
              {contributions?.length === 0 && (
                <tr>
                  <td colSpan={5} className="meta">
                    No real contributions yet.
                  </td>
                </tr>
              )}
              {contributions?.map((c) => (
                <tr key={c.id}>
                  <td>{c.is_anonymous ? <span className="meta">Anonymous</span> : c.submitted_by_name}</td>
                  <td>{c.type}</td>
                  <td style={{ maxWidth: 360 }}>{c.title}</td>
                  <td className="meta">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td>
                    <button className="btn-link" onClick={() => handleRemove(deleteContribution, c.id)} disabled={removingId === c.id}>
                      {removingId === c.id ? "Removing…" : "Remove"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
