import { Navigate, Outlet } from "react-router-dom";
import { useAppState } from "../data/store.jsx";

// Wraps essentially every route except /accelerator, /profile, and
// /onboarding -- an intern account "essentially only has this education
// function until they finish," per direct ask (see CLAUDE.md's dated
// "Intern accounts + accelerator program" entry). NavRail.jsx/
// BottomTabBar.jsx already only show Accelerator/My Profile for an
// intern, but hiding a link doesn't stop a direct/bookmarked/typed URL --
// this is the actual enforcement point, same "guard the route, don't
// just hide the link" principle RequireCurrentMember.jsx already
// established for alumni. isIntern starts false (not yet resolved) until
// the real profiles.member_status fetch completes, same fail-safe
// direction isAlumni/isAdmin already use.
export default function RequireNotIntern() {
  const { isIntern } = useAppState();
  if (isIntern) return <Navigate to="/accelerator" replace />;
  return <Outlet />;
}
