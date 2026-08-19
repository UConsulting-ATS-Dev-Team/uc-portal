import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Skeleton from "../components/Skeleton.jsx";
import { useAppState } from "../data/store.jsx";
import "../styles/auth.css";

// Wireframe 3a — four states: sign-in, not-on-roster, access-pending,
// loading. No real auth/roster check exists (prototype only), so the
// "Continue with Google" / "Sign in" buttons simulate a successful login,
// and "Alumni — request access" walks through the not-on-roster → pending
// path so both flows are demoable.
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
        U<span>C</span>
      </span>
      <span className="auth__wordmark">UC Portal</span>
    </div>
  );
}

export default function SignIn() {
  const [state, setState] = useState(STATE.SIGN_IN);
  const [email, setEmail] = useState("");
  const [submittedAt, setSubmittedAt] = useState(null);
  const [resent, setResent] = useState(false);
  const navigate = useNavigate();
  const { onboardingComplete } = useAppState();

  function simulateSignIn(event) {
    event?.preventDefault();
    setState(STATE.LOADING);
    setTimeout(() => navigate(onboardingComplete ? "/" : "/onboarding"), 700);
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
              roster. If you've recently joined UC or just graduated, request access below and the
              Careers Committee will confirm.
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
              Your request is in with the Careers Committee. You'll get an email as soon as it's
              approved.
            </p>
            <ul className="auth__meta-list">
              <li>Submitted {submittedAt?.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</li>
              <li>Reviewed by the Careers Committee at the weekly Exec meeting</li>
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
          <h1 className="auth__title">Sign in</h1>
          <p className="auth__subtitle">UC Portal is private to UConsulting members and alumni.</p>

          <button className="btn btn-primary" style={{ width: "100%" }} onClick={simulateSignIn}>
            Continue with your university Google account
          </button>

          <div className="auth__divider">or</div>

          <form onSubmit={simulateSignIn}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                placeholder="you@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" placeholder="••••••••" />
            </div>
            <button className="btn btn-secondary" type="submit" style={{ width: "100%" }}>
              Sign in
            </button>
          </form>

          <div className="auth__footer-links">
            <button className="btn-link">Forgot password</button>
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
