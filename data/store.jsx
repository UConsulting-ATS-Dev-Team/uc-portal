import { createContext, useContext, useEffect, useState } from "react";

// Prototype-wide shared state (career preferences, onboarding progress,
// and later: saved jobs, tracker stage, etc.) -- persisted to
// localStorage since there's no backend. This is what lets onboarding
// answers actually show up later on My Profile / Jobs.
const STORAGE_KEY = "uc-portal-state";

// Seeded so the tracker (1f/1g/1j) has cards across most stages on first
// load instead of looking empty -- real usage adds more via "Add to
// tracker" / "Mark interested" on Job detail.
const SEED_TRACKED_JOBS = {
  "bain-consulting-intern": { stage: "First round", addedAt: "2026-08-05T12:00:00.000Z" },
  "mckinsey-generalist-intern": { stage: "Preparing", addedAt: "2026-08-10T12:00:00.000Z" },
  "deloitte-human-capital": { stage: "Applied", addedAt: "2026-08-12T12:00:00.000Z" },
  "goldman-ibd-summer": { stage: "Assessment", addedAt: "2026-08-08T12:00:00.000Z" },
  "stripe-strategy-ops": { stage: "Interested", addedAt: "2026-08-15T12:00:00.000Z" },
  "bcg-summer-associate": { stage: "Final round", addedAt: "2026-08-01T12:00:00.000Z" },
  "accenture-strategy-fulltime": { stage: "Closed", addedAt: "2026-07-20T12:00:00.000Z" },
};

// Seeded so Network's "Your coffee chats" isn't empty on first load --
// real requests (via "Request coffee chat") add "Request sent" entries.
const SEED_COFFEE_CHATS = {
  "marcus-webb": "Confirmed · Wed 4:00pm",
  "priya-nair": "Follow-up due",
};

const DEFAULT_STATE = {
  onboardingComplete: false,
  savedJobIds: [],
  trackedJobs: SEED_TRACKED_JOBS, // { [jobId]: { stage, addedAt } } -- stage taxonomy matches the Applications tracker (1f/1g/1j)
  prepLogged: {}, // { [jobId]: extraHoursLogged } -- feeds the odds model's "Preparation logged" factor
  coffeeChatStatus: SEED_COFFEE_CHATS, // { [personId]: status label } -- Network (1h) "Your coffee chats"
  savedConnections: [], // personIds saved via Member profile's "Save to my network"
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

  function addToTracker(jobId, stage = "Interested") {
    setState((prev) => {
      if (prev.trackedJobs[jobId]) return prev; // don't downgrade an existing stage
      return {
        ...prev,
        trackedJobs: { ...prev.trackedJobs, [jobId]: { stage, addedAt: new Date().toISOString() } },
      };
    });
  }

  function logPrep(jobId, hours = 2) {
    setState((prev) => ({
      ...prev,
      prepLogged: { ...prev.prepLogged, [jobId]: (prev.prepLogged[jobId] || 0) + hours },
    }));
  }

  function updateApplicationStage(jobId, stage) {
    setState((prev) => ({
      ...prev,
      trackedJobs: { ...prev.trackedJobs, [jobId]: { ...prev.trackedJobs[jobId], stage } },
    }));
  }

  function requestCoffeeChat(personId) {
    setState((prev) => {
      if (prev.coffeeChatStatus[personId]) return prev; // don't overwrite an existing status
      return { ...prev, coffeeChatStatus: { ...prev.coffeeChatStatus, [personId]: "Request sent" } };
    });
  }

  function toggleSavedConnection(personId) {
    setState((prev) => ({
      ...prev,
      savedConnections: prev.savedConnections.includes(personId)
        ? prev.savedConnections.filter((id) => id !== personId)
        : [...prev.savedConnections, personId],
    }));
  }

  return (
    <AppStateContext.Provider
      value={{
        ...state,
        updatePreferences,
        completeOnboarding,
        toggleSavedJob,
        addToTracker,
        logPrep,
        updateApplicationStage,
        requestCoffeeChat,
        toggleSavedConnection,
      }}
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
