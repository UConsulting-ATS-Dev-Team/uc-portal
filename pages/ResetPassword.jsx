import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../data/supabaseClient.js";
import bearMark from "../assets/uc-bear-mark-navy.png";
import "../styles/auth.css";

// Landing page for the link in a "reset your password" email --
// supabase.auth.resetPasswordForEmail() (see SignIn.jsx's forgot-password
// flow) sends a link that redirects here with a recovery token in the URL
// hash; supabase-js v2 auto-detects that and establishes a real (short-
// lived) session before this component ever mounts, so getSession() below
// just needs to confirm one exists -- no need to parse the hash by hand.
// Deliberately outside RequireAuth (see App.jsx) -- a recovery session is
// real but shouldn't be routed through the normal onboarding/member-type
// redirects that gate every other authenticated page.
export default function ResetPassword() {
  const [status, setStatus] = useState("checking"); // "checking" | "ready" | "no-session" | "done"
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setStatus(data.session ? "ready" : "no-session");
    });
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setStatus("done");
    setTimeout(() => navigate("/"), 1500);
  }

  return (
    <div className="auth">
      <div className="auth__stack">
        <div className="auth__brand">
          <img className="auth__mark" src={bearMark} alt="" />
          <span className="auth__wordmark">
            <span className="auth__wordmark-u">U</span>C Portal
          </span>
        </div>
        <div className="auth__card">
          {status === "checking" && <p className="auth__subtitle">Checking your reset link…</p>}

          {status === "no-session" && (
            <>
              <h1 className="auth__title">This link isn't valid</h1>
              <p className="auth__subtitle">
                Reset links expire after a while, or this one's already been used. Request a new one
                from the sign-in page.
              </p>
              <Link className="btn btn-primary" to="/sign-in" style={{ width: "100%", textAlign: "center" }}>
                Back to sign in
              </Link>
            </>
          )}

          {status === "ready" && (
            <>
              <h1 className="auth__title">Set a new password</h1>
              <p className="auth__subtitle">Choose a new password for your account.</p>
              {error && (
                <p className="auth__note" style={{ color: "#B3261E" }}>
                  {error}
                </p>
              )}
              <form onSubmit={handleSubmit}>
                <div className="field">
                  <label htmlFor="new-password">New password</label>
                  <input
                    id="new-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="confirm-password">Confirm password</label>
                  <input
                    id="confirm-password"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>
                <button className="btn btn-secondary" type="submit" style={{ width: "100%" }} disabled={submitting}>
                  {submitting ? "Saving…" : "Save new password"}
                </button>
              </form>
            </>
          )}

          {status === "done" && (
            <>
              <h1 className="auth__title">Password updated</h1>
              <p className="auth__subtitle">Taking you into UC Portal now…</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
