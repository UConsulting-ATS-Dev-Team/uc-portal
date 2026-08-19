import { createContext, useContext, useEffect, useState } from "react";

// Prototype-wide shared state (career preferences, onboarding progress,
// and later: saved jobs, tracker stage, etc.) -- persisted to
// localStorage since there's no backend. This is what lets onboarding
// answers actually show up later on My Profile / Jobs.
const STORAGE_KEY = "uc-portal-state";

const DEFAULT_STATE = {
  onboardingComplete: false,
  savedJobIds: [],
  preferences: {
    industries: [], // ranked array of industry names, max 3
    roles: [], // max 5
    locations: [],
    openToRelocating: false,
    remoteOrHybridOnly: false,
    followedCompanies: [],
    recruitingCycle: null,
    helpNeeded: [],
    remindersEnabled: true,
    resumeAttached: false,
  },
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_STATE;
  }
}

const AppStateContext = createContext(null);

export function AppStateProvider({ children }) {
  const [state, setState] = useState(loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  function updatePreferences(patch) {
    setState((prev) => ({ ...prev, preferences: { ...prev.preferences, ...patch } }));
  }

  function completeOnboarding() {
    setState((prev) => ({ ...prev, onboardingComplete: true }));
  }

  function toggleSavedJob(jobId) {
    setState((prev) => ({
      ...prev,
      savedJobIds: prev.savedJobIds.includes(jobId)
        ? prev.savedJobIds.filter((id) => id !== jobId)
        : [...prev.savedJobIds, jobId],
    }));
  }

  return (
    <AppStateContext.Provider
      value={{ ...state, updatePreferences, completeOnboarding, toggleSavedJob }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
