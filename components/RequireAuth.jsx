import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { supabase } from "../data/supabaseClient.js";
import Skeleton from "./Skeleton.jsx";

// Gate for every authenticated route (see App.jsx). Nothing previously
// checked whether a real Supabase session existed before rendering a
// data-fetching page -- NavShell's own header comment claimed to be "the
// shell for every authenticated screen" but enforced nothing. RLS on
// `jobs` (and most other real tables) correctly requires
// auth.role() = 'authenticated' with no anon grant (see
// supabase/migrations/20260821130000_profiles_and_rls.sql +
// 20260821150000_grants.sql) -- so a signed-out visitor (an expired
// session, a fresh browser/device that never completed sign-in, cleared
// localStorage) landed straight on e.g. Jobs and saw a bare "We couldn't
// load your jobs" 401 with no indication *why* or any path back to sign
// in. This is the missing piece that should have caught that before the
// fetch ever fired, redirecting to /sign-in instead -- and remembering
// where the member was headed so sign-in can return them there.
export default function RequireAuth() {
  const [status, setStatus] = useState("checking"); // "checking" | "authed" | "anon"
  const location = useLocation();

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setStatus(data.session ? "authed" : "anon");
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setStatus(session ? "authed" : "anon");
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  if (status === "checking") {
    return (
      <div style={{ padding: "var(--space-8)" }}>
        <Skeleton lines={4} />
      </div>
    );
  }

  if (status === "anon") {
    return <Navigate to="/sign-in" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
