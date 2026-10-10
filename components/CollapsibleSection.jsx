import { useState } from "react";
import { ChevronRight } from "lucide-react";
import "../styles/jobDetail.css";
import "../styles/collapsible.css";

// A page section that starts closed: a bold title with a one-line summary of what is inside, and a chevron to open it.
// Long admin pages use it so everything on the page is visible at a glance and only the section being worked on is open.
export default function CollapsibleSection({ title, summary, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`detail-section collapsible${open ? " is-open" : ""}`}>
      <button type="button" className="collapsible__head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <ChevronRight className="collapsible__chevron" size={18} strokeWidth={1.75} aria-hidden="true" />
        <span className="collapsible__title">{title}</span>
        {summary && <span className="collapsible__summary">{summary}</span>}
      </button>
      {open && <div className="collapsible__body">{children}</div>}
    </section>
  );
}
