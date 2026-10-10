import { Navigate, Outlet } from "react-router-dom";
import { useAppState } from "../data/store.jsx";

// The accelerator pages are for the interns doing the program and the admins running it. Current members and alumni have
// no Accelerator link and are sent home if they type the address. Same "guard the route, don't just hide the link"
// principle as the other Require* guards. While the account's real membership is still loading (null) it renders nothing,
// so an intern is never bounced during that brief window.
export default function RequireInternOrAdmin() {
  const { isIntern, isAdmin, isAlumni, realMemberStatus } = useAppState();
  if (realMemberStatus === null) return null;
  if (isIntern || isAdmin) return <Outlet />;
  return <Navigate to={isAlumni ? "/feed" : "/"} replace />;
}
