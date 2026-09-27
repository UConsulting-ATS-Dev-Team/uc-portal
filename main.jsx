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
