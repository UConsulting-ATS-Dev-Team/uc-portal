import { describe, it, expect } from "vitest";
// The tracker's logic is plain JS in data/ (shared by the pages), so these import it untyped.
// @ts-expect-error -- untyped JS module
import * as L from "../../data/acceleratorLogic.js";

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

describe("calendar weeks run Sunday to Saturday", () => {
  it("finds the Sunday a week starts on", () => {
    expect(L.ymd(L.startOfWeek(d(2026, 10, 14)))).toBe("2026-10-11"); // a Wednesday
    expect(L.ymd(L.startOfWeek(d(2026, 10, 11)))).toBe("2026-10-11"); // a Sunday
    expect(L.ymd(L.startOfWeek(d(2026, 10, 17)))).toBe("2026-10-11"); // a Saturday
  });

  it("lays October 2026 out in five Sunday-first rows", () => {
    const weeks = L.monthGrid(2026, 9);
    expect(weeks).toHaveLength(5);
    expect(weeks.every((w: unknown[]) => w.length === 7)).toBe(true);
    expect(weeks[0][0].key).toBe("2026-09-27"); // Oct 1 is a Thursday, so the grid opens on the prior Sunday
    expect(weeks[0][0].inMonth).toBe(false);
    expect(weeks[0][4].key).toBe("2026-10-01");
    expect(weeks[0][4].inMonth).toBe(true);
    expect(weeks[4][6].key).toBe("2026-10-31");
    weeks.forEach((w: Array<{ date: Date }>) => expect(w[0].date.getDay()).toBe(0));
  });

  it("uses only the rows a month needs", () => {
    expect(L.monthGrid(2026, 1)).toHaveLength(4); // Feb 2026 starts on a Sunday and has 28 days
    expect(L.monthGrid(2026, 7)).toHaveLength(6); // Aug 2026 starts on a Saturday and has 31 days
  });
});

describe("which month the calendar opens on", () => {
  it("stays on the current month until its last calendar row", () => {
    expect(L.monthToShow(d(2026, 10, 3))).toEqual({ year: 2026, month: 9 });
    expect(L.monthToShow(d(2026, 10, 24))).toEqual({ year: 2026, month: 9 }); // Saturday, last day before the final row
  });

  it("switches to next month once the week holding the month's last day begins", () => {
    expect(L.monthToShow(d(2026, 10, 25))).toEqual({ year: 2026, month: 10 }); // Sunday that opens Oct 25-31
    expect(L.monthToShow(d(2026, 10, 31))).toEqual({ year: 2026, month: 10 });
  });

  it("switches when the next month starts partway through the week", () => {
    expect(L.monthToShow(d(2026, 8, 29))).toEqual({ year: 2026, month: 7 }); // Saturday before the Aug 30 - Sep 5 row
    expect(L.monthToShow(d(2026, 8, 30))).toEqual({ year: 2026, month: 8 }); // that row holds Aug 30-31 and Sep 1-5
    expect(L.monthToShow(d(2026, 9, 2))).toEqual({ year: 2026, month: 8 }); // early September is September
  });

  it("handles a month whose last day is a Sunday", () => {
    expect(L.monthToShow(d(2026, 5, 30))).toEqual({ year: 2026, month: 4 });
    expect(L.monthToShow(d(2026, 5, 31))).toEqual({ year: 2026, month: 5 });
  });

  it("rolls the year over in December", () => {
    expect(L.monthToShow(d(2026, 12, 26))).toEqual({ year: 2026, month: 11 });
    expect(L.monthToShow(d(2026, 12, 27))).toEqual({ year: 2027, month: 0 });
  });

  it("steps months across a year boundary", () => {
    expect(L.shiftMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
    expect(L.shiftMonth({ year: 2027, month: 0 }, -1)).toEqual({ year: 2026, month: 11 });
  });
});

describe("calendar items", () => {
  const lessons = [
    { id: "a", title: "Resumes", lesson_date: "2026-10-12" },
    { id: "b", title: "Cases", lesson_date: "2026-10-19" },
  ];
  const events = [
    { id: "e1", title: "GM", event_date: "2026-10-12", start_time: "19:00:00", kind: "gm", required: true, location: null },
    { id: "e2", title: "Mixer", event_date: "2026-10-16", start_time: null, kind: "social", required: false, location: "Campus" },
  ];

  it("merges lessons in as numbered weeks, in date order", () => {
    const items = L.calendarItems(events, lessons);
    // On the same day an item with no time sorts ahead of a timed one.
    expect(items.map((i: { title: string }) => i.title)).toEqual(["Week 1: Resumes", "GM", "Mixer", "Week 2: Cases"]);
    expect(items.find((i: { id: string }) => i.id === "e1").time).toBe("19:00");
  });

  it("styles accelerator work blue, other required items solid, optional dashed", () => {
    const [week1, gm, mixer] = L.calendarItems(events, lessons);
    expect(L.chipStyleFor(week1)).toBe("accelerator");
    expect(L.chipStyleFor(gm)).toBe("required");
    expect(L.chipStyleFor(mixer)).toBe("optional");
  });

  it("formats times", () => {
    expect(L.formatTime("19:00")).toBe("7:00 PM");
    expect(L.formatTime("09:05:00")).toBe("9:05 AM");
    expect(L.formatTime("00:30")).toBe("12:30 AM");
    expect(L.formatTime(null)).toBe("");
  });
});

describe("recurring events", () => {
  it("repeats weekly up to and including the end date", () => {
    const dates = L.expandRecurrence("2026-10-14", "2026-12-02", 1);
    expect(dates).toHaveLength(8);
    expect(dates[0]).toBe("2026-10-14");
    expect(dates[7]).toBe("2026-12-02");
  });

  it("repeats every other week", () => {
    expect(L.expandRecurrence("2026-10-14", "2026-12-02", 2)).toEqual(["2026-10-14", "2026-10-28", "2026-11-11", "2026-11-25"]);
  });

  it("makes one event when the end is the start, and none when the end is before it", () => {
    expect(L.expandRecurrence("2026-10-14", "2026-10-14")).toEqual(["2026-10-14"]);
    expect(L.expandRecurrence("2026-10-14", "2026-10-13")).toEqual([]);
  });

  it("caps a runaway end date", () => {
    expect(L.expandRecurrence("2026-01-01", "2030-01-01")).toHaveLength(L.MAX_RECURRING_EVENTS);
  });

  it("keeps the same weekday across a daylight saving change", () => {
    const dates = L.expandRecurrence("2026-10-28", "2026-11-18", 1); // clocks go back Nov 1
    expect(dates.map((k: string) => L.parseYmd(k).getDay())).toEqual([3, 3, 3, 3]);
  });

  it("takes attendance by committee for meetings and by photo for everything else", () => {
    expect(L.defaultAttendanceMethod("gm")).toBe("admin");
    expect(L.defaultAttendanceMethod("accelerator")).toBe("admin");
    for (const kind of ["firm", "uc_event", "social"]) expect(L.defaultAttendanceMethod(kind)).toBe("photo");
  });
});

describe("coffee-chat weeks close at each accelerator meeting", () => {
  // Wednesday meetings at 6 PM: Oct 14, 21, 28.
  const meeting = (date: string, time: string | null = "18:00:00") => ({ id: date, event_date: date, start_time: time, kind: "accelerator" });
  const events = [meeting("2026-10-14"), meeting("2026-10-21"), meeting("2026-10-28"), { id: "gm", event_date: "2026-10-12", start_time: "19:00:00", kind: "gm" }];
  const at = (y: number, m: number, day: number, h: number, min = 0) => new Date(y, m - 1, day, h, min);
  const chat = (when: Date, uc: boolean, name = "x") => ({ id: `${name}-${when.getTime()}`, created_at: when.toISOString(), chat_date: L.ymd(when), is_uc_member: uc, contact_name: name });

  it("uses the exact date and time of each meeting, ignoring other event types", () => {
    const periods = L.programPeriods(events);
    expect(periods[0].startMs).toBe(-Infinity);
    expect(periods[0].endMs).toBe(at(2026, 10, 14, 18).getTime());
    expect(periods[1].startMs).toBe(at(2026, 10, 14, 18).getTime());
    expect(periods[1].endMs).toBe(at(2026, 10, 21, 18).getTime());
    expect(periods[0].dueLabel).toContain("6:00 PM");
    expect(periods[0].byMeeting).toBe(true);
  });

  it("projects the remaining weeks so the target is 24 from day one", () => {
    const periods = L.programPeriods(events);
    expect(periods).toHaveLength(8);
    expect(periods.slice(0, 3).every((p: { projected: boolean }) => !p.projected)).toBe(true);
    expect(periods.slice(3).every((p: { projected: boolean }) => p.projected)).toBe(true);
    expect(periods[3].endMs).toBe(at(2026, 11, 4, 18).getTime());
  });

  it("treats a meeting without a time as closing at the end of its day", () => {
    const periods = L.programPeriods([meeting("2026-10-14", null)]);
    expect(periods[0].endMs).toBe(new Date(2026, 9, 14, 23, 59, 59, 999).getTime());
    expect(periods[0].dueLabel).toContain("end of day");
  });

  it("counts a chat logged before the meeting toward that week, and one logged after toward the next", () => {
    const periods = L.programPeriods(events);
    const before = chat(at(2026, 10, 14, 17, 59), true, "before");
    const after = chat(at(2026, 10, 14, 18, 1), true, "after");
    const p = L.coffeeChatProgress([before, after], periods, at(2026, 10, 15, 9));
    expect(p.perWeek[0].chats.map((c: { contact_name: string }) => c.contact_name)).toEqual(["before"]);
    expect(p.perWeek[1].chats.map((c: { contact_name: string }) => c.contact_name)).toEqual(["after"]);
  });

  it("counts a chat logged exactly at the meeting time toward the week it closes", () => {
    const periods = L.programPeriods(events);
    const p = L.coffeeChatProgress([chat(at(2026, 10, 14, 18, 0), true)], periods, at(2026, 10, 15));
    expect(p.perWeek[0].chats.length).toBe(1);
  });

  it("caps each week at three, so an early burst can't pre-fill later weeks", () => {
    const periods = L.programPeriods(events);
    const burst = Array.from({ length: 10 }, (_, i) => chat(at(2026, 10, 8, 9, i), i < 6, `c${i}`));
    const p = L.coffeeChatProgress(burst, periods, at(2026, 10, 9));
    expect(p.perWeek[0].counted).toBe(3);
    expect(p.perWeek[1].counted).toBe(0);
    expect(p.counted).toBe(3);
    expect(p.target).toBe(24);
  });

  it("finds this week, closed weeks that fell short, and ignores chats after the last week", () => {
    const periods = L.programPeriods(events);
    const p = L.coffeeChatProgress([chat(at(2026, 10, 10, 9), true), chat(at(2027, 3, 1, 9), true)], periods, at(2026, 10, 15, 9));
    expect(p.current.number).toBe(2);
    expect(p.behind.map((w: { number: number }) => w.number)).toEqual([1]);
    expect(p.counted).toBe(1);
  });

  it("has no current week once the last meeting has passed", () => {
    const periods = L.programPeriods(events);
    expect(L.coffeeChatProgress([], periods, at(2027, 3, 1, 9)).current).toBe(null);
  });

  it("falls back to Sunday-to-Saturday weeks from the first lesson when no meeting is scheduled", () => {
    const periods = L.programPeriods([], { lessons: [{ id: "a", title: "L", lesson_date: "2026-10-12" }], today: at(2026, 10, 13, 9) });
    expect(periods).toHaveLength(8);
    expect(periods[0].byMeeting).toBe(false);
    expect(periods[0].endMs).toBe(new Date(2026, 9, 17, 23, 59, 59, 999).getTime()); // Saturday after Sun Oct 11
    expect(periods[1].startMs).toBe(new Date(2026, 9, 18).getTime() - 1);
  });

  it("resets every week at the day and time the admin set, with no end", () => {
    const schedule = { weekday: 3, time: "18:00" }; // Wednesdays 6 PM
    const today = at(2027, 3, 1, 9); // months later, a Monday
    const periods = L.programPeriods([], { lessons: [{ id: "a", title: "L", lesson_date: "2026-10-12" }], today, schedule });
    expect(periods[0].endMs).toBe(at(2026, 10, 14, 18).getTime());
    expect(periods[1].endMs).toBe(at(2026, 10, 21, 18).getTime());
    const p = L.coffeeChatProgress([chat(at(2027, 2, 23, 9), true), chat(at(2027, 2, 24, 19), true), chat(at(2027, 2, 28, 9), true)], periods, today);
    expect(p.current.endMs).toBe(at(2027, 3, 3, 18).getTime());
    expect(p.current.counted).toBe(2); // the Feb 23 chat belongs to last week; the two logged since Wed Feb 24 6 PM count now
  });
});

describe("coffee-chat slots: two with club members, one with an intern or a third club member", () => {
  const c = (n: number, uc: boolean) => ({ id: String(n), created_at: new Date(2026, 9, 10, 9, n).toISOString(), is_uc_member: uc, contact_name: `p${n}` });
  const names = (slots: Array<{ chat: { contact_name: string } | null }>) => slots.map((s) => s.chat?.contact_name ?? null);

  it("labels the three slots", () => {
    expect(L.coffeeChatSlots([]).slots.map((s: { label: string }) => s.label)).toEqual(["Club member", "Club member", "Intern or club member"]);
  });

  it("starts with everything open", () => {
    const r = L.coffeeChatSlots([]);
    expect(r.counted).toBe(0);
    expect(r.canLogClub).toBe(true);
    expect(r.canLogIntern).toBe(true);
  });

  it("fills club slots first, then the third with an intern", () => {
    const r = L.coffeeChatSlots([c(1, true), c(2, true), c(3, false)]);
    expect(names(r.slots)).toEqual(["p1", "p2", "p3"]);
    expect(r.done).toBe(true);
    expect(r.canLogClub).toBe(false);
    expect(r.canLogIntern).toBe(false);
  });

  it("lets a third club member take the third slot", () => {
    const r = L.coffeeChatSlots([c(1, true), c(2, true), c(3, true)]);
    expect(r.done).toBe(true);
  });

  it("puts an early intern chat in the third slot, leaving the club slots open", () => {
    const r = L.coffeeChatSlots([c(1, false)]);
    expect(names(r.slots)).toEqual([null, null, "p1"]);
    expect(r.counted).toBe(1);
    expect(r.canLogIntern).toBe(false); // the intern slot is used
    expect(r.canLogClub).toBe(true);
  });

  it("does not count a second intern chat while club slots are still open", () => {
    const r = L.coffeeChatSlots([c(1, false), c(2, false), c(3, true)]);
    expect(names(r.slots)).toEqual(["p3", null, "p1"]);
    expect(r.counted).toBe(2);
    expect(r.done).toBe(false);
  });

  it("keeps one club and one intern open to the right kind of chat", () => {
    const r = L.coffeeChatSlots([c(1, true), c(2, false)]);
    expect(r.counted).toBe(2);
    expect(r.canLogClub).toBe(true); // a second club slot is open
    expect(r.canLogIntern).toBe(false);
  });
});

describe("attendance", () => {
  const events = [
    { id: "gm1", event_date: "2026-10-05", kind: "gm", required: true },
    { id: "gm2", event_date: "2026-10-12", kind: "gm", required: true },
    { id: "s1", event_date: "2026-10-09", kind: "social", required: false },
    { id: "gm3", event_date: "2026-10-26", kind: "gm", required: true },
  ];
  const today = d(2026, 10, 14);

  it("counts required events that have happened, and what was attended", () => {
    const p = L.attendanceProgress(events, [{ event_id: "gm1", attended: true }, { event_id: "gm2", attended: false }], today);
    expect(p.requiredSoFar).toBe(2);
    expect(p.requiredAttended).toBe(1);
    expect(p.totalRequired).toBe(3);
  });

  it("flags an intern who has missed every social so far, but not before one happens", () => {
    expect(L.attendanceProgress(events, [], today).noSocials).toBe(true);
    expect(L.attendanceProgress(events, [{ event_id: "s1", attended: true }], today).noSocials).toBe(false);
    expect(L.attendanceProgress(events, [], d(2026, 10, 8)).noSocials).toBe(false);
  });

  it("describes each event's status", () => {
    const p = L.attendanceProgress(events, [{ event_id: "gm1", attended: true }, { event_id: "gm2", attended: false }], today);
    const status = (id: string) => L.attendanceStatus(events.find((e) => e.id === id), p, today);
    expect(status("gm1")).toBe("attended");
    expect(status("gm2")).toBe("missed");
    expect(status("s1")).toBe("not_recorded");
    expect(status("gm3")).toBe("upcoming");
    expect(L.attendanceStatus({ id: "x", event_date: "2026-10-14" }, p, today)).toBe("today");
  });
});

describe("assignments", () => {
  const lessons = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];

  it("reads a submission's state from its status", () => {
    expect(L.submissionState(undefined)).toBe("not_started");
    expect(L.submissionState({ status: null })).toBe("awaiting_review");
    expect(L.submissionState({ status: "complete" })).toBe("complete");
    expect(L.submissionState({ status: "incomplete" })).toBe("incomplete");
  });

  it("tallies complete, incomplete, awaiting and not started", () => {
    const p = L.assignmentProgress(lessons, [
      { lesson_id: "a", status: "complete" },
      { lesson_id: "b", status: "incomplete" },
      { lesson_id: "c", status: null },
    ]);
    expect(p).toEqual({ total: 4, submitted: 2, complete: 1, incomplete: 1, awaitingReview: 1, notStarted: 1 });
  });
});

describe("due dates", () => {
  const at = (y: number, m: number, day: number, h = 0) => new Date(y, m - 1, day, h);
  it("counts whole days from today to a due date", () => {
    expect(L.daysUntil("2026-10-14", at(2026, 10, 14, 15))).toBe(0);
    expect(L.daysUntil("2026-10-17", at(2026, 10, 14, 23))).toBe(3);
    expect(L.daysUntil("2026-10-12", at(2026, 10, 14, 1))).toBe(-2);
  });

  it("words the distance plainly", () => {
    expect([0, 1, 4, -1, -3].map(L.dueWording)).toEqual(["today", "tomorrow", "in 4 days", "yesterday", "3 days ago"]);
  });
});
