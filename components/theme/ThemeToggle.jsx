import { Monitor, Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeContext.jsx";
import "../../styles/themeToggle.css";

const OPTIONS = [
  { mode: "system", label: "Use system theme", icon: Monitor },
  { mode: "light", label: "Light mode", icon: Sun },
  { mode: "dark", label: "Dark mode", icon: Moon },
];

// Always-available system/light/dark control -- direct ask ("top corner
// it's always an option"). Rendered in both TopBar.jsx (every
// authenticated screen) and SignIn.jsx's own header (pre-auth screens,
// which render outside NavShell) rather than added as a nav-rail item,
// matching how Notifications/Messages/the avatar menu are already
// reachable from anywhere via the top bar, not the rail.
export default function ThemeToggle() {
  const theme = useTheme();
  if (!theme) return null; // defensive -- always mounted under ThemeProvider in practice
  const { mode, setMode } = theme;

  return (
    <div className="theme-toggle" role="group" aria-label="Theme mode">
      {OPTIONS.map(({ mode: optionMode, label, icon: Icon }) => (
        <button
          key={optionMode}
          type="button"
          className={`theme-toggle__option${mode === optionMode ? " is-active" : ""}`}
          aria-label={label}
          aria-pressed={mode === optionMode}
          title={label}
          onClick={() => setMode(optionMode)}
        >
          <Icon size={15} strokeWidth={1.5} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
