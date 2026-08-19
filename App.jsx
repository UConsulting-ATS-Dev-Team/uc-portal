import { Routes, Route } from "react-router-dom";
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

// Each route below is a stub until it's built for real, per the build
// order in CLAUDE.md (shell → auth → onboarding → jobs → job detail →
// tracker, then the rest). Replace a route's element as each screen lands.
export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <NavShell>
            <Placeholder title="Home / Career Dashboard" screenId="1a" />
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
            <Placeholder title="Career Resources" screenId="2d" />
          </NavShell>
        }
      />
      <Route
        path="/profile"
        element={
          <NavShell>
            <Placeholder title="My Profile" screenId="2g" />
          </NavShell>
        }
      />
      <Route
        path="/notifications"
        element={
          <NavShell>
            <Placeholder title="Notifications" screenId="2f" />
          </NavShell>
        }
      />
      <Route
        path="/search"
        element={
          <NavShell>
            <Placeholder title="Search results" screenId="3b" />
          </NavShell>
        }
      />
      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/onboarding" element={<Onboarding />} />

      {/* Leadership only — see components/NavRail.jsx for the visibility gate */}
      <Route
        path="/admin"
        element={
          <NavShell>
            <Placeholder title="Admin Dashboard" screenId="2h" />
          </NavShell>
        }
      />
      <Route
        path="/admin/opportunities"
        element={
          <NavShell>
            <Placeholder title="Opportunities queue" screenId="2h" />
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
    </Routes>
  );
}
