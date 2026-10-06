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

describe("coffee chats", () => {
  const lessons = Array.from({ length: 3 }, (_, i) => ({ id: String(i), title: `L${i}`, lesson_date: L.ymd(d(2026, 10, 12 + i * 7)) }));
  const weeks = L.programWeeks(lessons, [], d(2026, 10, 13));
  const chat = (date: string, uc: boolean) => ({ chat_date: date, is_uc_member: uc });

  it("runs eight Sunday-to-Saturday weeks from the first lesson's week, even with fewer lessons so far", () => {
    expect(weeks).toHaveLength(8);
    expect(weeks[0].startKey).toBe("2026-10-11");
    expect(weeks[0].endKey).toBe("2026-10-17");
    expect(weeks[2].startKey).toBe("2026-10-25");
  });

  it("grows past eight when the curriculum has more lessons", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ id: String(i), title: "L", lesson_date: L.ymd(d(2026, 10, 12 + i * 7)) }));
    expect(L.programWeeks(many, [], d(2026, 10, 13))).toHaveLength(10);
  });

  it("falls back to eight weeks before any lesson exists", () => {
    expect(L.programWeeks([], [], d(2026, 10, 14))).toHaveLength(8);
    expect(L.ymd(L.programWeeks([], [], d(2026, 10, 14))[0].start)).toBe("2026-10-11");
  });

  it("targets three chats a week and caps each week at three", () => {
    const chats = [chat("2026-10-12", true), chat("2026-10-13", true), chat("2026-10-14", false), chat("2026-10-15", true), chat("2026-10-26", true)];
    const p = L.coffeeChatProgress(chats, weeks, d(2026, 10, 20));
    expect(p.target).toBe(24);
    expect(p.perWeek[0].counted).toBe(3); // four chats, three count
    expect(p.perWeek[2].counted).toBe(1);
    expect(p.counted).toBe(4);
  });

  it("requires two UC members among a week's chats", () => {
    const ok = L.coffeeChatProgress([chat("2026-10-12", true), chat("2026-10-13", true), chat("2026-10-14", false)], weeks, d(2026, 10, 14));
    expect(ok.perWeek[0].done).toBe(true);
    const short = L.coffeeChatProgress([chat("2026-10-12", true), chat("2026-10-13", false), chat("2026-10-14", false)], weeks, d(2026, 10, 14));
    expect(short.perWeek[0].done).toBe(false);
    expect(short.perWeek[0].needsUc).toBe(true);
  });

  it("finds this week and the past weeks that fell short", () => {
    const p = L.coffeeChatProgress([chat("2026-10-12", true)], weeks, d(2026, 10, 20));
    expect(p.current.number).toBe(2);
    expect(p.behind.map((w: { number: number }) => w.number)).toEqual([1]);
  });

  it("ignores chats outside the program's weeks", () => {
    const p = L.coffeeChatProgress([chat("2026-09-01", true), chat("2027-02-01", true)], weeks, d(2026, 10, 14));
    expect(p.counted).toBe(0);
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
    expect(p).toEqual({ total: 4, complete: 1, incomplete: 1, awaitingReview: 1, notStarted: 1 });
  });
});
