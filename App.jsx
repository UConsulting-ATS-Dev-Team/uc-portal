import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import RequireAuth from "./components/RequireAuth.jsx";
import RequireCurrentMember from "./components/RequireCurrentMember.jsx";
import RequireNotIntern from "./components/RequireNotIntern.jsx";
import NavShell from "./components/NavShell.jsx";
import Skeleton from "./components/Skeleton.jsx";
import Placeholder from "./pages/Placeholder.jsx";
import SignIn from "./pages/SignIn.jsx";
import Jobs from "./pages/Jobs.jsx";
import JobDetail from "./pages/JobDetail.jsx";
import Applications from "./pages/Applications.jsx";
import Network from "./pages/Network.jsx";
import MemberProfile from "./pages/MemberProfile.jsx";
import Feed from "./pages/Feed.jsx";
import Companies from "./pages/Companies.jsx";
import CompanyPage from "./pages/CompanyPage.jsx";
import CareerResources from "./pages/CareerResources.jsx";
import ResourceDetail from "./pages/ResourceDetail.jsx";
import LearningTrackDetail from "./pages/LearningTrackDetail.jsx";
import MyProfile from "./pages/MyProfile.jsx";
import Home from "./pages/Home.jsx";
import Notifications from "./pages/Notifications.jsx";
import GlobalSearch from "./pages/GlobalSearch.jsx";
import Messages from "./pages/Messages.jsx";
import Accelerator from "./pages/Accelerator.jsx";
import NotFound from "./pages/NotFound.jsx";

// Lazy-loaded: every real member hits the routes above on essentially
// every session, but these are each either a one-time flow (Onboarding)
// or Leadership-only (the rest) -- most real members never load this
// code at all. Code-splitting them out of the main bundle means a
// regular member's first load doesn't pay for admin/onboarding-only
// code. Each gets its own Suspense boundary at the route level (not one
// wrapping all of <Routes>) so NavShell -- the nav rail/top bar -- stays
// mounted and stable during the chunk fetch instead of the whole page
// flashing to a fallback.
const Onboarding = lazy(() => import("./pages/Onboarding.jsx"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard.jsx"));
const AdminMembers = lazy(() => import("./pages/AdminMembers.jsx"));
const SourceManagement = lazy(() => import("./pages/SourceManagement.jsx"));
const AdminAccelerator = lazy(() => import("./pages/AdminAccelerator.jsx"));

function LazyPage({ Component }) {
  return (
    <Suspense fallback={<Skeleton lines={4} />}>
      <Component />
    </Suspense>
  );
}

// Each route below is a stub until it's built for real, per the build
// order in CLAUDE.md (shell → auth → onboarding → jobs → job detail →
// tracker, then the rest). Replace a route's element as each screen lands.
export default function App() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignIn />} />
      {/* Alias for the natural, unhyphenated spelling -- every other route
          in the app is a single word (/jobs, /network, /profile, ...);
          /sign-in is the one outlier, so this covers the typo/muscle-memory
          case rather than renaming the canonical route out from under
          anything that already links to it. */}
      <Route path="/signin" element={<SignIn />} />

      {/* Every route below requires a real Supabase session --
          RequireAuth redirects to /sign-in otherwise. See its own header
          comment for why this exists (it didn't, until real jobs/network/
          etc. data started needing `authenticated`-only RLS). */}
      <Route element={<RequireAuth />}>
      {/* Everything below (except /accelerator, /profile, /onboarding)
          is off-limits to an intern account -- redirected to /accelerator
          instead. See components/RequireNotIntern.jsx's own header
          comment. */}
      <Route element={<RequireNotIntern />}>
      {/* Current-member-only routes (active job-searching) -- real alumni
          accounts are redirected to /feed instead. See
          components/RequireCurrentMember.jsx's own header comment. */}
      <Route element={<RequireCurrentMember />}>
      <Route
        path="/"
        element={
          <NavShell>
            <Home />
          </NavShell>
        }
      />
      <Route
        path="/jobs"
        element={
          <NavShell>
            <Jobs />
          </NavShell>
        }
      />
      <Route
        path="/jobs/:jobId"
        element={
          <NavShell>
            <JobDetail />
          </NavShell>
        }
      />
      <Route
        path="/applications"
        element={
          <NavShell>
            <Applications />
          </NavShell>
        }
      />
      </Route>
      <Route
        path="/network"
        element={
          <NavShell>
            <Network />
          </NavShell>
        }
      />
      <Route
        path="/network/:personId"
        element={
          <NavShell>
            <MemberProfile />
          </NavShell>
        }
      />
      <Route
        path="/feed"
        element={
          <NavShell>
            <Feed />
          </NavShell>
        }
      />
      <Route
        path="/companies"
        element={
          <NavShell>
            <Companies />
          </NavShell>
        }
      />
      <Route
        path="/companies/:companyId"
        element={
          <NavShell>
            <CompanyPage />
          </NavShell>
        }
      />
      {/* Real (auto-derived, non-mock) companies route by their real name,
          not a stored slug -- data/realCompanies.js derives their profile
          fresh from real job data on every load, so there's no id to look
          up ahead of time the way mock companies' data/mockCompanies.js ids
          are. See CompanyPage.jsx's own branch on useParams(). */}
      <Route
        path="/companies/real/:companyName"
        element={
          <NavShell>
            <CompanyPage />
          </NavShell>
        }
      />
      <Route element={<RequireCurrentMember />}>
      <Route
        path="/resources"
        element={
          <NavShell>
            <CareerResources />
          </NavShell>
        }
      />
      <Route
        path="/resources/tracks/:trackId"
        element={
          <NavShell>
            <LearningTrackDetail />
          </NavShell>
        }
      />
      <Route
        path="/resources/:resourceId"
        element={
          <NavShell>
            <ResourceDetail />
          </NavShell>
        }
      />
      </Route>
      <Route
        path="/notifications"
        element={
          <NavShell>
            <Notifications />
          </NavShell>
        }
      />
      <Route
        path="/search"
        element={
          <NavShell>
            <GlobalSearch />
          </NavShell>
        }
      />
      <Route
        path="/messages"
        element={
          <NavShell>
            <Messages />
          </NavShell>
        }
      />

      {/* Leadership only — see components/NavRail.jsx for the visibility gate */}
      <Route
        path="/admin"
        element={
          <NavShell>
            <LazyPage Component={AdminDashboard} />
          </NavShell>
        }
      />
      <Route
        path="/admin/opportunities"
        element={
          <NavShell>
            <LazyPage Component={SourceManagement} />
          </NavShell>
        }
      />
      <Route
        path="/admin/members"
        element={
          <NavShell>
            <LazyPage Component={AdminMembers} />
          </NavShell>
        }
      />
      <Route
        path="/admin/content"
        element={
          <NavShell>
            <Placeholder title="Content management" screenId="2h" />
          </NavShell>
        }
      />
      <Route
        path="/admin/accelerator"
        element={
          <NavShell>
            <LazyPage Component={AdminAccelerator} />
          </NavShell>
        }
      />

      </Route>

      {/* Intern-accessible: /accelerator, /profile, /onboarding stay
          outside the RequireNotIntern block above -- an intern's own
          allowed set. */}
      <Route
        path="/accelerator"
        element={
          <NavShell>
            <Accelerator />
          </NavShell>
        }
      />
      <Route
        path="/profile"
        element={
          <NavShell>
            <MyProfile />
          </NavShell>
        }
      />
      <Route path="/onboarding" element={<LazyPage Component={Onboarding} />} />

      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
