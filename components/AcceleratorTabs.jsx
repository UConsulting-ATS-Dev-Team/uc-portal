import { NavLink } from "react-router-dom";
import "../styles/accelerator.css";

const TABS = [
  { to: "/accelerator", label: "Overview", end: true },
  { to: "/accelerator/coffee-chats", label: "Coffee chats" },
  { to: "/accelerator/attendance", label: "Attendance" },
  { to: "/accelerator/assignments", label: "Assignments" },
];

// Sub-navigation shared by the four intern accelerator pages.
export default function AcceleratorTabs() {
  return (
    <nav className="accel-tabs" aria-label="Accelerator">
      {TABS.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.end} className={({ isActive }) => `accel-tabs__tab${isActive ? " is-active" : ""}`}>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
