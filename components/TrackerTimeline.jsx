import { useEffect, useRef, useState } from "react";
import {
  TIMELINE_START,
  TIMELINE_END,
  MONTH_MARKERS,
  dateToPct,
  groupForStage,
  GROUP_ORDER,
  shadeForStage,
  buildRow,
} from "../data/timelineUtils.js";
import { matchesDeadlineBucket } from "../data/jobUtils.js";
import CompanyLogo from "./CompanyLogo.jsx";

const TOTAL_DAYS = (TIMELINE_END - TIMELINE_START) / 86400000;

// Drag-to-reschedule is real but simplified: it commits the new date on
// mouse-up rather than live-following the cursor, and moves every
// projected stage for that application together (not independent
// start/end handles per stage) -- a full Gantt editor is out of scope
// for a prototype, but this is genuine drag state, not a button.
export default function TrackerTimeline({ applications, timelineShiftDays, onShiftTimeline }) {
  const [drag, setDrag] = useState(null);
  const trackRefs = useRef({});

  useEffect(() => {
    if (!drag) return;
    function onUp(e) {
      const deltaX = e.clientX - drag.startX;
      const deltaDays = Math.round((deltaX / drag.trackWidth) * TOTAL_DAYS);
      if (deltaDays !== 0) onShiftTimeline(drag.jobId, deltaDays);
      setDrag(null);
    }
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, [drag, onShiftTimeline]);

  function handleDragStart(e, jobId) {
    const trackEl = trackRefs.current[jobId];
    setDrag({ jobId, startX: e.clientX, trackWidth: trackEl.getBoundingClientRect().width });
  }

  const grouped = GROUP_ORDER.map((g) => ({
    ...g,
    rows: applications.filter((a) => groupForStage(a.stage) === g.key),
  })).filter((g) => g.rows.length > 0);

  const today = new Date();

  return (
    <div>
      <div className="timeline-legend">
        <span>
          <span className="timeline-legend__swatch" style={{ background: shadeForStage("Interested") }} />
          Interested
        </span>
        <span>
          <span className="timeline-legend__swatch" style={{ background: shadeForStage("Final round") }} />
          Interview rounds
        </span>
        <span>
          <span className="timeline-legend__swatch is-projected" />
          Projected — drag to reschedule
        </span>
        <span>
          <span className="timeline-legend__diamond" />
          Scheduled event
        </span>
      </div>

      <div className="timeline-container">
        <div className="timeline-header">
          <div className="timeline-header__spacer" />
          <div className="timeline-header__months">
            {MONTH_MARKERS.map((m) => (
              <div className="timeline-month-label" key={m.label} style={{ left: `${dateToPct(m.date)}%` }}>
                {m.label}
              </div>
            ))}
          </div>
        </div>

        {grouped.map((g) => {
          const urgentCount = g.rows.filter((a) => matchesDeadlineBucket(a.job, "This week")).length;
          return (
            <div className="timeline-group" key={g.key}>
              <div className="timeline-group__header">
                {g.label} — {g.rows.length}
                {urgentCount > 0 && ` · ${urgentCount} deadlines this week`}
              </div>
              {g.rows.map(({ jobId, job, ...app }) => {
                const shift = timelineShiftDays[jobId] || 0;
                const { actualSegments, projectedSegments, event } = buildRow({ job, ...app }, shift);
                return (
                  <div className="timeline-row" key={jobId}>
                    <div className="timeline-row__label">
                      <CompanyLogo name={job.company} initials={job.logoInitials} className="board-card__logo" />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "var(--text-secondary)" }}>{job.company}</div>
                        <div className="meta">{job.role}</div>
                      </div>
                    </div>
                    <div
                      className="timeline-row__track"
                      ref={(el) => {
                        trackRefs.current[jobId] = el;
                      }}
                    >
                      {MONTH_MARKERS.map((m) => (
                        <div className="timeline-gridline" key={m.label} style={{ left: `${dateToPct(m.date)}%` }} />
                      ))}
                      <div className="timeline-today-marker" style={{ left: `${dateToPct(today)}%` }} />

                      {actualSegments.map((seg, i) => (
                        <div
                          className="timeline-bar"
                          key={`actual-${i}`}
                          style={{
                            left: `${dateToPct(seg.start)}%`,
                            width: `${Math.max(dateToPct(seg.end) - dateToPct(seg.start), 0.5)}%`,
                            background: shadeForStage(seg.stage),
                          }}
                          title={seg.stage}
                        />
                      ))}

                      {projectedSegments.map((seg, i) => (
                        <div
                          className="timeline-bar is-projected"
                          key={`projected-${i}`}
                          style={{
                            left: `${dateToPct(seg.start)}%`,
                            width: `${Math.max(dateToPct(seg.end) - dateToPct(seg.start), 0.5)}%`,
                          }}
                          title={`${seg.stage} (projected — drag to reschedule)`}
                          onMouseDown={(e) => handleDragStart(e, jobId)}
                        />
                      ))}

                      {event && (
                        <div className="timeline-event" style={{ left: `${dateToPct(event.date)}%` }} title={event.label}>
                          <span className="timeline-event__label">{event.label}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
