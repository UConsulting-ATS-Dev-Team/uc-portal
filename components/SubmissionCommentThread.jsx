import { useEffect, useState } from "react";
import { fetchSubmissionComments, addSubmissionComment } from "../data/acceleratorSync.js";
import { supabase } from "../data/supabaseClient.js";

// Real back-and-forth comment thread on an accelerator submission --
// separate from the single official score/feedback fields, and shared by
// both the admin's GradeRow and the intern's own SubmissionForm since RLS
// (not this component) decides who can read/write which thread.
// resolveAuthorName is optional -- the admin side passes list_members()'s
// own namesById map; the intern side has no such lookup available (and
// doesn't need one -- RLS scopes a thread to just this intern + admins, so
// "not me" always means "an admin").
export default function SubmissionCommentThread({ submissionId, resolveAuthorName }) {
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [selfId, setSelfId] = useState(null);

  function load() {
    fetchSubmissionComments(submissionId).then(setComments).catch(() => {});
  }

  useEffect(() => {
    load();
    supabase.auth.getUser().then(({ data }) => setSelfId(data?.user?.id ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId]);

  async function handleSend() {
    if (!body.trim()) return;
    setSending(true);
    try {
      await addSubmissionComment(submissionId, body);
      setBody("");
      load();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="submission-comments">
      <p style={{ fontWeight: 700, fontSize: "var(--font-size-meta)", marginBottom: "var(--space-2)" }}>Comments</p>
      {comments.length === 0 && <p className="meta">No comments yet.</p>}
      {comments.map((c) => (
        <div key={c.id} style={{ marginBottom: "var(--space-2)" }}>
          <span style={{ fontWeight: 600 }}>
            {c.author_id === selfId ? "You" : resolveAuthorName ? resolveAuthorName(c.author_id) : "UC Admin"}
          </span>
          <span className="meta"> · {new Date(c.created_at).toLocaleString()}</span>
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{c.body}</p>
        </div>
      ))}
      <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
        <input
          type="text"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Add a comment…"
          style={{ flex: 1 }}
        />
        <button className="btn btn-secondary" onClick={handleSend} disabled={sending || !body.trim()}>
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
