import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Skeleton from "../components/Skeleton.jsx";
import { useAppState } from "../data/store.jsx";
import { supabase } from "../data/supabaseClient.js";
import bearMark from "../assets/uc-bear-mark-navy.png";
import "../styles/auth.css";

// Wireframe 3a — four states: sign-in, not-on-roster, access-pending,
// loading. Sign-in/sign-up hit real Supabase Auth (Stage 2). Roster-gating
// is real now too (2026-09-13, pre-production audit follow-up): a sign-up
// attempt calls is_on_roster() via RPC *before* ever calling signUp() --
// checking first rather than parsing signUp()'s own error is deliberate;
// a live test found a rejected signup surfaces to supabase-js as a generic
// "Database error saving new user" (GoTrue doesn't pass the database
// trigger's real message through), so message-matching would never have
// been reliable. A BEFORE INSERT trigger on auth.users
// (supabase/migrations/20260913010000_roster_gating.sql) still backstops
// this at the database layer for any direct API call that skips the
// pre-check. "Alumni — request access" now writes a real row to
// access_requests (admin-reviewable on Admin Dashboard) instead of just
// a local state transition. Google sign-in is still genuinely out of
// scope (button stays honestly disabled below).
const STATE = {
  SIGN_IN: "sign-in",
  LOADING: "loading",
  NOT_ON_ROSTER: "not-on-roster",
  PENDING: "pending",
};

function Brand() {
  return (
    <div className="auth__brand">
      <img className="auth__mark" src={bearMark} alt="" />
      <span className="auth__wordmark">
        <span className="auth__wordmark-u">U</span>C Portal
      </span>
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
  const [requestName, setRequestName] = useState("");
  const [requestError, setRequestError] = useState(null);
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { onboardingComplete } = useAppState();
  // RequireAuth (see components/RequireAuth.jsx) redirects here with the
  // page the member was actually trying to reach in router state -- land
  // them back there instead of always at Home, same principle as any
  // real "continue where you left off" sign-in flow.
  const redirectTo = location.state?.from
    ? `${location.state.from.pathname}${location.state.from.search || ""}`
    : null;

  async function handleSubmit(event) {
    event.preventDefault();
    setAuthError(null);
    setState(STATE.LOADING);

    if (mode === "sign-up") {
      // Real roster check, before ever attempting signUp() -- see this
      // file's own header comment for why checking first (not parsing
      // signUp()'s own error) is the reliable path.
      const { data: onRoster, error: rosterCheckError } = await supabase.rpc("is_on_roster", { check_email: email });
      if (rosterCheckError) {
        setAuthError(rosterCheckError.message);
        setState(STATE.SIGN_IN);
        return;
      }
      if (!onRoster) {
        setState(STATE.NOT_ON_ROSTER);
        return;
      }
    }

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

    navigate(onboardingComplete ? redirectTo || "/" : "/onboarding");
  }

  function requestAccess() {
    setState(STATE.NOT_ON_ROSTER);
  }

  // Real insert into access_requests now (2026-09-13) -- admin-reviewable
  // on Admin Dashboard, same pending -> approved/declined shape as
  // feature_requests. Reachable with no session at all (anon insert, see
  // that table's own RLS policy) since this runs before any account
  // exists for a genuinely new person.
  async function submitAccessRequest() {
    setRequestSubmitting(true);
    setRequestError(null);
    const { error } = await supabase.from("access_requests").insert({
      email: email.trim(),
      name: requestName.trim() || null,
    });
    setRequestSubmitting(false);
    if (error) {
      setRequestError(error.message);
      return;
    }
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
            {!email && (
              <div className="field">
                <label htmlFor="request-email">Email</label>
                <input
                  id="request-email"
                  type="email"
                  placeholder="you@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            )}
            <div className="field">
              <label htmlFor="request-name">Name (optional)</label>
              <input
                id="request-name"
                type="text"
                placeholder="Your full name"
                value={requestName}
                onChange={(e) => setRequestName(e.target.value)}
              />
            </div>
            {requestError && (
              <p className="auth__note" style={{ color: "#B3261E" }}>
                {requestError}
              </p>
            )}
            <div className="auth__actions">
              <button className="btn btn-primary" onClick={submitAccessRequest} disabled={requestSubmitting || !email}>
                {requestSubmitting ? "Submitting…" : "Request access"}
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
