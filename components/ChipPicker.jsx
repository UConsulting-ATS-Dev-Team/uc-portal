import { useState } from "react";

// A searchable chip list for onboarding's long option lists (60+ industries, 90 locations, 78 skills).
// Shows the first `initial` options plus everything already selected; typing searches the whole list,
// and "Show all" expands it. Selected chips always stay visible so a pick can't scroll out of sight.
// `isDisabled(option)` lets a caller stop further picks at a limit (e.g. 3 industries).
// `pinned` options are always visible (e.g. "Remote", "Still figuring it out").
export default function ChipPicker({ options, selected, onToggle, initial = 14, noun = "options", isDisabled, pinned = [] }) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);

  const q = query.trim().toLowerCase();
  const visible = q
    ? options.filter((o) => selected.includes(o) || o.toLowerCase().includes(q))
    : expanded
      ? options
      : options.filter((o, i) => i < initial || selected.includes(o) || pinned.includes(o));
  const hiddenCount = options.length - visible.length;

  return (
    <>
      <div className="field">
        <input
          type="text"
          placeholder={`Search ${options.length} ${noun}…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={`Search ${noun}`}
        />
      </div>
      <div className="chip-row">
        {visible.map((option) => {
          const isSelected = selected.includes(option);
          return (
            <button
              type="button"
              key={option}
              className={`chip-toggle${isSelected ? " is-selected" : ""}`}
              disabled={!isSelected && !!isDisabled?.(option)}
              onClick={() => onToggle(option)}
            >
              {option}
            </button>
          );
        })}
        {q && visible.length === 0 && <p className="meta">No {noun} match "{query}".</p>}
      </div>
      {!q && (hiddenCount > 0 || expanded) && (
        <button type="button" className="btn-link" style={{ marginBottom: "var(--space-5)" }} onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Show fewer" : `Show all ${options.length}`}
        </button>
      )}
    </>
  );
}
