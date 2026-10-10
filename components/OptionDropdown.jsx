import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import "../styles/jobs.css";
import "../styles/optionDropdown.css";

// A dropdown for picking from a long list (industries, locations): a button that opens a searchable, grouped list.
// Picking keeps the list open so several can be chosen; Escape or a click outside closes it. The chosen ones also show as
// removable chips under the button (showChips={false} when the page already lists them).
//
// groups: [{ label, names: [...] }]. selected: names. onToggle(name) adds or removes one. max: the most that can be chosen
// (an unchosen option is disabled once reached).
export default function OptionDropdown({ groups, selected, onToggle, noun, max, showChips = true, placeholder }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    searchRef.current?.focus();
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const visibleGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .map((g) => ({ ...g, names: q ? g.names.filter((n) => n.toLowerCase().includes(q)) : g.names }))
      .filter((g) => g.names.length > 0);
  }, [groups, query]);

  const atMax = max != null && selected.length >= max;

  return (
    <div className="option-dropdown" ref={rootRef}>
      <button type="button" className="option-dropdown__trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="option-dropdown__label">{placeholder ?? `Choose ${noun}`}</span>
        <span className="option-dropdown__count">
          {selected.length > 0 && `${selected.length} selected`}
          <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" />
        </span>
      </button>

      {open && (
        <div className="option-dropdown__panel">
          <input
            ref={searchRef}
            type="search"
            className="option-dropdown__search"
            placeholder={`Search ${noun}…`}
            aria-label={`Search ${noun}`}
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="option-dropdown__list" role="listbox" aria-multiselectable="true">
            {visibleGroups.length === 0 && <p className="meta option-dropdown__empty">Nothing matches "{query}".</p>}
            {visibleGroups.map((g) => (
              <div key={g.label}>
                <div className="option-dropdown__group">{g.label}</div>
                {g.names.map((name) => {
                  const isOn = selected.includes(name);
                  const disabled = !isOn && atMax;
                  return (
                    <button
                      type="button"
                      role="option"
                      aria-selected={isOn}
                      key={name}
                      className={`option-dropdown__option${isOn ? " is-selected" : ""}`}
                      disabled={disabled}
                      onClick={() => onToggle(name)}
                    >
                      <span className="option-dropdown__check">{isOn && <Check size={14} strokeWidth={2} aria-hidden="true" />}</span>
                      {name}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          {max != null && (
            <p className="meta option-dropdown__foot">
              {selected.length} of {max} chosen
            </p>
          )}
        </div>
      )}

      {showChips && selected.length > 0 && (
        <div className="option-dropdown__chips">
          {selected.map((name) => (
            <span className="active-filter-chip" key={name}>
              {name}
              <button type="button" onClick={() => onToggle(name)} aria-label={`Remove ${name}`}>
                {"✕"}
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
