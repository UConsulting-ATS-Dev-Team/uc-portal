import TopBar from "./TopBar.jsx";
import NavRail from "./NavRail.jsx";
import BottomTabBar from "./BottomTabBar.jsx";
import "../styles/shell.css";

// Shared shell for every authenticated screen (per CLAUDE.md's Navigation
// shell spec). Auth/onboarding screens render outside this shell.
//
// BottomTabBar always renders alongside NavRail -- which one actually
// shows is a pure CSS split at the 640px phone tier (styles/shell.css),
// same pattern as every other phone-UX fix this pass (e.g. Jobs.jsx's
// filter toggle): no viewport-width JS check here, just two components
// that are each other's mutually-exclusive CSS visibility.
export default function NavShell({ children }) {
  return (
    <div className="shell">
      <TopBar />
      <div className="shell__body">
        <NavRail />
        <main className="content">{children}</main>
      </div>
      <BottomTabBar />
    </div>
  );
}
