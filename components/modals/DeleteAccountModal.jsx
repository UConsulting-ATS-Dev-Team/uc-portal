import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../Modal.jsx";
import { supabase } from "../../data/supabaseClient.js";

// Real, irreversible self-service account deletion -- see
// supabase/functions/delete-own-account/index.ts's own header comment
// for exactly what happens server-side (what cascades, what's nulled
// and kept, what's explicitly cleared from Storage). Requires typing
// "DELETE" -- a real extra confirmation step for a genuinely
// irreversible action, same bar this app already holds real financial/
// identity-adjacent actions to, not a bare "are you sure?" dialog.
export default function DeleteAccountModal({ onClose }) {
  const navigate = useNavigate();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);

    const { error: fnError } = await supabase.functions.invoke("delete-own-account", {
      method: "POST",
      body: { confirm: true },
    });

    if (fnError) {
      setDeleting(false);
      setError(fnError.message || "Something went wrong -- your account was not deleted.");
      return;
    }

    // The account (and its session) no longer exists server-side --
    // signOut() here is just to clear this browser's own local token/
    // cache, same privacy reasoning TopBar.jsx's real sign-out already
    // established, not because the server still thinks it's valid.
    await supabase.auth.signOut();
    localStorage.removeItem("uc-portal-state");
    navigate("/sign-in");
  }

  const canDelete = confirmText.trim() === "DELETE" && !deleting;

  return (
    <Modal
      title="Delete your account"
      onClose={onClose}
      width={520}
      footer={
        <>
          <span className="modal__footer-note">
            {error ? <span style={{ color: "var(--color-danger)" }}>{error}</span> : "This cannot be undone."}
          </span>
          <button className="btn btn-secondary" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            style={{ background: "var(--color-danger)", borderColor: "var(--color-danger)" }}
            disabled={!canDelete}
            onClick={handleDelete}
          >
            {deleting ? "Deleting…" : "Delete my account"}
          </button>
        </>
      }
    >
      <p style={{ marginTop: 0 }}>
        This permanently deletes your profile, tracked applications, saved jobs, messages you've sent, network
        connections, work history, and everything else tied to your account. It cannot be recovered.
      </p>
      <p>
        Feature requests, opportunities you've posted, and interview write-ups you've shared stay up for other
        members — the name attached to them at the time you posted stays too, the same way it would if you'd
        posted it under a name you later changed. Messages you've sent stay in the other person's inbox, but will
        show as sent by a "Former member" instead of your name.
      </p>
      <label className="field-label">
        Type <strong>DELETE</strong> to confirm
      </label>
      <input
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder="DELETE"
        autoComplete="off"
      />
    </Modal>
  );
}
