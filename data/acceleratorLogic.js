// Pure logic for the intern accelerator tracker (calendar, coffee chats, attendance, assignments).
// No database or React in here so it is unit-tested directly (server/tests/acceleratorLogic.test.ts).
//
// Dates travel as "YYYY-MM-DD" strings (what Postgres `date` columns return) and are handled as LOCAL dates:
// `new Date("2026-10-12")` would parse as UTC midnight and show as the 11th west of Greenwich.

export const CHATS_PER_WEEK = 3;
export const UC_CHATS_PER_WEEK = 2;
export const DEFAULT_PROGRAM_WEEKS = 8;

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
    location: null,
  }));
  const eventItems = events.map((e) => ({
    id: e.id,
    title: e.title,
    date: e.event_date,
    time: e.start_time ? e.start_time.slice(0, 5) : null,
    kind: e.kind,
    required: e.required,
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

// ---- Program weeks and coffee chats ---------------------------------------------------------------

// The program is eight Sunday-to-Saturday weeks (more if the curriculum has more lessons), starting with the week
// of the first lesson, so the coffee-chat target is 24 from day one rather than growing as lessons are added.
// Before any lesson exists weeks start at the first chat (or today).
export function programWeeks(lessons, chats = [], today = new Date()) {
  const count = Math.max(lessons.length, DEFAULT_PROGRAM_WEEKS);
  let anchor;
  if (lessons.length) anchor = parseYmd(lessons[0].lesson_date);
  else if (chats.length) anchor = parseYmd([...chats].map((c) => c.chat_date).sort()[0]);
  else anchor = startOfDay(today);
  const start = startOfWeek(anchor);
  return Array.from({ length: count }, (_, i) => {
    const weekStart = addDays(start, i * 7);
    return { index: i, number: i + 1, start: weekStart, end: addDays(weekStart, 6), startKey: ymd(weekStart), endKey: ymd(addDays(weekStart, 6)) };
  });
}

export function coffeeChatProgress(chats, weeks, today = new Date()) {
  const todayKey = ymd(today);
  const perWeek = weeks.map((week) => {
    const inWeek = chats.filter((c) => c.chat_date >= week.startKey && c.chat_date <= week.endKey);
    const uc = inWeek.filter((c) => c.is_uc_member).length;
    const counted = Math.min(CHATS_PER_WEEK, inWeek.length);
    const done = inWeek.length >= CHATS_PER_WEEK && uc >= UC_CHATS_PER_WEEK;
    // Three chats logged but fewer than two with UC members: the week's rule isn't met.
    const needsUc = inWeek.length >= CHATS_PER_WEEK && uc < UC_CHATS_PER_WEEK;
    return {
      ...week,
      chats: inWeek,
      total: inWeek.length,
      uc,
      counted,
      done,
      needsUc,
      isCurrent: todayKey >= week.startKey && todayKey <= week.endKey,
      isPast: todayKey > week.endKey,
    };
  });
  const counted = perWeek.reduce((sum, w) => sum + w.counted, 0);
  return {
    perWeek,
    counted,
    target: weeks.length * CHATS_PER_WEEK,
    current: perWeek.find((w) => w.isCurrent) ?? null,
    // Past weeks that ended short of 3 chats or without enough UC members.
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
    complete: count("complete"),
    incomplete: count("incomplete"),
    awaitingReview: count("awaiting_review"),
    notStarted: count("not_started"),
  };
}
