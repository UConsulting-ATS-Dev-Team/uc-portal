import { Link } from "react-router-dom";
import "../styles/auth.css";

// Catch-all for any unmatched route -- e.g. a mistyped URL or a stale
// bookmark ("/signin" instead of the real "/sign-in", both routed here
// this same session). Outside NavShell like /sign-in and /onboarding,
// since a bad URL can be hit before there's any authenticated session to
// build a nav shell around. Follows the 3e empty-state pattern from
// CLAUDE.md: name the situation, explain why, one primary + one
// secondary action -- never a bare "Not found."
function Brand() {
  return (
    <div className="auth__brand">
      <span className="auth__wordmark">UC Portal</span>
    </div>
  );
}

export default function NotFound() {
  return (
    <div className="auth">
      <div className="auth__stack">
        <Brand />
        <div className="auth__card">
          <h1 className="auth__title">Page not found</h1>
          <p className="auth__subtitle">
            There's no page at this address — it may be mistyped or an old
            bookmark to a link that's since changed.
          </p>
          <div className="auth__actions">
            <Link className="btn btn-primary" to="/">
              Go to Home
            </Link>
            <Link className="btn btn-secondary" to="/sign-in">
              Go to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
