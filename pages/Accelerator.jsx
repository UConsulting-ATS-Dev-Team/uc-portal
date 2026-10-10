import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAcceleratorData } from "../data/useAcceleratorData.js";
import {
  addDays,
  assignmentProgress,
  attendanceProgress,
  calendarItems,
  chipStyleFor,
  coffeeChatProgress,
  daysUntil,
  dueWording,
  formatTimeRange,
  formatTimeShort,
  itemsByDate,
  monthGrid,
  monthToShow,
  parseYmd,
  programPeriods,
  shiftMonth,
  startOfWeek,
  ymd,
  CHATS_PER_WEEK,
  CLUB_CHATS_PER_WEEK,
} from "../data/acceleratorLogic.js";
import AcceleratorTabs from "../components/AcceleratorTabs.jsx";
import Modal from "../components/Modal.jsx";
import "../styles/accelerator.css";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MAX_CHIPS = 3;

function tagFor(item) {
  const style = chipStyleFor(item);
  return { className: `accel-tag accel-tag--${style}`, text: style === "accelerator" ? "Accelerator" : style === "required" ? "Required" : "Optional" };
}

const KIND_LABEL = { gm: "General meeting", accelerator: "Accelerator meeting", firm: "Firm info session", uc_event: "UC event", social: "Social", lesson: "Assignment due" };
const METHOD_LABEL = { admin: "The committee takes attendance", photo: "Submit a photo from the event to be marked as attending" };

// What a meeting or event is, where and when. Assignments link to their own page instead.
function EventDetails({ item, onClose }) {
  const date = parseYmd(item.date);
  const rows = [
    ["When", [date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }), item.time ? formatTimeRange(item.time, item.endTime) : null].filter(Boolean).join(", ")],
    ["Where", item.location],
    ["Type", `${KIND_LABEL[item.kind] ?? item.kind}, ${item.required ? "required" : "optional"}`],
    ["Attendance", METHOD_LABEL[item.method]],
  ].filter(([, v]) => v);
  return (
    <Modal title={item.title} onClose={onClose} width={520} footer={<button className="btn btn-secondary" onClick={onClose}>Close</button>}>
      <dl className="accel-details">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {item.description && <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{item.description}</p>}
    </Modal>
  );
}

function EventRow({ item, today }) {
  const [open, setOpen] = useState(false);
  const date = parseYmd(item.date);
  const tag = tagFor(item);
  const isLesson = item.kind === "lesson";
  const detail = [isLesson ? "Assignment due" : null, item.time ? formatTimeRange(item.time, item.endTime) : null, item.location].filter(Boolean).join(" · ");
  return (
    <div className={`accel-event${item.date < ymd(today) ? " is-past" : ""}`}>
      <div className={`accel-event__date${item.required ? " is-required" : ""}`}>
        <span className="accel-event__dow">{WEEKDAYS[date.getDay()]}</span>
        <span className="accel-event__day">{date.getDate()}</span>
      </div>
      <div className="accel-event__body">
        <div className="accel-event__title">{item.title}</div>
        {detail && <div className="accel-event__meta">{detail}</div>}
      </div>
      <span className={tag.className}>{tag.text}</span>
      {isLesson ? (
        <Link className="btn btn-secondary" to={`/accelerator/assignments?lesson=${item.lessonId}`}>
          Open assignment
        </Link>
      ) : (
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
          Details
        </button>
      )}
      {open && <EventDetails item={item} onClose={() => setOpen(false)} />}
    </div>
  );
}

function Calendar({ byDate, today }) {
  const [view, setView] = useState(() => monthToShow(today));
  const [selectedKey, setSelectedKey] = useState(null);
  const weeks = useMemo(() => monthGrid(view.year, view.month), [view]);
  const todayKey = ymd(today);
  const selectedItems = selectedKey ? byDate.get(selectedKey) ?? [] : [];

  return (
    <div className="accel-cal">
      <div className="accel-cal__head">
        <h2 className="accel-cal__title">
          {MONTH_NAMES[view.month]} {view.year}
        </h2>
        <div className="accel-cal__nav">
          <button type="button" className="btn btn-secondary" onClick={() => setView(monthToShow(today))}>
            Today
          </button>
          <button type="button" className="btn btn-secondary" aria-label="Previous month" onClick={() => setView(shiftMonth(view, -1))}>
            <ChevronLeft size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
          <button type="button" className="btn btn-secondary" aria-label="Next month" onClick={() => setView(shiftMonth(view, 1))}>
            <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="accel-cal__legend">
        <span>
          <span className="accel-chip accel-chip--required" style={{ display: "inline-block" }}>Required</span>
        </span>
        <span>
          <span className="accel-chip accel-chip--optional" style={{ display: "inline-block" }}>Optional</span>
        </span>
        <span>
          <span className="accel-chip accel-chip--accelerator" style={{ display: "inline-block" }}>Accelerator</span>
        </span>
      </div>
      <div className="accel-cal__grid">
        {WEEKDAYS.map((d) => (
          <div className="accel-cal__dow" key={d}>
            {d}
          </div>
        ))}
        {weeks.flat().map((day) => {
          const items = byDate.get(day.key) ?? [];
          const shown = items.slice(0, MAX_CHIPS);
          const extra = items.length - shown.length;
          const classes = ["accel-cal__day", !day.inMonth && "is-outside", day.key === todayKey && "is-today", day.key === selectedKey && "is-selected"].filter(Boolean).join(" ");
          return (
            <button
              type="button"
              key={day.key}
              className={classes}
              aria-pressed={day.key === selectedKey}
              aria-label={`${MONTH_NAMES[day.date.getMonth()]} ${day.date.getDate()}${day.key === todayKey ? ", today" : ""}${items.length ? `, ${items.length} item${items.length === 1 ? "" : "s"}` : ""}`}
              onClick={() => setSelectedKey(day.key === selectedKey ? null : day.key)}
            >
              <span className="accel-cal__num">{day.date.getDate()}</span>
              {shown.map((item) => (
                <span key={item.id} className={`accel-chip accel-chip--${chipStyleFor(item)}`} title={[item.title, item.time ? formatTimeRange(item.time, item.endTime) : null].filter(Boolean).join(", ")}>
                  {item.kind === "lesson" ? <span className="accel-chip__time">Due</span> : item.time && <span className="accel-chip__time">{formatTimeShort(item.time, item.endTime)}</span>}
                  {item.title}
                </span>
              ))}
              {extra > 0 && <span className="accel-cal__more">+{extra} more</span>}
            </button>
          );
        })}
      </div>
      {selectedKey && (
        <div className="accel-cal__selected">
          <h3>{parseYmd(selectedKey).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</h3>
          {selectedItems.length === 0 ? <p className="meta" style={{ margin: 0 }}>Nothing scheduled.</p> : selectedItems.map((item) => <EventRow key={item.id} item={item} today={today} />)}
        </div>
      )}
    </div>
  );
}

// The phone view of the calendar: this week's items, then what's coming up after it.
function Agenda({ items, today }) {
  const weekStart = ymd(startOfWeek(today));
  const weekEnd = ymd(addDays(startOfWeek(today), 6));
  const thisWeek = items.filter((i) => i.date >= weekStart && i.date <= weekEnd);
  const later = items.filter((i) => i.date > weekEnd).slice(0, 8);
  return (
    <div>
      <h2 className="accel-agenda__heading">This week</h2>
      {thisWeek.length === 0 ? <p className="meta">Nothing scheduled this week.</p> : thisWeek.map((item) => <EventRow key={item.id} item={item} today={today} />)}
      {later.length > 0 && (
        <>
          <h2 className="accel-agenda__heading">Coming up</h2>
          {later.map((item) => (
            <EventRow key={item.id} item={item} today={today} />
          ))}
        </>
      )}
    </div>
  );
}

function RequirementCard({ to, kicker, figure, of, percent, note, flag }) {
  return (
    <Link to={to} className="accel-req">
      <div className="accel-req__kicker">{kicker}</div>
      <div className="accel-req__figure">
        {figure} <span className="accel-req__of">{of}</span>
      </div>
      <div className="accel-req__bar" aria-hidden="true">
        <span style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
      </div>
      <p className={`accel-req__note${flag ? " is-flag" : ""}`}>{note}</p>
      <span className="accel-req__more">View details</span>
    </Link>
  );
}

export default function Accelerator() {
  const { lessons, events, submissions, attendance, chats, schedule, loading, error } = useAcceleratorData();
  const today = useMemo(() => new Date(), []);

  const items = useMemo(() => calendarItems(events, lessons), [events, lessons]);
  const byDate = useMemo(() => itemsByDate(items), [items]);

  const now = useMemo(() => new Date(), []);
  const periods = useMemo(() => programPeriods(events, { lessons, chats, today, schedule }), [events, lessons, chats, today, schedule]);
  const chatProgress = useMemo(() => coffeeChatProgress(chats, periods, now), [chats, periods, now]);
  const attendanceStats = useMemo(() => attendanceProgress(events, attendance, today), [events, attendance, today]);
  const assignments = useMemo(() => assignmentProgress(lessons, submissions), [lessons, submissions]);

  const current = chatProgress.current;
  let chatNote = "Log your first coffee chat to get started.";
  let chatFlag = false;
  if (chatProgress.behind.length > 0) {
    const n = chatProgress.behind.length;
    chatNote = `Due ${current ? current.dueLabel : "at the next meeting"}. ${n} past week${n === 1 ? "" : "s"} ended short of ${CHATS_PER_WEEK} chats`;
    chatFlag = true;
  } else if (current) {
    chatNote = `${Math.min(CLUB_CHATS_PER_WEEK, current.clubCount)} of ${CLUB_CHATS_PER_WEEK} with club members. Resets ${current.dueLabel}`;
  } else if (chatProgress.counted > 0) {
    chatNote = "Every week of the program so far is on track.";
  }

  const attendanceNote = attendanceStats.noSocials
    ? "No socials attended yet"
    : attendanceStats.requiredSoFar === 0
      ? "No required events yet"
      : `${attendanceStats.socialsAttended} social${attendanceStats.socialsAttended === 1 ? "" : "s"} attended`;

  const assignmentNote =
    assignments.total === 0
      ? "No assignments yet"
      : assignments.complete === assignments.total
        ? "Every assignment is complete"
        : [
            assignments.incomplete > 0 && `${assignments.incomplete} to fix and resubmit`,
            assignments.notStarted > 0 && `${assignments.notStarted} not started`,
            assignments.awaitingReview > 0 && `${assignments.awaitingReview} waiting for comments`,
            assignments.incomplete === 0 && assignments.notStarted === 0 && assignments.awaitingReview === 0 && `${assignments.complete} complete`,
          ]
            .filter(Boolean)
            .join(", ");

  // The next assignments to hand in, nearest first, and what the committee has said about the ones already handed in.
  const submissionByLesson = new Map(submissions.map((s) => [s.lesson_id, s]));
  const upcoming = lessons
    .map((lesson, i) => ({ lesson, number: i + 1, days: daysUntil(lesson.lesson_date, today) }))
    .filter(({ lesson }) => !submissionByLesson.has(lesson.id))
    .slice(0, 3);
  const needsFix = lessons
    .map((lesson, i) => ({ lesson, number: i + 1, submission: submissionByLesson.get(lesson.id) }))
    .filter(({ submission }) => submission?.status === "incomplete");
  const recentlyComplete = lessons
    .map((lesson, i) => ({ lesson, number: i + 1, submission: submissionByLesson.get(lesson.id) }))
    .filter(({ submission }) => submission?.status === "complete" && submission.graded_at && now - new Date(submission.graded_at) < 14 * 86400000);

  const pct = (n, d) => (d > 0 ? (n / d) * 100 : 0);

  return (
    <div>
      <AcceleratorTabs />
      <h1 className="accel-title">Accelerator</h1>
      {error && <p className="meta" style={{ color: "var(--color-danger)" }}>{error}</p>}

      {!loading && (needsFix.length > 0 || recentlyComplete.length > 0) && (
        <div className="accel-notices">
          {needsFix.map(({ lesson, number, submission }) => (
            <Link key={lesson.id} to={`/accelerator/assignments?lesson=${lesson.id}`} className="accel-notice accel-notice--fix">
              <strong>Week {number}: {lesson.title} needs to be fixed.</strong>
              <span>{submission.feedback ? `The committee said: ${submission.feedback}` : "The committee marked it incomplete. Open it to see their comments, then resubmit."}</span>
            </Link>
          ))}
          {recentlyComplete.map(({ lesson, number, submission }) => (
            <Link key={lesson.id} to={`/accelerator/assignments?lesson=${lesson.id}`} className="accel-notice accel-notice--good">
              <strong>Week {number}: {lesson.title} is complete. You're all set for this one.</strong>
              {submission.feedback && <span>{submission.feedback}</span>}
            </Link>
          ))}
        </div>
      )}

      {!loading && upcoming.length > 0 && (
        <div className="accel-due">
          <div className="accel-due__kicker">Assignments due</div>
          {upcoming.map(({ lesson, number, days }) => (
            <Link key={lesson.id} to={`/accelerator/assignments?lesson=${lesson.id}`} className={`accel-due__row${days < 0 ? " is-overdue" : days <= 3 ? " is-soon" : ""}`}>
              <span className="accel-due__title">Week {number}: {lesson.title}</span>
              <span className="accel-due__date">
                {parseYmd(lesson.lesson_date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                <span className="accel-due__when">{days < 0 ? `overdue, was due ${dueWording(days)}` : `due ${dueWording(days)}`}</span>
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="accel-home">
        <div className="accel-home__calendar">{loading ? <p className="meta">Loadingâ€¦</p> : <Calendar byDate={byDate} today={today} />}</div>

        <div className="accel-home__requirements">
          <RequirementCard
            to="/accelerator/coffee-chats"
            kicker="Coffee Chats"
            figure={current ? current.counted : 0}
            of={`/ ${CHATS_PER_WEEK} this week`}
            percent={pct(current ? current.counted : 0, CHATS_PER_WEEK)}
            note={chatNote}
            flag={chatFlag}
          />
          <RequirementCard
            to="/accelerator/attendance"
            kicker="Attendance"
            figure={attendanceStats.requiredAttended}
            of={`/ ${attendanceStats.requiredSoFar} required`}
            percent={pct(attendanceStats.requiredAttended, attendanceStats.requiredSoFar)}
            note={attendanceNote}
            flag={attendanceStats.noSocials}
          />
          <RequirementCard
            to="/accelerator/assignments"
            kicker="Assignments"
            figure={assignments.submitted}
            of={`/ ${assignments.total} submitted`}
            percent={pct(assignments.submitted, assignments.total)}
            note={assignmentNote}
            flag={assignments.incomplete > 0}
          />
        </div>

        <div className="accel-home__agenda">{loading ? null : <Agenda items={items} today={today} />}</div>
      </div>
    </div>
  );
}
