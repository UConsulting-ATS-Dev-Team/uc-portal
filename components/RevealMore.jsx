import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

// Progressive reveal for any list longer than people want to see at once: `initial` rows to start, then `step` more each time
// "Show N more" is pressed, and "Show fewer" folds it back. It keeps a list from jumping from a couple of rows to dozens.
export function useReveal(total, initial = 5, step = 5) {
  const [extra, setExtra] = useState(0);
  return makeReveal(total, initial, step, extra, setExtra);
}

// The same for a list built inside a loop, where a hook can't go: the caller keeps the extra count and passes its setter.
export function makeReveal(total, initial, step, extra, setExtra) {
  const shown = Math.min(initial + extra, total);
  return {
    shown,
    remaining: total - shown,
    step,
    canMore: shown < total,
    canFewer: extra > 0 && total > initial,
    more: () => setExtra(extra + step),
    fewer: () => setExtra(0),
  };
}

// `reveal` is what useReveal / makeReveal returns (or any object with the same fields). `noun` is the singular name of what is
// listed ("event"), so the button can say "Show 5 more events".
export default function RevealMore({ reveal, noun, className = "", style }) {
  if (!reveal.canMore && !reveal.canFewer) return null;
  const count = Math.min(reveal.step, reveal.remaining);
  return (
    <div className={`reveal-more ${className}`.trim()} style={style}>
      {reveal.canMore && (
        <button type="button" onClick={reveal.more}>
          Show {count} more{noun ? ` ${noun}${count === 1 ? "" : "s"}` : ""}
          <ChevronDown size={14} strokeWidth={1.5} aria-hidden="true" />
        </button>
      )}
      {reveal.canFewer && (
        <button type="button" onClick={reveal.fewer}>
          Show fewer
          <ChevronUp size={14} strokeWidth={1.5} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
