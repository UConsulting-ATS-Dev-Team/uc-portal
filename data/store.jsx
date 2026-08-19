import { createContext, useContext, useEffect, useState } from "react";

// Prototype-wide shared state (career preferences, onboarding progress,
// and later: saved jobs, tracker stage, etc.) -- persisted to
// localStorage since there's no backend. This is what lets onboarding
// answers actually show up later on My Profile / Jobs.
const STORAGE_KEY = "uc-portal-state";

// Seeded so the tracker (1f/1g/1j) has cards across most stages on first
// load instead of looking empty -- real usage adds more via "Add to
// tracker" / "Mark interested" on Job detail. stageHistory records when
// each stage was entered -- required for the Timeline view (1j) to draw
// real per-stage bars rather than a single blob; addToTracker/
// updateApplicationStage append to it going forward the same way.
const SEED_TRACKED_JOBS = {
  "bain-consulting-intern": {
    stage: "First round",
    addedAt: "2026-08-05T12:00:00.000Z",
    stageHistory: [
      { stage: "Interested", date: "2026-08-05T12:00:00.000Z" },
      { stage: "Preparing", date: "2026-08-07T12:00:00.000Z" },
      { stage: "Applied", date: "2026-08-10T12:00:00.000Z" },
      { stage: "Assessment", date: "2026-08-13T12:00:00.000Z" },
      { stage: "First round", date: "2026-08-16T12:00:00.000Z" },
    ],
  },
  "mckinsey-generalist-intern": {
    stage: "Preparing",
    addedAt: "2026-08-10T12:00:00.000Z",
    stageHistory: [
      { stage: "Interested", date: "2026-08-10T12:00:00.000Z" },
      { stage: "Preparing", date: "2026-08-12T12:00:00.000Z" },
    ],
  },
  "deloitte-human-capital": {
    stage: "Applied",
    addedAt: "2026-08-12T12:00:00.000Z",
    stageHistory: [
      { stage: "Interested", date: "2026-08-12T12:00:00.000Z" },
      { stage: "Preparing", date: "2026-08-13T12:00:00.000Z" },
      { stage: "Applied", date: "2026-08-15T12:00:00.000Z" },
    ],
  },
  "goldman-ibd-summer": {
    stage: "Assessment",
    addedAt: "2026-08-08T12:00:00.000Z",
    stageHistory: [
      { stage: "Interested", date: "2026-08-08T12:00:00.000Z" },
      { stage: "Preparing", date: "2026-08-09T12:00:00.000Z" },
      { stage: "Applied", date: "2026-08-11T12:00:00.000Z" },
      { stage: "Assessment", date: "2026-08-14T12:00:00.000Z" },
    ],
  },
  "stripe-strategy-ops": {
    stage: "Interested",
    addedAt: "2026-08-15T12:00:00.000Z",
    stageHistory: [{ stage: "Interested", date: "2026-08-15T12:00:00.000Z" }],
  },
  "bcg-summer-associate": {
    stage: "Final round",
    addedAt: "2026-08-01T12:00:00.000Z",
    stageHistory: [
      { stage: "Interested", date: "2026-08-01T12:00:00.000Z" },
      { stage: "Preparing", date: "2026-08-03T12:00:00.000Z" },
      { stage: "Applied", date: "2026-08-06T12:00:00.000Z" },
      { stage: "Assessment", date: "2026-08-09T12:00:00.000Z" },
      { stage: "First round", date: "2026-08-12T12:00:00.000Z" },
      { stage: "Final round", date: "2026-08-17T12:00:00.000Z" },
    ],
  },
  "accenture-strategy-fulltime": {
    stage: "Closed",
    addedAt: "2026-07-20T12:00:00.000Z",
    stageHistory: [
      { stage: "Interested", date: "2026-07-20T12:00:00.000Z" },
      { stage: "Preparing", date: "2026-07-22T12:00:00.000Z" },
      { stage: "Applied", date: "2026-07-25T12:00:00.000Z" },
      { stage: "Closed", date: "2026-08-01T12:00:00.000Z" },
    ],
  },
};

// Seeded so Network's "Your coffee chats" isn't empty on first load --
// real requests (via "Request coffee chat") add "Request sent" entries.
const SEED_COFFEE_CHATS = {
  "marcus-webb": "Confirmed · Wed 4:00pm",
  "priya-nair": "Follow-up due",
};

// Admin Dashboard (2h) opportunity review queue -- member/alumni-submitted
// postings awaiting Careers Committee approval before they'd go live.
const SEED_OPPORTUNITY_QUEUE = [
  { id: "queue-1", company: "Bridgewater Associates", role: "Investment Analyst Intern", source: "Alumni post", status: "Needs review", applicants: 0 },
  { id: "queue-2", company: "Deloitte", role: "Strategy Consulting Intern", source: "Member submitted", status: "Needs review", applicants: 0 },
  { id: "queue-3", company: "Amazon", role: "Product Manager Intern", source: "Feed import", status: "Live", applicants: 6 },
  { id: "queue-4", company: "Roland Berger", role: "Summer Associate", source: "Alumni post", status: "Expired", applicants: 2 },
];

const DEFAULT_STATE = {
  onboardingComplete: false,
  savedJobIds: [],
  trackedJobs: SEED_TRACKED_JOBS, // { [jobId]: { stage, addedAt, stageHistory } } -- stage taxonomy matches the Applications tracker (1f/1g/1j)
  timelineShiftDays: {}, // { [jobId]: days } -- manual reschedule from dragging a projected bar on the Timeline view (1j)
  prepLogged: {}, // { [jobId]: extraHoursLogged } -- feeds the odds model's "Preparation logged" factor
  coffeeChatStatus: SEED_COFFEE_CHATS, // { [personId]: status label } -- Network (1h) "Your coffee chats"
  savedConnections: [], // personIds saved via Member profile's "Save to my network"
  savedResourceIds: [], // Career Resources (2d) "My saved"
  resourceProgress: { "case-guide-1": [0, 1] }, // { [resourceId]: completed section indexes } -- seeded so the library isn't empty on first load
  trackProgress: { "case-interview-track": 3 }, // { [trackId]: completed step count } -- matches the wireframe's own "3 of 12" example
  opportunityQueue: SEED_OPPORTUNITY_QUEUE, // Admin Dashboard (2h) review queue
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
    opportunityType: "Internship", // "Internship" | "Full-time" | "Both" -- set on My Profile (2g), not collected in onboarding
    compTarget: 35, // $/hr -- feeds Job detail's match checklist compensation check
    recruitingSettings: {
      showOutsideTargetLocations: true,
      letAlumniSeeRecruiting: true,
      prioritizeUcConnections: true,
      openToCoffeeChatRequests: false,
      shareOutcomesAnonymized: true,
      includeInExecReporting: true,
    },
  },
  profileOverrides: {
    linkedIn: "",
    resumeFileName: null,
  },
  profileLastUpdated: "2026-08-02T12:00:00.000Z",
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const saved = JSON.parse(raw);
    // Shallow-merge at the top level, but preferences/profileOverrides are
    // merged one level deeper too -- otherwise a session saved before a new
    // preference field existed (e.g. compTarget, recruitingSettings) would
    // silently lose that field forever, since the saved sub-object would
    // fully overwrite DEFAULT_STATE's.
    return {
      ...DEFAULT_STATE,
      ...saved,
      preferences: {
        ...DEFAULT_STATE.preferences,
        ...saved.preferences,
        recruitingSettings: {
          ...DEFAULT_STATE.preferences.recruitingSettings,
          ...saved.preferences?.recruitingSettings,
        },
      },
      profileOverrides: { ...DEFAULT_STATE.profileOverrides, ...saved.profileOverrides },
    };
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

  function updateRecruitingSetting(key, value) {
    setState((prev) => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        recruitingSettings: { ...prev.preferences.recruitingSettings, [key]: value },
      },
    }));
  }

  function updateProfileOverrides(patch) {
    setState((prev) => ({ ...prev, profileOverrides: { ...prev.profileOverrides, ...patch } }));
  }

  function touchProfileUpdated() {
    setState((prev) => ({ ...prev, profileLastUpdated: new Date().toISOString() }));
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
      const now = new Date().toISOString();
      return {
        ...prev,
        trackedJobs: { ...prev.trackedJobs, [jobId]: { stage, addedAt: now, stageHistory: [{ stage, date: now }] } },
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
    setState((prev) => {
      const existing = prev.trackedJobs[jobId];
      const history = existing.stageHistory || [];
      return {
        ...prev,
        trackedJobs: {
          ...prev.trackedJobs,
          [jobId]: { ...existing, stage, stageHistory: [...history, { stage, date: new Date().toISOString() }] },
        },
      };
    });
  }

  function shiftTimeline(jobId, deltaDays) {
    setState((prev) => ({
      ...prev,
      timelineShiftDays: { ...prev.timelineShiftDays, [jobId]: (prev.timelineShiftDays[jobId] || 0) + deltaDays },
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

  function toggleSavedResource(resourceId) {
    setState((prev) => ({
      ...prev,
      savedResourceIds: prev.savedResourceIds.includes(resourceId)
        ? prev.savedResourceIds.filter((id) => id !== resourceId)
        : [...prev.savedResourceIds, resourceId],
    }));
  }

  function toggleResourceSection(resourceId, sectionIndex) {
    setState((prev) => {
      const done = prev.resourceProgress[resourceId] || [];
      const next = done.includes(sectionIndex) ? done.filter((i) => i !== sectionIndex) : [...done, sectionIndex];
      return { ...prev, resourceProgress: { ...prev.resourceProgress, [resourceId]: next } };
    });
  }

  function advanceTrackStep(trackId, totalSteps) {
    setState((prev) => {
      const current = prev.trackProgress[trackId] || 0;
      if (current >= totalSteps) return prev;
      return { ...prev, trackProgress: { ...prev.trackProgress, [trackId]: current + 1 } };
    });
  }

  function approveOpportunity(id) {
    setState((prev) => ({
      ...prev,
      opportunityQueue: prev.opportunityQueue.map((o) => (o.id === id ? { ...o, status: "Live", applicants: 0 } : o)),
    }));
  }

  function removeOpportunity(id) {
    setState((prev) => ({ ...prev, opportunityQueue: prev.opportunityQueue.filter((o) => o.id !== id) }));
  }

  return (
    <AppStateContext.Provider
      value={{
        ...state,
        updatePreferences,
        updateRecruitingSetting,
        updateProfileOverrides,
        touchProfileUpdated,
        completeOnboarding,
        toggleSavedJob,
        addToTracker,
        logPrep,
        updateApplicationStage,
        shiftTimeline,
        requestCoffeeChat,
        toggleSavedConnection,
        toggleSavedResource,
        toggleResourceSection,
        advanceTrackStep,
        approveOpportunity,
        removeOpportunity,
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
