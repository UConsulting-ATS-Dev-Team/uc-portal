import { Component } from "react";
import { reportClientError } from "../data/errorReporting.js";

// Top-level crash net -- wraps <App /> in main.jsx. Without this, any
// render-time throw (a null-pointer on some edge-case real data, etc.)
// white-screens the whole app with React's own bare error output and no
// way back except the browser's own reload button -- the worst possible
// failure mode live, in front of the club. Must be a class component;
// React only supports error boundaries via getDerivedStateFromError/
// componentDidCatch, no hook equivalent exists.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    reportClientError({
      message: error?.message,
      stack: error?.stack ?? info?.componentStack,
      context: "error_boundary",
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="empty-state" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <h1>Something went wrong</h1>
          <p>This page hit an unexpected error. Reloading usually fixes it -- if it keeps happening, let Exec know.</p>
          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "center", marginTop: "var(--space-5)" }}>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
