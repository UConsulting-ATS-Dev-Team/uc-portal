import { Navigate, Outlet } from "react-router-dom";
import { useAppState } from "../data/store.jsx";

// Wraps every /admin/* route -- previously relied entirely on NavRail.jsx
// hiding the Leadership links, with no actual route-level enforcement at
// all (a non-admin member typing /admin directly landed on the page and
// just saw it fail/empty out against each admin RPC's own is_admin()
// check). Same "guard the route, don't just hide the link" principle
// RequireCurrentMember.jsx/RequireNotIntern.jsx already established for
// alumni/interns. Also what makes the real admin "view as" simulation
// (components/ViewAsMenu.jsx) actually work end-to-end: isAdmin turning
// false while simulating now immediately bounces away from any /admin/*
// page instead of leaving real admin content on screen underneath a
// supposedly-simulated non-admin view.
export default function RequireAdmin() {
  const { isAdmin, realRole } = useAppState();
  // Unlike RequireCurrentMember/RequireNotIntern (whose redirect condition
  // defaults to false during the brief pre-fetch window, which already
  // means "don't redirect"), this guard's default direction is inverted --
  // isAdmin defaulting to false would otherwise bounce a genuine admin
  // away from /admin on every fresh load, before realRole has even
  // resolved. realRole === null means "not yet known," not "not admin."
  if (realRole === null) return null;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
}
