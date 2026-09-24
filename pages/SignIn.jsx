import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Skeleton from "../components/Skeleton.jsx";
import { useAppState } from "../data/store.jsx";
import { supabase } from "../data/supabaseClient.js";
import bearMark from "../assets/uc-bear-mark-navy.png";
import "../styles/auth.css";

// Wireframe 3a — four states: sign-in, not-on-roster, access-pending,
// loading. Sign-in/sign-up hit real Supabase Auth (Stage 2). Signup-gating
// is real (2026-09-13, pre-production audit follow-up; extended
// 2026-09-15 to cover real alumni too, not just current members): a
// sign-up attempt calls can_sign_up() via RPC *before* ever calling
// signUp() -- checking first rather than parsing signUp()'s own error is
// deliberate; a live test found a rejected signup surfaces to supabase-js
// as a generic "Database error saving new user" (GoTrue doesn't pass the
// database trigger's real message through), so message-matching would
// never have been reliable. can_sign_up() itself covers two real, separate
// paths -- current members (a roster match) and alumni (a real
// people.status = 'Alumni' match) -- see the alumni-accounts migration's
// own header comment. A BEFORE INSERT trigger on auth.users
// (supabase/migrations/20260913010000_roster_gating.sql) still backstops
// this at the database layer for any direct API call that skips the
// pre-check. "Alumni — request access" writes a real row to
// access_requests (admin-reviewable on Admin Dashboard) instead of just a
// local state transition -- now genuinely a fallback for someone not
// found in the real Directory at all, since a real alumnus who *is* in it
// can just sign up directly and succeed. Google sign-in is still
// genuinely out of scope (button stays honestly disabled below).
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
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState(null);
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
      // Real signup-eligibility check, before ever attempting signUp() --
      // see this file's own header comment for why checking first (not
      // parsing signUp()'s own error) is the reliable path. can_sign_up()
      // covers both current members (roster) and real alumni (a
      // people.status = 'Alumni' match) -- see the alumni-accounts
      // migration's own header comment for why this isn't just roster.
      const { data: onRoster, error: rosterCheckError } = await supabase.rpc("can_sign_up", { check_email: email });
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

    // Route by the real onboarding_complete value, not useAppState()'s
    // onboardingComplete -- that comes from data/store.jsx's mount-time
    // hydration effect, which fires once when AppStateProvider first
    // mounts (before this sign-in happens) and never re-runs when a
    // session newly appears -- confirmed live, no onAuthStateChange
    // listener exists in store.jsx (only RequireAuth.jsx has one, and it
    // doesn't touch the store). For a returning member on a fresh
    // browser/device with no persisted session, that mount-time hydrate
    // found no session yet (fetchRemoteProfileOverrides bails out early
    // when getSession() returns null) and never fetched anything --
    // useAppState()'s value here would still be the local default
    // (false), incorrectly sending a fully onboarded real member back
    // through onboarding. Querying profiles directly with the session we
    // just created sidesteps the race entirely; falls back to the
    // context value only if this query itself fails. member_status hits
    // the exact same race, confirmed live (2026-09-15): a fresh alumni
    // signup landed on the full 5-step onboarding instead of the
    // lightweight alumni flow, since AppStateProvider's own
    // fetchRealMemberStatus() had already resolved to null (no session
    // yet) before this sign-up ever happened. Passed forward via router
    // state rather than waiting on the context value to catch up.
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("onboarding_complete, member_status")
      .eq("id", data.user.id)
      .maybeSingle();
    const isOnboarded = profileRow?.onboarding_complete ?? onboardingComplete;
    const isAlumniAccount = profileRow?.member_status === "alumni";
    const isInternAccount = profileRow?.member_status === "intern";

    // An intern has no Directory record to "confirm" (they're brand new,
    // not on the Directory sheet at all yet) -- skip onboarding entirely
    // and land straight on the one real thing their account can do.
    if (isInternAccount) {
      navigate("/accelerator");
      return;
    }

    navigate(isOnboarded ? redirectTo || "/" : "/onboarding", { state: { isAlumni: isAlumniAccount } });
  }

  function requestAccess() {
    setState(STATE.NOT_ON_ROSTER);
  }

  // Real password recovery -- there was no self-serve path at all before
  // this (grepped the app to confirm), meaning every forgotten password
  // became a manual support request only an admin could resolve. Sends
  // through Supabase's own mailer, same one signup confirmation uses --
  // redirectTo has to be an *exact* URL already on the project's
  // additional_redirect_urls allow-list (see supabase/config.toml), not
  // just any same-origin path.
  async function handleForgotPassword(event) {
    event.preventDefault();
    setForgotError(null);
    setForgotSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotSubmitting(false);
    if (error) {
      setForgotError(error.message);
      return;
    }
    setForgotSent(true);
  }

  // Real insert into access_requests now (2026-09-13) -- admin-reviewable
  // on Admin Dashboard, same pending -> approved/declined shape as
  // feature_requests. Reachable with no session at all since this runs
  // before any account exists for a genuinely new person.
  //
  // Routed through the submit-access-request Edge Function (2026-09-25),
  // not a direct client insert anymore -- the anon-insert RLS policy this
  // used to rely on is gone (see 20260925010000_access_request_rate_limit
  // .sql's own header comment), since a direct insert had no way to apply
  // real IP-based rate limiting. functions.invoke() never throws on a
  // non-2xx response (the error comes back as `error`, with the real body
  // on `error.context`), so the 23505-vs-other-error branch below reads
  // the response body rather than a thrown error's own message.
  async function submitAccessRequest() {
    setRequestSubmitting(true);
    setRequestError(null);
    const { data, error } = await supabase.functions.invoke("submit-access-request", {
      body: { email: email.trim(), name: requestName.trim() || null },
    });
    setRequestSubmitting(false);
    if (error) {
      let message = error.message;
      try {
        const body = await error.context?.json();
        if (body?.error) message = body.error;
      } catch {
        // Non-JSON or unreadable error body -- fall back to error.message.
      }
      setRequestError(message);
      return;
    }
    if (data?.error) {
      setRequestError(data.error);
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

  if (mode === "forgot-password") {
    return (
      <div className="auth">
        <div className="auth__stack">
          <Brand />
          <div className="auth__card">
            <h1 className="auth__title">Reset your password</h1>
            <p className="auth__subtitle">Enter your email and we'll send you a reset link.</p>
            {forgotSent && (
              <p className="auth__note" style={{ color: "var(--color-accent-deep)" }}>
                Check {email} for a reset link. It can take a few minutes to arrive.
              </p>
            )}
            {forgotError && (
              <p className="auth__note" style={{ color: "#B3261E" }}>
                {forgotError}
              </p>
            )}
            <form onSubmit={handleForgotPassword}>
              <div className="field">
                <label htmlFor="forgot-email">Email</label>
                <input
                  id="forgot-email"
                  type="email"
                  placeholder="you@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <button className="btn btn-secondary" type="submit" style={{ width: "100%" }} disabled={forgotSubmitting}>
                {forgotSubmitting ? "Sending…" : "Send reset link"}
              </button>
            </form>
            <div className="auth__footer-links">
              <button
                className="btn-link"
                onClick={() => {
                  setMode("sign-in");
                  setForgotError(null);
                  setForgotSent(false);
                }}
              >
                Back to sign in
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

          {mode === "sign-up" && (
            <p className="auth__note" style={{ marginTop: "var(--space-4)" }}>
              Other members can see your name, photo, and basic profile info, plus anything you post
              to the Feed or share as an interview write-up. Admins see club-wide stats only, never
              your individual application list. Your resume and direct messages stay private.
            </p>
          )}

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
            {mode === "sign-in" && (
              <button className="btn-link" onClick={() => setMode("forgot-password")}>
                Forgot your password?
              </button>
            )}
            <button className="btn-link" onClick={requestAccess}>
              Alumni — request access
            </button>
          </div>
        </div>
        <p className="auth__note">
          Current members sign up using the UC roster; alumni sign up with the email on file in the
          UConsulting Directory; incoming accelerator interns sign up with the email an admin's added
          for them.
        </p>
      </div>
    </div>
  );
}
