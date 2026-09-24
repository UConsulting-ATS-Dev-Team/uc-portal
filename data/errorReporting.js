import { supabase } from "./supabaseClient.js";

// Self-hosted crash/error reporting -- see the client_error_reports
// migration's own header comment for why this is a real table here rather
// than a third-party service. Every call site wraps this in nothing extra
// -- reportClientError itself must never throw, or an error-reporting call
// made *while already handling an error* (componentDidCatch, a global
// window.onerror handler) could mask the original crash with a second one.
export async function reportClientError({ message, stack, context = "unknown" }) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    await supabase.from("client_error_reports").insert({
      message: String(message ?? "Unknown error").slice(0, 2000),
      stack: stack ? String(stack).slice(0, 8000) : null,
      page_path: `${window.location.pathname}${window.location.search}`,
      user_agent: navigator.userAgent,
      context,
      account_id: session?.user?.id ?? null,
    });
  } catch {
    // Reporting the error failed too -- nothing more to do without risking
    // an infinite loop of error-about-an-error.
  }
}

// Catches what a React error boundary can't: errors thrown outside the
// render tree (event handlers after the initial render already committed,
// timers, real async failures) and rejected promises nobody awaited.
// Called once from main.jsx.
export function installGlobalErrorReporting() {
  window.addEventListener("error", (event) => {
    reportClientError({
      message: event.message,
      stack: event.error?.stack,
      context: "window_error",
    });
  });
  window.addEventListener("unhandledrejection", (event) => {
    reportClientError({
      message: event.reason?.message ?? String(event.reason),
      stack: event.reason?.stack,
      context: "unhandled_rejection",
    });
  });
}
