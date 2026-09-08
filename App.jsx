import { Routes, Route } from "react-router-dom";
import RequireAuth from "./components/RequireAuth.jsx";
import NavShell from "./components/NavShell.jsx";
import Placeholder from "./pages/Placeholder.jsx";
import SignIn from "./pages/SignIn.jsx";
import Onboarding from "./pages/Onboarding.jsx";
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
import AdminDashboard from "./pages/AdminDashboard.jsx";
import SourceManagement from "./pages/SourceManagement.jsx";
import Home from "./pages/Home.jsx";
import Notifications from "./pages/Notifications.jsx";
import GlobalSearch from "./pages/GlobalSearch.jsx";
import Messages from "./pages/Messages.jsx";
import NotFound from "./pages/NotFound.jsx";

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
      <Route
        path="/profile"
        element={
          <NavShell>
            <MyProfile />
          </NavShell>
        }
      />
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
      <Route path="/onboarding" element={<Onboarding />} />

      {/* Leadership only — see components/NavRail.jsx for the visibility gate */}
      <Route
        path="/admin"
        element={
          <NavShell>
            <AdminDashboard />
          </NavShell>
        }
      />
      <Route
        path="/admin/opportunities"
        element={
          <NavShell>
            <SourceManagement />
          </NavShell>
        }
      />
      <Route
        path="/admin/members"
        element={
          <NavShell>
            <Placeholder title="Members" screenId="2h" />
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

      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
