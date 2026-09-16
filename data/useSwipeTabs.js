import { useCallback, useRef } from "react";

const SWIPE_THRESHOLD = 50; // px horizontal drag before it counts as a real swipe, not a scroll/tap

// Real touch-driven swipe-between-tabs -- Pointer Events, mouse excluded
// (swiping isn't a mouse gesture). Direction is only decided on release,
// so an in-progress vertical scroll is never interrupted mid-gesture.
// Returns pointer-event props to spread onto the swipeable content area
// below a tab row -- not the tab row itself, so tapping a tab button
// still works exactly as it always has.
export function useSwipeTabs(tabKeys, activeKey, onChange) {
  const dragRef = useRef(null);

  const onPointerDown = useCallback((e) => {
    if (e.pointerType === "mouse") return;
    dragRef.current = { startX: e.clientX, startY: e.clientY };
  }, []);

  const onPointerUp = useCallback(
    (e) => {
      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
      const currentIndex = tabKeys.indexOf(activeKey);
      if (currentIndex === -1) return;
      const nextIndex = dx < 0 ? currentIndex + 1 : currentIndex - 1;
      if (nextIndex < 0 || nextIndex >= tabKeys.length) return;
      onChange(tabKeys[nextIndex]);
    },
    [tabKeys, activeKey, onChange]
  );

  return { onPointerDown, onPointerUp, onPointerCancel: onPointerUp };
}
