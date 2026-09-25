import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import RequireAuth from "./components/RequireAuth.jsx";
import RequireCurrentMember from "./components/RequireCurrentMember.jsx";
import RequireNotIntern from "./components/RequireNotIntern.jsx";
import NavShell from "./components/NavShell.jsx";
import Skeleton from "./components/Skeleton.jsx";
import Placeholder from "./pages/Placeholder.jsx";
import SignIn from "./pages/SignIn.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import Jobs from "./pages/Jobs.jsx";
import Applications from "./pages/Applications.jsx";
import Network from "./pages/Network.jsx";
import Feed from "./pages/Feed.jsx";
import Companies from "./pages/Companies.jsx";
import CareerResources from "./pages/CareerResources.jsx";
import MyProfile from "./pages/MyProfile.jsx";
import Home from "./pages/Home.jsx";
import Notifications from "./pages/Notifications.jsx";
import Messages from "./pages/Messages.jsx";
import Accelerator from "./pages/Accelerator.jsx";
import NotFound from "./pages/NotFound.jsx";
import { TourProvider } from "./components/tour/TourContext.jsx";
import TourOverlay from "./components/tour/TourOverlay.jsx";

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

// Lazy-loaded for a different reason than the block above (2026-09-25,
// bundle-size pass): not one-time/Leadership-only, but "one click deeper"
// -- a member browsing Jobs/Network/Companies/Career Resources doesn't
// need a specific detail page's code until they actually click into one.
// Unlike Jobs/Applications/Network/Feed/Companies/Career Resources/My
// Profile/Home/Notifications/Messages (every-session nav-rail
// destinations, deliberately kept eager -- see this file's own reasoning
// above), these are the actual heaviest single pages in the app: JobDetail
// eagerly imports RealJobDetail.jsx (the odds model, interview write-ups,
// work-history rail) regardless of which one a real UUID job ends up
// rendering, and MemberProfile eagerly imports RealMemberProfile.jsx the
// same way -- so lazy-loading the route name also defers its real-data
// sibling, not just the thin dispatcher.
const JobDetail = lazy(() => import("./pages/JobDetail.jsx"));
const MemberProfile = lazy(() => import("./pages/MemberProfile.jsx"));
const CompanyPage = lazy(() => import("./pages/CompanyPage.jsx"));
const ResourceDetail = lazy(() => import("./pages/ResourceDetail.jsx"));
const LearningTrackDetail = lazy(() => import("./pages/LearningTrackDetail.jsx"));
const GlobalSearch = lazy(() => import("./pages/GlobalSearch.jsx"));

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
    <TourProvider>
      <AppRoutes />
      <TourOverlay />
    </TourProvider>
  );
}

// Split out so TourProvider (which needs useNavigate/useLocation) wraps
// <Routes> from the outside rather than resetting on every navigation --
// each route's element is a fresh subtree per match (NavShell included),
// so any provider that needs to survive across pages has to live above
// <Routes>, not inside any one route's own element.
function AppRoutes() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignIn />} />
      {/* Alias for the natural, unhyphenated spelling -- every other route
          in the app is a single word (/jobs, /network, /profile, ...);
          /sign-in is the one outlier, so this covers the typo/muscle-memory
          case rather than renaming the canonical route out from under
          anything that already links to it. */}
      <Route path="/signin" element={<SignIn />} />
      <Route path="/reset-password" element={<ResetPassword />} />

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
            <LazyPage Component={JobDetail} />
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
            <LazyPage Component={MemberProfile} />
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
            <LazyPage Component={CompanyPage} />
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
            <LazyPage Component={CompanyPage} />
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
            <LazyPage Component={LearningTrackDetail} />
          </NavShell>
        }
      />
      <Route
        path="/resources/:resourceId"
        element={
          <NavShell>
            <LazyPage Component={ResourceDetail} />
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
            <LazyPage Component={GlobalSearch} />
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
