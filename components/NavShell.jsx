import TopBar from "./TopBar.jsx";
import NavRail from "./NavRail.jsx";
import "../styles/shell.css";

// Shared shell for every authenticated screen (per CLAUDE.md's Navigation
// shell spec). Auth/onboarding screens render outside this shell.
export default function NavShell({ children }) {
  return (
    <div className="shell">
      <TopBar />
      <div className="shell__body">
        <NavRail />
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
