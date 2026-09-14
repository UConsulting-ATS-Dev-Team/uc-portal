import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { fetchRemotePreferences, syncPreferencesToRemote } from "./memberPreferencesSync.js";
import { fetchRemoteTrackedApplications, syncTrackedApplicationToRemote } from "./trackerSync.js";
import { fetchRemoteNetworkConnections, syncNetworkConnectionToRemote } from "./networkSync.js";
import { fetchRemoteSavedJobs, syncSavedJobToRemote } from "./savedJobsSync.js";
import { fetchRealRole } from "./profileRoleSync.js";
import { fetchRemoteProfileOverrides, syncProfileOverridesToRemote } from "./profileOverridesSync.js";
import { fetchDirectoryPrefill } from "./directoryPrefillSync.js";

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
    // The one seeded application already at Closed gets a real outcome so
    // the Board/Table demo the "recorded" rendering, not just the "Record
    // outcome" prompt -- see data/trackerUtils.js's OUTCOMES for the four
    // real values this field can hold.
    outcome: "offer",
  },
};

// Exported so Applications tracker views can flag these specific 7 cards
// as demo data (components/DemoDataBadge.jsx) -- a real member's own
// tracked applications sit in the exact same list with no visual
// distinction otherwise, which a supervisor reviewing the app could
// easily mistake for real activity.
export const SEED_TRACKED_JOB_IDS = Object.keys(SEED_TRACKED_JOBS);

// Seeded so Network's "Your coffee chats" isn't empty on first load --
// real requests (via "Request coffee chat") add "Request sent" entries.
const SEED_COFFEE_CHATS = {
  "marcus-webb": "Confirmed · Wed 4:00pm",
  "priya-nair": "Follow-up due",
};
export const SEED_COFFEE_CHAT_IDS = Object.keys(SEED_COFFEE_CHATS);

const DEFAULT_STATE = {
  onboardingComplete: false,
  recentSearches: [], // Global search (3b) -- most recent first, capped at 5
  savedSearches: [], // Jobs board (1d) "Save this search" -- { id, label, filters, savedAt }[], most recent first
  savedJobIds: [],
  trackedJobs: SEED_TRACKED_JOBS, // { [jobId]: { stage, addedAt, stageHistory } } -- stage taxonomy matches the Applications tracker (1f/1g/1j)
  timelineShiftDays: {}, // { [jobId]: days } -- manual reschedule from dragging a projected bar on the Timeline view (1j)
  prepLogged: {}, // { [jobId]: extraHoursLogged } -- feeds the odds model's "Preparation logged" factor
  coffeeChatStatus: SEED_COFFEE_CHATS, // { [personId]: status label } -- Network (1h) "Your coffee chats"
  savedConnections: [], // personIds saved via Member profile's "Save to my network"
  savedResourceIds: [], // Career Resources (2d) "My saved"
  resourceProgress: { "case-guide-1": [0, 1] }, // { [resourceId]: completed section indexes } -- seeded so the library isn't empty on first load
  trackProgress: { "case-interview-track": 3 }, // { [trackId]: completed step count } -- matches the wireframe's own "3 of 12" example
  preferences: {
    industries: [], // ranked array of industry names, max 3
    roles: [], // max 5
    skills: [], // Part 10/US-26 -- set on My Profile (2g), not collected in onboarding, same as opportunityType/compTarget below
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
    fullName: "",
    classYear: null,
    majors: "",
    ucCommittee: "",
    linkedIn: "",
    resumeFileName: null,
  },
  profileLastUpdated: "2026-08-02T12:00:00.000Z",
  notificationSettings: {
    deadlineReminders: true,
    newMatchedJobs: true,
    alumniReplies: true,
    allFeedActivity: false,
    weeklyDigest: true,
  },
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
      notificationSettings: { ...DEFAULT_STATE.notificationSettings, ...saved.notificationSettings },
    };
  } catch {
    return DEFAULT_STATE;
  }
}

const AppStateContext = createContext(null);

export function AppStateProvider({ children }) {
  const [state, setState] = useState(loadState);
  const [hydratedFromRemote, setHydratedFromRemote] = useState(false);
  // The real signed-in member's real profiles.role -- not part of `state`
  // (never persisted to localStorage or the mock-data blob; it's live
  // auth-derived data, re-fetched fresh each session). Replaces the fully
  // disconnected data/mockUser.js#currentUser.role NavRail.jsx/
  // BottomTabBar.jsx used to gate the Leadership nav section on, which
  // never reflected who was actually signed in. null until the fetch
  // resolves (not signed in, or not yet loaded) -- treated as "not admin",
  // never as "admin" by default.
  const [realRole, setRealRole] = useState(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    fetchRealRole().then(setRealRole);
  }, []);

  // Stage 2: one-time hydration from Supabase on mount, if this signed-in
  // member has a real member_preferences row already (e.g. set on another
  // device) -- remote wins over local, but only once this resolves, so a
  // pre-hydration render of local defaults never races ahead and overwrites
  // real remote data (see the sync effect below, gated on hydratedFromRemote).
  useEffect(() => {
    fetchRemotePreferences().then((remote) => {
      if (remote) {
        setState((prev) => ({
          ...prev,
          preferences: {
            ...prev.preferences,
            ...remote,
            recruitingSettings: { ...prev.preferences.recruitingSettings, ...remote.recruitingSettings },
          },
        }));
      }
      setHydratedFromRemote(true);
    });
  }, []);

  // Background sync to Supabase whenever preferences actually change --
  // fire-and-forget, never blocks the UI. data/store.jsx stays the source
  // of truth Onboarding.jsx/MyProfile.jsx read and write; this only mirrors
  // it remotely so data/jobMatch.js can eventually run server-side against
  // real data instead of only client-side against localStorage.
  useEffect(() => {
    if (!hydratedFromRemote) return;
    syncPreferencesToRemote(state.preferences);
  }, [state.preferences, hydratedFromRemote]);

  // My Profile's Personal tab + onboardingComplete -- same one-time-
  // hydrate-then-background-sync shape as preferences above (remote wins
  // on hydration, this is now genuinely durable identity, not just a
  // local convenience). Was the one piece of real member state that
  // never got this treatment: only ever lived in localStorage, so signing
  // into a real account on a different browser/device meant starting
  // onboarding over from scratch with no memory of anything entered
  // before. Reuses hydratedFromRemote as its own sync gate too, same as
  // preferences -- both hydration effects run independently on mount, so
  // this can fire its own redundant write-back the moment its hydration
  // resolves if preferences' already flipped the flag first; harmless
  // (writing back the same data just read), same accepted characteristic
  // preferences' own effect already has.
  useEffect(() => {
    fetchRemoteProfileOverrides().then((remote) => {
      if (remote) {
        setState((prev) => ({
          ...prev,
          profileOverrides: { ...prev.profileOverrides, ...remote.profileOverrides },
          onboardingComplete: remote.onboardingComplete || prev.onboardingComplete,
          profileLastUpdated: remote.profileLastUpdated ?? prev.profileLastUpdated,
        }));
      }
    });
  }, []);

  useEffect(() => {
    if (!hydratedFromRemote) return;
    syncProfileOverridesToRemote(state.profileOverrides, state.onboardingComplete, state.profileLastUpdated);
  }, [state.profileOverrides, state.onboardingComplete, state.profileLastUpdated, hydratedFromRemote]);

  // Real Directory auto-fill (see data/directoryPrefillSync.js for the
  // full rationale). Gated on hydratedFromRemote so this can never race
  // ahead of a real saved profileOverrides value fetched above -- only
  // runs once that's resolved, and even then only ever fills a field
  // that's still empty, so a member's own edit (past or future) always
  // wins. Silently does nothing on no match (not everyone in the club is
  // in the Directory sheet yet) or a fetch failure -- this is a nice-to-
  // have prefill, never something a member should be blocked on.
  useEffect(() => {
    if (!hydratedFromRemote) return;
    fetchDirectoryPrefill()
      .then((match) => {
        if (!match) return;
        setState((prev) => {
          const patch = {};
          if (!prev.profileOverrides.fullName && match.name) patch.fullName = match.name;
          if (!prev.profileOverrides.majors && match.major) patch.majors = match.major;
          if (!prev.profileOverrides.linkedIn && match.linkedin) patch.linkedIn = match.linkedin;
          if (Object.keys(patch).length === 0) return prev;
          return { ...prev, profileOverrides: { ...prev.profileOverrides, ...patch } };
        });
      })
      .catch(() => {});
  }, [hydratedFromRemote]);

  // Real applications tracker (Stage 5) -- same one-time-hydrate-on-mount
  // shape as preferences above, except merged into local state rather than
  // replacing it outright: trackedJobs/prepLogged/timelineShiftDays also
  // hold the seeded demo applications (SEED_TRACKED_JOBS), which are
  // deliberately never synced to Supabase (see below), so a member with no
  // real tracked applications yet should keep seeing them, not an empty
  // board. Merging (remote entries win per-jobId, anything local-only is
  // preserved) gets that for free and also closes a narrow race: if a
  // member interacts with the tracker in the brief window before this
  // fetch resolves, an outright replace would wipe that action the moment
  // hydration completes.
  useEffect(() => {
    fetchRemoteTrackedApplications().then((remote) => {
      if (remote) {
        setState((prev) => ({
          ...prev,
          trackedJobs: { ...prev.trackedJobs, ...remote.trackedJobs },
          prepLogged: { ...prev.prepLogged, ...remote.prepLogged },
          timelineShiftDays: { ...prev.timelineShiftDays, ...remote.timelineShiftDays },
        }));
      }
    });
  }, []);

  // Real savedConnections/coffeeChatStatus (Network) and savedJobIds (Jobs
  // board) -- same one-time-hydrate-and-merge shape as the tracker above,
  // for the same reason (SEED_COFFEE_CHATS should survive until a member
  // has real synced data, and a merge can't clobber a pre-hydration local
  // action the way a replace could).
  useEffect(() => {
    fetchRemoteNetworkConnections().then((remote) => {
      if (remote) {
        setState((prev) => ({
          ...prev,
          savedConnections: [...new Set([...prev.savedConnections, ...remote.savedConnections])],
          coffeeChatStatus: { ...prev.coffeeChatStatus, ...remote.coffeeChatStatus },
        }));
      }
    });
    fetchRemoteSavedJobs().then((remote) => {
      if (remote) {
        setState((prev) => ({
          ...prev,
          savedJobIds: [...new Set([...prev.savedJobIds, ...remote])],
        }));
      }
    });
  }, []);

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

  function updateNotificationSetting(key, value) {
    setState((prev) => ({
      ...prev,
      notificationSettings: { ...prev.notificationSettings, [key]: value },
    }));
  }

  function addRecentSearch(query) {
    if (!query.trim()) return;
    setState((prev) => ({
      ...prev,
      recentSearches: [query, ...prev.recentSearches.filter((q) => q !== query)].slice(0, 5),
    }));
  }

  // US-39 -- "save a named filter set." No name-entry UI exists for this
  // yet (the button is a single click, not a form), so the label is
  // auto-generated from whatever's actually active -- honest about what
  // was saved rather than a placeholder like "Untitled search."
  function saveSearch(filters, label) {
    const search = { id: crypto.randomUUID(), label: label || "All jobs", filters, savedAt: new Date().toISOString() };
    setState((prev) => ({ ...prev, savedSearches: [search, ...prev.savedSearches].slice(0, 10) }));
  }

  function removeSavedSearch(id) {
    setState((prev) => ({ ...prev, savedSearches: prev.savedSearches.filter((s) => s.id !== id) }));
  }

  function completeOnboarding() {
    setState((prev) => ({ ...prev, onboardingComplete: true }));
  }

  function toggleSavedJob(jobId) {
    let nowSaved = null;
    setState((prev) => {
      nowSaved = !prev.savedJobIds.includes(jobId);
      return {
        ...prev,
        savedJobIds: nowSaved ? [...prev.savedJobIds, jobId] : prev.savedJobIds.filter((id) => id !== jobId),
      };
    });
    if (nowSaved !== null) syncSavedJobToRemote(jobId, nowSaved);
  }

  // Each mutation below computes the full post-update application record
  // into a closure variable (syncPayload) *inside* the setState updater --
  // cheap, pure, and safe under StrictMode's double-invoke -- then fires
  // the actual network sync *after* setState returns, never from inside
  // the updater itself (that would run the fire-and-forget upsert twice in
  // dev, once for each StrictMode invocation of an impure updater).

  function addToTracker(jobId, stage = "Interested") {
    let syncPayload = null;
    setState((prev) => {
      if (prev.trackedJobs[jobId]) return prev; // don't downgrade an existing stage
      const now = new Date().toISOString();
      const record = { stage, addedAt: now, stageHistory: [{ stage, date: now }], outcome: null };
      syncPayload = { ...record, prepLoggedHours: 0, timelineShiftDays: 0 };
      return { ...prev, trackedJobs: { ...prev.trackedJobs, [jobId]: record } };
    });
    if (syncPayload) syncTrackedApplicationToRemote(jobId, syncPayload);
  }

  function logPrep(jobId, hours = 2) {
    let syncPayload = null;
    setState((prev) => {
      const newHours = (prev.prepLogged[jobId] || 0) + hours;
      const tracked = prev.trackedJobs[jobId];
      if (tracked) {
        syncPayload = { ...tracked, prepLoggedHours: newHours, timelineShiftDays: prev.timelineShiftDays[jobId] ?? 0 };
      }
      return { ...prev, prepLogged: { ...prev.prepLogged, [jobId]: newHours } };
    });
    if (syncPayload) syncTrackedApplicationToRemote(jobId, syncPayload);
  }

  function updateApplicationStage(jobId, stage) {
    let syncPayload = null;
    setState((prev) => {
      const existing = prev.trackedJobs[jobId];
      const history = existing.stageHistory || [];
      const record = { ...existing, stage, stageHistory: [...history, { stage, date: new Date().toISOString() }] };
      syncPayload = { ...record, prepLoggedHours: prev.prepLogged[jobId] ?? 0, timelineShiftDays: prev.timelineShiftDays[jobId] ?? 0 };
      return { ...prev, trackedJobs: { ...prev.trackedJobs, [jobId]: record } };
    });
    if (syncPayload) syncTrackedApplicationToRemote(jobId, syncPayload);
  }

  // Records what actually happened on an application -- separate from
  // updateApplicationStage (rather than an extra param on it) since
  // setting/correcting an outcome shouldn't append a second entry to
  // stageHistory the way a real stage transition does. Real UI calls this
  // from components/modals/RecordOutcomeModal.jsx, opened either right
  // after a card is dropped/set to Closed or later via the persistent
  // "Record outcome" affordance on an already-Closed card with no outcome
  // yet (covers every pre-existing Closed application too, including the
  // seed data and anything added directly at Closed via AddApplicationModal).
  //
  // rejectionStage (data/trackerUtils.js's REJECTION_STAGES) is only ever
  // meaningful alongside outcome === "rejected" -- forced to null
  // otherwise so switching an outcome away from "rejected" can't leave a
  // stale stage behind. Local-only for now: the real
  // tracked_applications.rejection_stage column (migration
  // 20260908120000_tracked_application_rejection_stage.sql) exists as a
  // migration file but hasn't been applied to the live Supabase project
  // from this session (no DB-privileged credential available here) --
  // syncTrackedApplicationToRemote() deliberately doesn't send it yet, so
  // an unapplied migration can't break the already-working outcome/stage
  // sync. Flagged as a real follow-up, not an oversight.
  function setApplicationOutcome(jobId, outcome, rejectionStage = null) {
    let syncPayload = null;
    setState((prev) => {
      const existing = prev.trackedJobs[jobId];
      if (!existing) return prev;
      const record = { ...existing, outcome, rejectionStage: outcome === "rejected" ? rejectionStage : null };
      syncPayload = { ...record, prepLoggedHours: prev.prepLogged[jobId] ?? 0, timelineShiftDays: prev.timelineShiftDays[jobId] ?? 0 };
      return { ...prev, trackedJobs: { ...prev.trackedJobs, [jobId]: record } };
    });
    if (syncPayload) syncTrackedApplicationToRemote(jobId, syncPayload);
  }

  function shiftTimeline(jobId, deltaDays) {
    let syncPayload = null;
    setState((prev) => {
      const newShift = (prev.timelineShiftDays[jobId] || 0) + deltaDays;
      const tracked = prev.trackedJobs[jobId];
      if (tracked) {
        syncPayload = { ...tracked, prepLoggedHours: prev.prepLogged[jobId] ?? 0, timelineShiftDays: newShift };
      }
      return { ...prev, timelineShiftDays: { ...prev.timelineShiftDays, [jobId]: newShift } };
    });
    if (syncPayload) syncTrackedApplicationToRemote(jobId, syncPayload);
  }

  function requestCoffeeChat(personId) {
    let syncPayload = null;
    setState((prev) => {
      if (prev.coffeeChatStatus[personId]) return prev; // don't overwrite an existing status
      syncPayload = { saved: prev.savedConnections.includes(personId), coffeeChatStatus: "Request sent" };
      return { ...prev, coffeeChatStatus: { ...prev.coffeeChatStatus, [personId]: "Request sent" } };
    });
    if (syncPayload) syncNetworkConnectionToRemote(personId, syncPayload);
  }

  function toggleSavedConnection(personId) {
    let syncPayload = null;
    setState((prev) => {
      const nowSaved = !prev.savedConnections.includes(personId);
      syncPayload = { saved: nowSaved, coffeeChatStatus: prev.coffeeChatStatus[personId] ?? null };
      return {
        ...prev,
        savedConnections: nowSaved ? [...prev.savedConnections, personId] : prev.savedConnections.filter((id) => id !== personId),
      };
    });
    if (syncPayload) syncNetworkConnectionToRemote(personId, syncPayload);
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

  // A real (not fake) partial "needs action" count for TopBar.jsx's
  // notification bell -- the bell used to always show the hardcoded mock
  // navCounts.notificationsUnread (4) regardless of who was actually
  // signed in. The full computation (data/notificationUtils.js's
  // buildNotifications) also needs real job deadline dates, which would
  // mean an extra jobs fetch in the global nav chrome on every page --
  // not worth it just for a badge count. This covers what's cheaply
  // computable from state already held here: prep-hours reminders (same
  // "First round"/"Final round" + <26 hours rule buildNotifications
  // uses, which doesn't need a job's deadline) and pending coffee chats.
  // Real but a subset -- the Notifications page itself is still the
  // complete, authoritative picture (it also includes urgent deadlines).
  const needsActionCount = useMemo(() => {
    const prepCount = Object.entries(state.trackedJobs).filter(
      ([jobId, info]) => ["First round", "Final round"].includes(info.stage) && (state.prepLogged[jobId] || 0) < 26,
    ).length;
    const chatCount = Object.values(state.coffeeChatStatus).filter((status) => status && !status.startsWith("Confirmed")).length;
    return prepCount + chatCount;
  }, [state.trackedJobs, state.prepLogged, state.coffeeChatStatus]);

  return (
    <AppStateContext.Provider
      value={{
        ...state,
        needsActionCount,
        realRole,
        isAdmin: realRole === "admin",
        updatePreferences,
        updateRecruitingSetting,
        updateProfileOverrides,
        touchProfileUpdated,
        updateNotificationSetting,
        addRecentSearch,
        saveSearch,
        removeSavedSearch,
        completeOnboarding,
        toggleSavedJob,
        addToTracker,
        logPrep,
        updateApplicationStage,
        setApplicationOutcome,
        shiftTimeline,
        requestCoffeeChat,
        toggleSavedConnection,
        toggleSavedResource,
        toggleResourceSection,
        advanceTrackStep,
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
