import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTour } from "./TourContext.jsx";
import "../../styles/tour.css";

function measure(selector) {
  const el = document.querySelector(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return rect;
}

// Tooltip placement: `hint` ("right" | "bottom" -- see data/tours.js) is a
// preference, not a guarantee -- always falls back to whatever actually
// fits the viewport, clamped with a margin, same spirit as JobDetail's own
// odds-model layout preferring real content over a fixed slot.
function tooltipStyle(rect, hint) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(340, vw - 32);
  const margin = 16;
  const estHeight = 240;

  if (!rect) {
    return { width, top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }

  if (hint === "right" && rect.right + margin + width <= vw) {
    const top = Math.min(Math.max(rect.top, margin), vh - estHeight - margin);
    return { width, top, left: rect.right + margin };
  }

  const left = Math.min(Math.max(rect.left, margin), vw - width - margin);
  if (rect.bottom + margin + estHeight <= vh) {
    return { width, top: rect.bottom + margin, left };
  }
  if (rect.top - margin - estHeight >= 0) {
    return { width, top: rect.top - margin - estHeight, left };
  }
  return { width, top: Math.max(margin, vh - estHeight - margin), left };
}

export default function TourOverlay() {
  const { activeTour, stepIndex, next, prev, stop } = useTour();
  const location = useLocation();
  const [rect, setRect] = useState(null);
  const [ready, setReady] = useState(false);
  const timerRef = useRef(null);

  const step = activeTour ? activeTour.steps[stepIndex] : null;

  // Steps can point at an element on a page the tour just navigated to,
  // which hasn't rendered yet the instant this effect runs -- poll for up
  // to ~1.5s rather than assuming it's there on the first check. Scrolls
  // the real target into view once found (a filter column or a tracker row
  // can easily start off-screen) and re-measures after the scroll settles.
  // `dimming` flips true immediately (see render below) even while this is
  // still polling, so a step whose target is legitimately absent (e.g. the
  // match-score step on a profile with zero "Recommended for you" matches)
  // degrades to a centered card after a brief dim rather than leaving a
  // blank screen for the full poll window.
  useEffect(() => {
    setReady(false);
    setRect(null);
    if (!step) return;
    if (!step.target) {
      setReady(true);
      return;
    }
    let cancelled = false;
    let attempts = 0;
    function tick() {
      if (cancelled) return;
      const r = measure(step.target);
      if (r) {
        document.querySelector(step.target)?.scrollIntoView({ block: "center", behavior: "smooth" });
        timerRef.current = setTimeout(() => {
          if (cancelled) return;
          setRect(measure(step.target) || r);
          setReady(true);
        }, 320);
        return;
      }
      attempts += 1;
      if (attempts > 15) {
        setReady(true);
        return;
      }
      timerRef.current = setTimeout(tick, 100);
    }
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
    };
  }, [step, location.pathname]);

  useEffect(() => {
    if (!step?.target) return;
    function reposition() {
      const r = measure(step.target);
      if (r) setRect(r);
    }
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [step]);

  useEffect(() => {
    if (!activeTour) return;
    function onKey(event) {
      if (event.key === "Escape") stop();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeTour, stop]);

  if (!activeTour || !step) return null;

  // Dims immediately even before `ready` -- polling for a target that
  // turns out to be absent (e.g. the match-score step on a profile with
  // zero current matches) would otherwise leave a blank, un-dimmed screen
  // for the whole poll window instead of a clear "something is loading"
  // state.
  if (!ready) {
    return (
      <>
        <div className="tour-catcher" onClick={stop} />
        <div className="tour-dim" />
      </>
    );
  }

  const total = activeTour.steps.length;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === total - 1;
  const pad = 8;
  const spotlight = rect
    ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
    : null;

  return (
    <>
      <div className="tour-catcher" onClick={stop} />
      {spotlight ? <div className="tour-spotlight" style={spotlight} /> : <div className="tour-dim" />}
      <div className="tour-tooltip" style={tooltipStyle(rect, step.placement)} role="dialog" aria-label={step.title}>
        <div className="tour-tooltip__kicker">
          Step {stepIndex + 1} of {total}
        </div>
        <h3 className="tour-tooltip__title">{step.title}</h3>
        <p className="tour-tooltip__body">{step.body}</p>
        <div className="tour-tooltip__dots" aria-hidden="true">
          {activeTour.steps.map((_, i) => (
            <span key={i} className={`tour-tooltip__dot${i === stepIndex ? " is-active" : ""}`} />
          ))}
        </div>
        <div className="tour-tooltip__actions">
          <button type="button" className="btn-link" onClick={stop}>
            Skip tour
          </button>
          <div className="tour-tooltip__nav">
            {!isFirst && (
              <button type="button" className="btn btn-secondary" onClick={prev}>
                Back
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={next}>
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
