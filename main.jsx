import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AppStateProvider } from "./data/store.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { installGlobalErrorReporting } from "./data/errorReporting.js";
import "./styles/tokens.css";
import "./styles/global.css";

installGlobalErrorReporting();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppStateProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AppStateProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
