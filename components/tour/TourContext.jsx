import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppState } from "../../data/store.jsx";
import { TOURS, defaultTourId, availableTours, LANDING_ROUTE } from "../../data/tours.js";

// Per-browser convenience, same category as data/store.jsx's recentSearches
// or the admin signups "last seen" badge -- not synced to Supabase. Worst
// case on a new device is seeing an already-familiar tour once more, which
// is a fine failure mode for a skippable walkthrough (unlike
// onboardingComplete, which gates a real one-time flow and does need to
// follow the member across devices).
const SEEN_KEY = "uc-portal-tours-seen";

function loadSeen() {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}");
  } catch {
    return {};
  }
}

function markSeen(tourId) {
  const seen = loadSeen();
  seen[tourId] = true;
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    // localStorage unavailable (private window, blocked storage) -- the
    // tour still works for this session, it just won't remember it was
    // seen. Not worth failing the tour over.
  }
}

const TourCtx = createContext(null);

// Lives inside <BrowserRouter> (App.jsx, wrapping <Routes>, not inside any
// per-route <NavShell>) so it survives route changes instead of resetting
// on every navigation, and so useNavigate/useLocation are both available
// for the auto-start check and for steps that span multiple real pages.
export function TourProvider({ children }) {
  const { realRole, realMemberStatus, isAdmin, isAlumni, isIntern } = useAppState();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTourId, setActiveTourId] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const autoStartAttemptedRef = useRef(false);

  // null until the real profiles.role/member_status fetch resolves --
  // gates auto-start so a real alum isn't briefly auto-started into the
  // regular member tour before isAlumni flips true (see store.jsx's own
  // documented realRole/realMemberStatus race for the identical class of
  // bug this guards against).
  const roleLoaded = realRole !== null && realMemberStatus !== null;

  const goToStep = useCallback(
    (tourId, index) => {
      const steps = TOURS[tourId].steps;
      if (index < 0 || index >= steps.length) return;
      const step = steps[index];
      if (step.route && step.route !== location.pathname) {
        navigate(step.route);
      }
      setStepIndex(index);
    },
    [navigate, location.pathname]
  );

  const start = useCallback(
    (tourId) => {
      autoStartAttemptedRef.current = true;
      setActiveTourId(tourId);
      const steps = TOURS[tourId].steps;
      if (steps[0].route && steps[0].route !== location.pathname) {
        navigate(steps[0].route);
      }
      setStepIndex(0);
    },
    [navigate, location.pathname]
  );

  const stop = useCallback(() => {
    setActiveTourId((current) => {
      if (current) markSeen(current);
      return null;
    });
  }, []);

  const next = useCallback(() => {
    setActiveTourId((current) => {
      if (!current) return current;
      const steps = TOURS[current].steps;
      if (stepIndex + 1 >= steps.length) {
        markSeen(current);
        return null;
      }
      goToStep(current, stepIndex + 1);
      return current;
    });
  }, [stepIndex, goToStep]);

  const prev = useCallback(() => {
    setActiveTourId((current) => {
      if (!current) return current;
      goToStep(current, Math.max(0, stepIndex - 1));
      return current;
    });
  }, [stepIndex, goToStep]);

  // Auto-start, once per account per tour: only fires on this account's
  // own real landing route (Home / Feed / Accelerator), only once
  // roleLoaded, and only if this tour has never been marked seen on this
  // browser. autoStartAttemptedRef additionally guards against re-firing
  // if the member navigates back to the landing route again later in the
  // same session after skipping/finishing (start()/stop() both set it,
  // covering the manual-replay path too).
  useEffect(() => {
    if (!roleLoaded || autoStartAttemptedRef.current) return;
    const tourId = defaultTourId({ isAlumni, isIntern });
    if (location.pathname !== LANDING_ROUTE[tourId]) return;
    if (loadSeen()[tourId]) {
      autoStartAttemptedRef.current = true;
      return;
    }
    const timer = setTimeout(() => start(tourId), 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleLoaded, isAlumni, isIntern, location.pathname]);

  const value = useMemo(
    () => ({
      activeTour: activeTourId ? TOURS[activeTourId] : null,
      activeTourId,
      stepIndex,
      start,
      stop,
      next,
      prev,
      availableTours: availableTours({ isAdmin, isAlumni, isIntern }),
    }),
    [activeTourId, stepIndex, start, stop, next, prev, isAdmin, isAlumni, isIntern]
  );

  return <TourCtx.Provider value={value}>{children}</TourCtx.Provider>;
}

export function useTour() {
  return useContext(TourCtx);
}
