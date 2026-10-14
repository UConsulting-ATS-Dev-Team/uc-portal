import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AppStateProvider } from "./data/store.jsx";
import { ThemeProvider, applyTheme, getInitialMode } from "./components/theme/ThemeContext.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { installGlobalErrorReporting } from "./data/errorReporting.js";
import "./styles/tokens.css";
import "./styles/global.css";

installGlobalErrorReporting();

// A tab left open across a deploy still points at the old page files, which no longer exist, so opening a page fails with
// "Failed to fetch dynamically imported module". Reload once to pick up the new build instead of showing the error screen;
// the stamp stops a reload loop if the files are genuinely unreachable.
window.addEventListener("vite:preloadError", (event) => {
  try {
    const last = Number(sessionStorage.getItem("uc-preload-reload") ?? 0);
    if (Date.now() - last < 30000) return;
    sessionStorage.setItem("uc-preload-reload", String(Date.now()));
  } catch {
    return;
  }
  event.preventDefault();
  window.location.reload();
});

// Applied synchronously here, before React even mounts, so there's no
// flash of the wrong theme on load -- ThemeProvider's own first effect
// (inside the render below) re-applies the same result, which is a
// no-op, not the first real application.
const initialMode = getInitialMode();
applyTheme(initialMode === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : initialMode);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <AppStateProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AppStateProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
