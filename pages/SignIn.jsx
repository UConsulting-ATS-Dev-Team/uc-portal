import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Skeleton from "../components/Skeleton.jsx";
import { useAppState } from "../data/store.jsx";
import { supabase } from "../data/supabaseClient.js";
import bearMark from "../assets/uc-bear-mark-white.png";
import "../styles/auth.css";

// Wireframe 3a — four states: sign-in, not-on-roster, access-pending,
// loading. Sign-in/sign-up now hit real Supabase Auth (Stage 2) instead of
// simulating success. Google sign-in and the roster-verification check
// (there's no real roster data source yet -- see CLAUDE.md's open action
// item to pull one from Alumni Relations) are still out of scope; "Alumni —
// request access" stays a UI-only walkthrough of that state for now.
const STATE = {
  SIGN_IN: "sign-in",
  LOADING: "loading",
  NOT_ON_ROSTER: "not-on-roster",
  PENDING: "pending",
};

function Brand() {
  return (
    <div className="auth__brand">
      <span className="auth__mark">
        <img src={bearMark} alt="" />
      </span>
      <span className="auth__wordmark">UC Portal</span>
    </div>
  );
}

export default function SignIn() {
  const [state, setState] = useState(STATE.SIGN_IN);
  const [mode, setMode] = useState("sign-in"); // "sign-in" | "sign-up"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState(null);
  const [confirmNotice, setConfirmNotice] = useState(false);
  const [submittedAt, setSubmittedAt] = useState(null);
  const [resent, setResent] = useState(false);
  const navigate = useNavigate();
  const { onboardingComplete } = useAppState();

  async function handleSubmit(event) {
    event.preventDefault();
    setAuthError(null);
    setState(STATE.LOADING);

    const { data, error } =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (error) {
      setAuthError(error.message);
      setState(STATE.SIGN_IN);
      return;
    }

    // Sign-up with email confirmation enabled (the Supabase default) returns
    // a user but no active session yet -- the member has to click the link
    // in their inbox before signInWithPassword will succeed.
    if (mode === "sign-up" && !data.session) {
      setConfirmNotice(true);
      setState(STATE.SIGN_IN);
      return;
    }

    navigate(onboardingComplete ? "/" : "/onboarding");
  }

  function requestAccess() {
    setState(STATE.NOT_ON_ROSTER);
  }

  function submitAccessRequest() {
    setSubmittedAt(new Date());
    setState(STATE.PENDING);
  }

  if (state === STATE.LOADING) {
    return (
      <div className="auth">
        <div className="auth__stack">
          <Brand />
          <Skeleton lines={4} />
        </div>
      </div>
    );
  }

  if (state === STATE.NOT_ON_ROSTER) {
    return (
      <div className="auth">
        <div className="auth__stack">
          <Brand />
          <div className="auth__card">
            <h1 className="auth__title">We couldn't find you on the roster</h1>
            <p className="auth__subtitle">
              This account ({email || "you@university.edu"}) isn't on the current member or alumni
              roster. If you've recently joined UC or just graduated, request access below and
              Exec will confirm.
            </p>
            <div className="auth__actions">
              <button className="btn btn-primary" onClick={submitAccessRequest}>
                Request access
              </button>
              <button className="btn btn-secondary" onClick={() => setState(STATE.SIGN_IN)}>
                Try another account
              </button>
            </div>
            <p className="auth__note" style={{ marginTop: "var(--space-6)" }}>
              Requests are reviewed at the weekly Exec meeting · typically 2–3 days.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (state === STATE.PENDING) {
    return (
      <div className="auth">
        <div className="auth__stack">
          <Brand />
          <div className="auth__card">
            <div className="auth__meta-row">
              <h1 className="auth__title" style={{ marginBottom: 0 }}>
                Access pending
              </h1>
              <span className="chip chip-accent">Pending</span>
            </div>
            <p className="auth__subtitle">
              Your request is in with Exec. You'll get an email as soon as it's
              approved.
            </p>
            <ul className="auth__meta-list">
              <li>Submitted {submittedAt?.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</li>
              <li>Reviewed at the weekly Exec meeting</li>
            </ul>
            <div className="auth__actions">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setResent(true);
                }}
              >
                {resent ? "Request resent" : "Resend"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth">
      <div className="auth__stack">
        <Brand />
        <div className="auth__card">
          <h1 className="auth__title">{mode === "sign-in" ? "Sign in" : "Create your account"}</h1>
          <p className="auth__subtitle">UC Portal is private to UConsulting members and alumni.</p>

          <button className="btn btn-primary" style={{ width: "100%" }} disabled title="Google sign-in isn't set up yet">
            Continue with your university Google account
          </button>

          <div className="auth__divider">or</div>

          {confirmNotice && (
            <p className="auth__note" style={{ color: "var(--color-accent)" }}>
              Check {email} for a confirmation link, then sign in below.
            </p>
          )}
          {authError && (
            <p className="auth__note" style={{ color: "#B3261E" }}>
              {authError}
            </p>
          )}

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                placeholder="you@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <button className="btn btn-secondary" type="submit" style={{ width: "100%" }}>
              {mode === "sign-in" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div className="auth__footer-links">
            <button
              className="btn-link"
              onClick={() => {
                setMode((m) => (m === "sign-in" ? "sign-up" : "sign-in"));
                setAuthError(null);
                setConfirmNotice(false);
              }}
            >
              {mode === "sign-in" ? "New here? Create an account" : "Already have an account? Sign in"}
            </button>
            <button className="btn-link" onClick={requestAccess}>
              Alumni — request access
            </button>
          </div>
        </div>
        <p className="auth__note">
          Accounts are provisioned from the UC roster. Members convert to alumni automatically at
          commencement.
        </p>
      </div>
    </div>
  );
}
