import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

// The fold state of a grouped menu (the desktop left rail and the phone "More" sheet). Each menu keeps its own remembered set under
// its own storage key, so two menus on screen at once never overwrite each other. A group opens by itself when the page changes to
// something inside it, and when a guided-tour step points at a link inside it (see EXPAND_EVENT below).

export const EXPAND_EVENT = "uc-nav-expand";

function read(key) {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) ?? "[]"));
  } catch {
    return new Set();
  }
}

const inGroup = (group, path) => group.items.some((item) => (item.to === "/" ? path === "/" : path.startsWith(item.to)));

export function useCollapsedGroups(sections, storageKey) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => read(storageKey));
  // The tour listener is registered once, so it reads the groups through a ref to see the current account's menu.
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify([...collapsed]));
    } catch {
      // storage unavailable: the menu still works, it just won't remember
    }
  }, [collapsed, storageKey]);

  function open(path) {
    const owner = sectionsRef.current.find((g) => inGroup(g, path));
    if (!owner) return;
    setCollapsed((prev) => {
      if (!prev.has(owner.section)) return prev;
      const next = new Set(prev);
      next.delete(owner.section);
      return next;
    });
  }

  // Only when the page changes: depending on `sections` would reopen a group the moment someone folds the one they are on.
  useEffect(() => {
    open(location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    const onExpand = (event) => open(event.detail?.to ?? "");
    window.addEventListener(EXPAND_EVENT, onExpand);
    return () => window.removeEventListener(EXPAND_EVENT, onExpand);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(section) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }

  return { collapsed, toggle };
}
