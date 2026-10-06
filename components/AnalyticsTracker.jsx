import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAppState } from "../data/store.jsx";
import { trackPageView } from "../data/analyticsTracker.js";

// Mounted once inside the signed-in shell: records a page view whenever the route changes. Renders nothing.
export default function AnalyticsTracker() {
  const { pathname } = useLocation();
  const { accountId, realIsAdmin, realMemberStatus } = useAppState();

  useEffect(() => {
    const userType = realIsAdmin ? "admin" : realMemberStatus === "alumni" ? "alumni" : realMemberStatus === "intern" ? "intern" : realMemberStatus ? "member" : null;
    trackPageView({ userId: accountId, userType, pathname });
  }, [pathname, accountId, realIsAdmin, realMemberStatus]);

  return null;
}
