import { useState } from "react";

// Shared pattern replacing a silently `disabled` button for a feature
// that's real and planned (email alerts, calendar sync), not abandoned.
// A disabled button gives no feedback at all unless someone happens to
// hover for the title tooltip -- this guarantees a click is never
// silently ignored, without pretending the feature exists yet. Mirrors
// this app's own existing "toggle the button's own label" pattern (e.g.
// My Profile's "Save changes" -> "Saved ✓"), just reverting after a few
// seconds since this isn't a one-time confirmation.
export default function ComingSoonButton({ className, children, message = "Coming soon. We're working on it", onClick }) {
  const [showing, setShowing] = useState(false);

  function handleClick() {
    setShowing(true);
    onClick?.();
    setTimeout(() => setShowing(false), 2500);
  }

  return (
    <button type="button" className={className} onClick={handleClick}>
      {showing ? message : children}
    </button>
  );
}
