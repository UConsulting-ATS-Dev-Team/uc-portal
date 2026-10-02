import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
function tooltipStyle(rect, hint, measuredHeight) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 16;
  const width = Math.min(340, vw - margin * 2);
  // Real rendered height once known (a narrow phone wraps the body text
  // onto many more lines than a desktop does, so a fixed guess ran the
  // card off the bottom of the screen). Capped to the viewport, matching
  // the CSS max-height.
  const height = Math.min(measuredHeight || 240, vh - margin * 2);
  const centerLeft = Math.max(margin, (vw - width) / 2);

  // Plain pixel math instead of a CSS translate(-50%, -50%) -- a transform
  // can't coexist with narrow-screen CSS that pins `left`, and shoved the
  // card half off-screen on phones.
  if (!rect) {
    return { width, top: Math.max(margin, (vh - height) / 2), left: centerLeft };
  }

  if (hint === "right" && rect.right + margin + width <= vw) {
    const top = Math.max(margin, Math.min(rect.top, vh - height - margin));
    return { width, top, left: rect.right + margin };
  }

  const left = Math.max(margin, Math.min(rect.left, vw - width - margin));
  if (rect.bottom + margin + height <= vh) {
    return { width, top: rect.bottom + margin, left };
  }
  if (rect.top - margin - height >= 0) {
    return { width, top: rect.top - margin - height, left };
  }
  return { width, top: Math.max(margin, vh - height - margin), left };
}

export default function TourOverlay() {
  const { activeTour, stepIndex, next, prev, stop } = useTour();
  const location = useLocation();
  const [rect, setRect] = useState(null);
  const [ready, setReady] = useState(false);
  const timerRef = useRef(null);
  const tooltipRef = useRef(null);
  const [tipHeight, setTipHeight] = useState(0);

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
        // A fixed short delay isn't enough for every target -- the "Company
        // tiers" admin table (every company rendered inline, no pagination)
        // is tall enough that a real browser's smooth-scroll animation can
        // still be in flight well past a few hundred ms, which would grab a
        // mid-scroll position here. Poll until the rect actually stops
        // moving between reads (capped at ~2s) instead of assuming any one
        // delay is long enough.
        let settleAttempts = 0;
        let lastRect = r;
        function settle() {
          if (cancelled) return;
          const next = measure(step.target) || lastRect;
          const stable = Math.abs(next.top - lastRect.top) < 1 && Math.abs(next.left - lastRect.left) < 1;
          settleAttempts += 1;
          if (stable || settleAttempts > 20) {
            setRect(next);
            setReady(true);
            return;
          }
          lastRect = next;
          timerRef.current = setTimeout(settle, 100);
        }
        timerRef.current = setTimeout(settle, 150);
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

  // Re-measure the card's real height whenever its content or the
  // viewport changes, so placement never relies on a fixed guess.
  useLayoutEffect(() => {
    const el = tooltipRef.current;
    if (el) setTipHeight(el.offsetHeight);
  });

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
      <div className="tour-tooltip" ref={tooltipRef} style={tooltipStyle(rect, step.placement, tipHeight)} role="dialog" aria-label={step.title}>
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
