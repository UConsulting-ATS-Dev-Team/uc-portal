// Pure logic for the intern accelerator tracker (calendar, coffee chats, attendance, assignments).
// No database or React in here so it is unit-tested directly (server/tests/acceleratorLogic.test.ts).
//
// Dates travel as "YYYY-MM-DD" strings (what Postgres `date` columns return) and are handled as LOCAL dates:
// `new Date("2026-10-12")` would parse as UTC midnight and show as the 11th west of Greenwich.

export const CHATS_PER_WEEK = 3;
export const CLUB_CHATS_PER_WEEK = 2;
export const DEFAULT_PROGRAM_WEEKS = 8;
export const MAX_RECURRING_EVENTS = 60;

// The three coffee-chat slots every week: two with club members, and a third with another intern or a third
// club member.
export const CHAT_SLOT_LABELS = ["Club member", "Club member", "Intern or club member"];

const pad = (n) => String(n).padStart(2, "0");

export function ymd(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseYmd(str) {
  const [y, m, d] = str.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

// Weeks run Sunday to Saturday.
export function startOfWeek(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// Which month the calendar opens on: this month, unless today is in its last calendar row (the Sunday-to-
// Saturday week that holds the month's final day, which is also the week the next month starts in), in which
// case the next month, so an intern isn't looking at a month that is about to end.
export function monthToShow(today = new Date()) {
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const lastRowStart = startOfWeek(lastDay);
  const month = startOfDay(today) >= lastRowStart ? new Date(today.getFullYear(), today.getMonth() + 1, 1) : new Date(today.getFullYear(), today.getMonth(), 1);
  return { year: month.getFullYear(), month: month.getMonth() };
}

export function shiftMonth({ year, month }, delta) {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

// Rows of 7 days, Sunday first, only as many rows as the month needs (4 to 6).
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const start = startOfWeek(first);
  const weeks = [];
  for (let cursor = start; cursor <= last; cursor = addDays(cursor, 7)) {
    weeks.push(
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(cursor, i);
        return { date, key: ymd(date), inMonth: date.getMonth() === month };
      })
    );
  }
  return weeks;
}

// ---- Recurring events ---------------------------------------------------------------------------------

// The dates a recurring event falls on: the start date, then every `everyWeeks` weeks, up to and including the end
// date, capped so a typo in the end date can't create thousands of rows.
export function expandRecurrence(startKey, endKey, everyWeeks = 1, max = MAX_RECURRING_EVENTS) {
  const dates = [];
  const end = parseYmd(endKey);
  for (let d = parseYmd(startKey); d <= end && dates.length < max; d = addDays(d, 7 * everyWeeks)) dates.push(ymd(d));
  return dates;
}

// Meetings of a few people in a room are marked by the committee; trips out and socials rely on a photo.
export function defaultAttendanceMethod(kind) {
  return kind === "gm" || kind === "accelerator" ? "admin" : "photo";
}

// ---- Calendar items ----------------------------------------------------------------------------------

// Lessons are on the calendar as "Week N" items alongside the admin-managed events. `lessons` must already be
// in date order (fetchLessons sorts them), which is also what numbers the weeks.
export function calendarItems(events, lessons) {
  const lessonItems = lessons.map((lesson, i) => ({
    id: `lesson-${lesson.id}`,
    title: `Week ${i + 1}: ${lesson.title}`,
    date: lesson.lesson_date,
    time: null,
    kind: "lesson",
    required: true,
    method: "admin",
    location: null,
  }));
  const eventItems = events.map((e) => ({
    id: e.id,
    title: e.title,
    date: e.event_date,
    time: e.start_time ? e.start_time.slice(0, 5) : null,
    endTime: e.end_time ? e.end_time.slice(0, 5) : null,
    kind: e.kind,
    required: e.required,
    method: e.attendance_method ?? "admin",
    location: e.location,
  }));
  return [...eventItems, ...lessonItems].sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
}

// How a calendar item is drawn: accelerator work in blue, other required items solid navy, optional dashed.
export function chipStyleFor(item) {
  if (item.kind === "lesson" || item.kind === "accelerator") return "accelerator";
  return item.required ? "required" : "optional";
}

export function itemsByDate(items) {
  const byDate = new Map();
  for (const item of items) {
    if (!byDate.has(item.date)) byDate.set(item.date, []);
    byDate.get(item.date).push(item);
  }
  return byDate;
}

export function formatTime(time) {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${pad(m)} ${h < 12 ? "AM" : "PM"}`;
}

// "6:00 PM", or "6:00 PM to 7:30 PM" when there is an end time; "" with no start.
export function formatTimeRange(start, end) {
  if (!start) return "";
  return end ? `${formatTime(start)} to ${formatTime(end)}` : formatTime(start);
}

// Compact for calendar cells: "6-7:30 PM", "11:30 AM-1 PM", or just "6 PM" with no end.
export function formatTimeShort(start, end) {
  if (!start) return "";
  const part = (t) => {
    const [h, m] = t.split(":").map(Number);
    return { text: `${h % 12 === 0 ? 12 : h % 12}${m ? `:${pad(m)}` : ""}`, ampm: h < 12 ? "AM" : "PM" };
  };
  const a = part(start);
  if (!end) return `${a.text} ${a.ampm}`;
  const b = part(end);
  return a.ampm === b.ampm ? `${a.text}-${b.text} ${b.ampm}` : `${a.text} ${a.ampm}-${b.text} ${b.ampm}`;
}

// "Wed, Oct 14, 6:00 PM", or "Wed, Oct 14, end of day" for an accelerator meeting added without a time.
export function formatDue(date, hasTime) {
  const day = date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return hasTime ? `${day}, ${formatTime(`${pad(date.getHours())}:${pad(date.getMinutes())}`)}` : `${day}, end of day`;
}

// ---- Coffee-chat weeks ------------------------------------------------------------------------------

function meetingInfo(event) {
  const day = parseYmd(event.event_date);
  if (event.start_time) {
    const [h, m] = event.start_time.split(":").map(Number);
    return { date: new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m), hasTime: true };
  }
  return { date: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999), hasTime: false };
}

// The first moment at or after `from` that falls on `weekday` at `time` ("HH:MM" or "HH:MM:SS").
function nextMeeting(from, weekday, time) {
  const [h, m] = time.split(":").map(Number);
  let d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + ((weekday - from.getDay() + 7) % 7), h, m);
  if (d < from) d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7, h, m);
  return d;
}

function scheduledPeriods({ lessons, chats, today, schedule }) {
  let anchor = startOfDay(today);
  if (lessons.length) anchor = parseYmd(lessons[0].lesson_date);
  else if (chats.length) anchor = startOfDay(new Date([...chats].map((c) => c.created_at).sort()[0]));
  const ends = [nextMeeting(anchor, schedule.weekday, schedule.time)];
  // Keep going until the week that holds today is included (and at least the usual eight weeks).
  while (ends.length < DEFAULT_PROGRAM_WEEKS || ends[ends.length - 1] < today) {
    const last = ends[ends.length - 1];
    ends.push(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 7, last.getHours(), last.getMinutes()));
  }
  return ends.map((end, i) => ({
    index: i,
    number: i + 1,
    startMs: i === 0 ? -Infinity : ends[i - 1].getTime(),
    endMs: end.getTime(),
    end,
    dueLabel: formatDue(end, true),
    projected: end > today && end.getTime() - today.getTime() > 7 * 86400000,
    byMeeting: true,
  }));
}

// A coffee-chat "week" is the stretch between accelerator meetings, because the three chats are due at each one: a
// chat logged before a meeting (even earlier the same day) counts toward the week that meeting closes, one logged
// after it counts toward the next. So week boundaries are the exact date and time of each accelerator meeting
// (events of kind "accelerator"). If fewer than eight are scheduled the rest are projected a week apart, so the
// target is 24 from day one. With no accelerator meetings on the calendar yet it falls back to eight Sunday-to-
// Saturday weeks from the first lesson (or first chat, or today).
//
// When the admin has set the weekly meeting day and time (`schedule`: { weekday: 0-6, time: "HH:MM" }) that wins over
// the calendar: a week closes at that moment every week, with no end, so the count resets each week for as long as the
// program runs.
export function programPeriods(events, { lessons = [], chats = [], today = new Date(), schedule = null } = {}) {
  if (schedule) return scheduledPeriods({ lessons, chats, today, schedule });
  const meetings = events
    .filter((e) => e.kind === "accelerator")
    .map(meetingInfo)
    .sort((a, b) => a.date - b.date);

  if (meetings.length === 0) {
    let anchor = startOfDay(today);
    if (lessons.length) anchor = parseYmd(lessons[0].lesson_date);
    else if (chats.length) anchor = startOfDay(new Date([...chats].map((c) => c.created_at).sort()[0]));
    const start = startOfWeek(anchor);
    return Array.from({ length: DEFAULT_PROGRAM_WEEKS }, (_, i) => {
      const weekStart = addDays(start, i * 7);
      const end = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6, 23, 59, 59, 999);
      return { index: i, number: i + 1, startMs: weekStart.getTime() - 1, endMs: end.getTime(), end, dueLabel: formatDue(end, false).replace(", end of day", ""), projected: false, byMeeting: false };
    });
  }

  const ends = meetings.map((m) => ({ ...m, projected: false }));
  while (ends.length < DEFAULT_PROGRAM_WEEKS) {
    const last = ends[ends.length - 1];
    ends.push({ date: new Date(last.date.getFullYear(), last.date.getMonth(), last.date.getDate() + 7, last.date.getHours(), last.date.getMinutes(), last.date.getSeconds(), last.date.getMilliseconds()), hasTime: last.hasTime, projected: true });
  }
  return ends.map((m, i) => ({
    index: i,
    number: i + 1,
    startMs: i === 0 ? -Infinity : ends[i - 1].date.getTime(),
    endMs: m.date.getTime(),
    end: m.date,
    dueLabel: formatDue(m.date, m.hasTime),
    projected: m.projected,
    byMeeting: true,
  }));
}

// One week's three slots. Club members fill the two club slots first; the third takes a leftover club member or,
// failing that, an intern. A chat with an intern while the third slot is already used fills nothing, so the form
// uses canLogClub / canLogIntern to steer an intern toward a chat that will count.
export function coffeeChatSlots(chatsInWeek) {
  const ordered = [...chatsInWeek].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const club = ordered.filter((c) => c.is_uc_member);
  const interns = ordered.filter((c) => !c.is_uc_member);
  const filled = [club[0] ?? null, club[1] ?? null, club[2] ?? interns[0] ?? null];
  const counted = filled.filter(Boolean).length;
  return {
    slots: filled.map((chat, i) => ({ label: CHAT_SLOT_LABELS[i], chat })),
    counted,
    clubCount: club.length,
    done: counted === CHATS_PER_WEEK,
    canLogClub: club.length < CLUB_CHATS_PER_WEEK || filled[2] === null,
    canLogIntern: filled[2] === null,
  };
}

export function coffeeChatProgress(chats, periods, now = new Date()) {
  const nowMs = now.getTime();
  const perWeek = periods.map((period) => {
    const inWeek = chats.filter((c) => {
      const t = Date.parse(c.created_at);
      return t > period.startMs && t <= period.endMs;
    });
    const slots = coffeeChatSlots(inWeek);
    return {
      ...period,
      ...slots,
      chats: inWeek,
      isCurrent: nowMs > period.startMs && nowMs <= period.endMs,
      isPast: nowMs > period.endMs,
    };
  });
  const counted = perWeek.reduce((sum, w) => sum + w.counted, 0);
  return {
    perWeek,
    counted,
    target: periods.length * CHATS_PER_WEEK,
    current: perWeek.find((w) => w.isCurrent) ?? null,
    // Closed weeks that ended without all three slots filled.
    behind: perWeek.filter((w) => w.isPast && !w.done),
  };
}

// ---- Attendance -----------------------------------------------------------------------------------

// Required events whose day has come count toward "x of y required". Socials are optional, but an intern who
// has gone to none of the socials that already happened is flagged.
export function attendanceProgress(events, attendance, today = new Date()) {
  const todayKey = ymd(today);
  const attendedIds = new Set(attendance.filter((a) => a.attended).map((a) => a.event_id));
  const recordedIds = new Set(attendance.map((a) => a.event_id));
  const happened = events.filter((e) => e.event_date <= todayKey);
  const required = happened.filter((e) => e.required);
  const socials = happened.filter((e) => e.kind === "social");
  const requiredAttended = required.filter((e) => attendedIds.has(e.id));
  const socialsAttended = socials.filter((e) => attendedIds.has(e.id));
  return {
    attendedIds,
    recordedIds,
    requiredSoFar: required.length,
    requiredAttended: requiredAttended.length,
    totalRequired: events.filter((e) => e.required).length,
    socialsSoFar: socials.length,
    socialsAttended: socialsAttended.length,
    noSocials: socials.length > 0 && socialsAttended.length === 0,
  };
}

// For one event: what the intern's tracker shows.
export function attendanceStatus(event, progress, today = new Date()) {
  const todayKey = ymd(today);
  if (progress.attendedIds.has(event.id)) return "attended";
  if (event.event_date > todayKey) return "upcoming";
  if (event.event_date === todayKey && !progress.recordedIds.has(event.id)) return "today";
  return progress.recordedIds.has(event.id) ? "missed" : "not_recorded";
}

// ---- Assignments ----------------------------------------------------------------------------------

export function submissionState(submission) {
  if (!submission) return "not_started";
  if (submission.status === "complete") return "complete";
  if (submission.status === "incomplete") return "incomplete";
  return "awaiting_review";
}

export function assignmentProgress(lessons, submissions) {
  const byLesson = new Map(submissions.map((s) => [s.lesson_id, s]));
  const states = lessons.map((l) => submissionState(byLesson.get(l.id)));
  const count = (state) => states.filter((s) => s === state).length;
  return {
    total: lessons.length,
    // Handed in and not waiting on the intern: complete, or submitted and waiting for the committee. Incomplete work is
    // sent back, so it is not counted until it is fixed and resubmitted.
    submitted: count("complete") + count("awaiting_review"),
    complete: count("complete"),
    incomplete: count("incomplete"),
    awaitingReview: count("awaiting_review"),
    notStarted: count("not_started"),
  };
}
