import { supabase } from "./supabaseClient.js";

// Records one row per signed-in page view in our own database (analytics_events). No third-party tracker, nothing leaves the
// project, and a failure here is silent: analytics must never get in the way of using the portal.

const SESSION_KEY = "uc-portal-analytics-session";
let lastPath = null;
let lastAt = 0;

function sessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

// /jobs/5e1f... -> /jobs/:id, so the top-pages list groups by page, not by individual job or person. Query strings never count.
export function normalizePath(pathname) {
  return pathname.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id").replace(/\/+$/, "") || "/";
}

// userType is the account's real type (an admin looking at the site "as" an intern is still an admin).
export function trackPageView({ userId, userType, pathname }) {
  if (!userId || !userType) return;
  const path = normalizePath(pathname);
  const now = Date.now();
  if (path === lastPath && now - lastAt < 2000) return; // a double render, not a second visit
  lastPath = path;
  lastAt = now;
  supabase
    .from("analytics_events")
    .insert({ user_id: userId, user_type: userType, event: "page_view", path, session_id: sessionId() })
    .then(() => {}, () => {});
}
