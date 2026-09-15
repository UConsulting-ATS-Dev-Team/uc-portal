import { Navigate, Outlet } from "react-router-dom";
import { useAppState } from "../data/store.jsx";

// Wraps routes that are specifically about active job-searching (Home's
// recruiting dashboard, Jobs, Applications tracker, Career Resources) --
// real alumni accounts get a Feed/Network-focused experience instead (see
// CLAUDE.md's dated "Real alumni accounts" entry). NavRail.jsx/
// BottomTabBar.jsx already hide these from the nav for an alumni, but
// hiding a link doesn't stop a direct/bookmarked/typed URL -- this is the
// actual enforcement point, same "guard the route, don't just hide the
// link" principle RequireAuth.jsx already established for signed-out
// visitors. isAlumni starts false (not yet resolved) until the real
// profiles.member_status fetch completes, same fail-safe direction
// isAdmin already uses -- so this never redirects a real current member
// away during that brief window, only once alumni status is confirmed.
export default function RequireCurrentMember() {
  const { isAlumni } = useAppState();
  if (isAlumni) return <Navigate to="/feed" replace />;
  return <Outlet />;
}
