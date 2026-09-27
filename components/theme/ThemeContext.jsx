import { createContext, useCallback, useContext, useEffect, useState } from "react";

// Per-browser preference, same category as data/tours.js's tour-seen
// state or the tour's own reasoning for staying local rather than synced
// -- a theme choice is a device/display preference (a member might
// reasonably want light on a bright office monitor and dark at night on
// a laptop), not an account setting that should follow them everywhere.
const STORAGE_KEY = "uc-portal-theme-mode";
const MEDIA_QUERY = "(prefers-color-scheme: dark)";

function systemPrefersDark() {
  return window.matchMedia(MEDIA_QUERY).matches;
}

function resolveTheme(mode) {
  return mode === "system" ? (systemPrefersDark() ? "dark" : "light") : mode;
}

// The single source of truth for actually applying a resolved theme --
// called both here and by main.jsx's synchronous pre-render bootstrap
// (see that file), so the two can never disagree about how a theme gets
// applied to the DOM.
export function applyTheme(resolved) {
  document.documentElement.setAttribute("data-theme", resolved);
}

export function getInitialMode() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // localStorage unavailable (private window, blocked storage) -- fall
    // through to the system default rather than failing to render.
  }
  return "system";
}

const ThemeCtx = createContext(null);

// Lives high in main.jsx (wrapping the router, alongside AppStateProvider)
// so the toggle is available on every screen, auth or not -- SignIn.jsx
// renders outside NavShell but still needs the theme applied and the
// toggle reachable, per the direct ask ("top corner it's always an
// option"). Does NOT own the *initial* theme application -- that has to
// happen synchronously in main.jsx, before this component (or React at
// all) has mounted, to avoid a real flash of the wrong theme on load;
// this provider's own first effect run is a no-op re-application of
// whatever the bootstrap already set, not the first time it's applied.
export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(getInitialMode);
  const [resolvedTheme, setResolvedTheme] = useState(() => resolveTheme(mode));

  useEffect(() => {
    const resolved = resolveTheme(mode);
    setResolvedTheme(resolved);
    applyTheme(resolved);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Same private-window/blocked-storage case as getInitialMode --
      // the theme still applies for this session, it just won't persist.
    }
  }, [mode]);

  // Live-reacts to the OS theme changing while mode === "system" -- a
  // member on "system" who flips their OS theme (or whose OS switches on
  // a schedule) sees this app follow without touching the toggle again.
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia(MEDIA_QUERY);
    function onChange() {
      const resolved = resolveTheme("system");
      setResolvedTheme(resolved);
      applyTheme(resolved);
    }
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  const setMode = useCallback((next) => setModeState(next), []);

  return <ThemeCtx.Provider value={{ mode, resolvedTheme, setMode }}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  return useContext(ThemeCtx);
}
