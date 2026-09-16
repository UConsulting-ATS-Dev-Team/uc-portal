import { useCallback, useRef, useState } from "react";

const THRESHOLD = 64; // px pulled down before a release triggers a refresh
const MAX_PULL = 96; // visual cap so the indicator can't grow unbounded

// Real touch-driven pull-to-refresh -- Pointer Events, the same approach
// already proven working for touch/mouse/pen in this app by the
// Applications tracker's drag rebuild (see CLAUDE.md's "Gesture nav,
// scoped and built" entry). Only engages when the page is already
// scrolled to the very top (matches the native pattern this gesture
// models) and the drag is primarily vertical, so it can't fight normal
// scrolling. Mouse is excluded -- pulling down isn't a mouse gesture, and
// this shouldn't hijack a mouse drag used for text selection.
export default function PullToRefresh({ onRefresh, children }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const dragRef = useRef(null);

  const handlePointerDown = useCallback(
    (e) => {
      if (refreshing || e.pointerType === "mouse") return;
      if ((window.scrollY ?? document.documentElement.scrollTop) > 0) return;
      dragRef.current = { startX: e.clientX, startY: e.clientY };
    },
    [refreshing]
  );

  const handlePointerMove = useCallback((e) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dy = e.clientY - drag.startY;
    const dx = e.clientX - drag.startX;
    if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) {
      // Scrolled back up past the start, or this turned into a
      // horizontal gesture -- stop treating it as a pull.
      dragRef.current = null;
      setPullDistance(0);
      return;
    }
    setPullDistance(Math.min(dy, MAX_PULL));
  }, []);

  const endDrag = useCallback(async () => {
    const wasDragging = dragRef.current !== null;
    dragRef.current = null;
    if (!wasDragging) return;
    if (pullDistance >= THRESHOLD) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
    setPullDistance(0);
  }, [pullDistance, onRefresh]);

  const indicatorHeight = refreshing ? THRESHOLD : pullDistance;

  return (
    <div onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
      <div
        className="pull-to-refresh__indicator"
        style={{ height: indicatorHeight, opacity: indicatorHeight > 0 ? 1 : 0 }}
        aria-live="polite"
      >
        {refreshing ? "Refreshing…" : pullDistance >= THRESHOLD ? "Release to refresh" : "Pull to refresh"}
      </div>
      {children}
    </div>
  );
}
