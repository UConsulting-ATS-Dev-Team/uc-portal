import { useState } from "react";
import Modal from "../Modal.jsx";
import { submitFeedPost } from "../../data/feedSync.js";
import { currentUser } from "../../data/mockUser.js";
import { useAppState } from "../../data/store.jsx";
import { displayName } from "../../data/profileUtils.js";

// Real "Post announcement" -- Admin Dashboard's own button used to be
// honestly disabled since no announcement flow existed anywhere in the
// app. Posts a real feed_posts row with post_type "Announcement" (see
// that migration's own admin-only DB guard, not just this modal hiding
// the option from non-admins) -- a real, persistent post, not a local-
// only banner, so it genuinely "stays like a real announcement would."
// Feed.jsx pins Announcement posts to the top, same reasoning a real
// club platform would.
export default function PostAnnouncementModal({ onClose }) {
  const { profileOverrides } = useAppState();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [posted, setPosted] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState(null);

  async function handlePost() {
    setPosting(true);
    setPostError(null);
    try {
      await submitFeedPost({
        body: `${title.trim()}\n\n${body.trim()}`,
        postType: "Announcement",
        authorName: displayName(currentUser, profileOverrides),
        authorRoleLine: "UC Exec",
        isEvent: false,
      });
      setPosted(true);
      setTimeout(onClose, 1200);
    } catch (err) {
      setPostError(err.message);
    } finally {
      setPosting(false);
    }
  }

  const canPost = title.trim() && body.trim() && !posting;

  return (
    <Modal
      title="Post an announcement"
      onClose={onClose}
      width={560}
      footer={
        posted ? (
          <span className="modal__footer-note">Posted to the real UC feed, pinned to the top.</span>
        ) : (
          <>
            <span className="modal__footer-note">
              {postError ? <span style={{ color: "var(--color-danger)" }}>{postError}</span> : "Visible to every real member immediately."}
            </span>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!canPost} onClick={handlePost}>
              {posting ? "Posting…" : "Post announcement"}
            </button>
          </>
        )
      }
    >
      <label className="field-label">Title</label>
      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. GM moved to Thursday this week" />

      <label className="field-label">Details</label>
      <textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What members need to know" />
    </Modal>
  );
}
