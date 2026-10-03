import { describe, it, expect, vi } from "vitest";

// notificationUtils reads feedSync.js, which opens a Supabase client at import time; only relativeTime is used.
vi.mock("../../data/feedSync.js", () => ({ relativeTime: () => "just now" }));

// The member-facing logic is plain JS in data/, so these import it untyped.
// @ts-expect-error -- untyped JS module
import { matchJob } from "../../data/jobMatch.js";
// @ts-expect-error -- untyped JS module
import { computeVisitBaseline, isNewSince } from "../../data/jobVisit.js";
// @ts-expect-error -- untyped JS module
import { buildNotifications } from "../../data/notificationUtils.js";
// @ts-expect-error -- untyped JS module
import { NEUTRAL_FILTERS } from "../../data/jobFilters.js";

const DAY = 86400000;
const NOW = Date.UTC(2026, 9, 3, 12, 0, 0);

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

describe("visit baseline", () => {
  it("treats the first visit as 'the last week is new'", () => {
    const storage = fakeStorage();
    expect(computeVisitBaseline("a", NOW, storage)).toBe(NOW - 7 * DAY);
  });

  it("keeps the baseline stable while the visit continues", () => {
    const storage = fakeStorage();
    const first = computeVisitBaseline("a", NOW, storage);
    expect(computeVisitBaseline("a", NOW + 10 * 60000, storage)).toBe(first);
    expect(computeVisitBaseline("a", NOW + 25 * 60000, storage)).toBe(first);
  });

  it("moves the baseline to the previous visit's last activity after a gap", () => {
    const storage = fakeStorage();
    computeVisitBaseline("a", NOW, storage);
    computeVisitBaseline("a", NOW + 20 * 60000, storage);
    const next = NOW + 3 * DAY;
    expect(computeVisitBaseline("a", next, storage)).toBe(NOW + 20 * 60000);
  });

  it("never looks back more than two weeks", () => {
    const storage = fakeStorage();
    computeVisitBaseline("a", NOW, storage);
    const much = NOW + 90 * DAY;
    expect(computeVisitBaseline("a", much, storage)).toBe(much - 14 * DAY);
  });

  it("keeps each account's marker separate", () => {
    const storage = fakeStorage();
    computeVisitBaseline("a", NOW, storage);
    expect(computeVisitBaseline("b", NOW + 2 * DAY, storage)).toBe(NOW + 2 * DAY - 7 * DAY);
  });

  it("survives unreadable or blocked storage", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(computeVisitBaseline("a", NOW, broken)).toBe(NOW - 7 * DAY);
    expect(computeVisitBaseline("a", NOW, fakeStorage({ "uc-portal-jobs-visit:a": "{not json" }))).toBe(NOW - 7 * DAY);
  });

  it("isNewSince needs both a baseline and an added time", () => {
    expect(isNewSince({ addedAt: NOW }, NOW - 1)).toBe(true);
    expect(isNewSince({ addedAt: NOW - 5 }, NOW)).toBe(false);
    expect(isNewSince({ addedAt: null }, NOW)).toBe(false);
    expect(isNewSince({ addedAt: NOW }, null)).toBe(false);
  });
});

describe("Y Combinator preference in the match score", () => {
  const job = { title: "Business Analyst", company: "Acme", graduation_years: [], employment_type: "internship" };
  const base = { industries: [], roles: ["Analyst"], skills: [], locations: [], followedCompanies: [], opportunityType: "Both", compTarget: 35 };

  it("does nothing unless the member asked for it", () => {
    const off = matchJob(job, { ...base, preferYc: false }, "2027", null, "W12");
    expect(off.factors.some((f: { key: string }) => f.key === "yc")).toBe(false);
    expect(off.score).toBe(matchJob(job, { ...base, preferYc: false }, "2027", null, null).score);
  });

  it("raises a YC company above an otherwise identical one", () => {
    const prefs = { ...base, preferYc: true };
    const yc = matchJob(job, prefs, "2027", null, "W12");
    const other = matchJob(job, prefs, "2027", null, null);
    expect(yc.score).toBeGreaterThan(other.score);
    expect(yc.factors.find((f: { key: string }) => f.key === "yc")).toMatchObject({ match: true, label: "Backed by Y Combinator (W12)" });
    expect(other.factors.find((f: { key: string }) => f.key === "yc")).toMatchObject({ match: false });
  });
});

describe("job alerts", () => {
  const baseline = NOW - 2 * DAY;
  const card = (id: string, company: string, over: Record<string, unknown> = {}) => ({
    id,
    company,
    role: "Analyst",
    matchEligible: true,
    matchScore: 80,
    addedAt: NOW - DAY,
    postedDaysAgo: 30,
    type: "Internship",
    classYears: [],
    industries: [],
    places: [],
    workMode: "In-person",
    compHourly: false,
    ...over,
  });
  const call = (extra: Record<string, unknown>) =>
    buildNotifications({ trackedJobs: {}, prepLogged: {}, coffeeChatStatus: {}, visitBaseline: baseline, ...extra }).earlierThisWeek.filter(
      (n: { category: string }) => n.category === "Jobs"
    );

  it("counts new roles at followed companies, strong matches, and saved searches separately", () => {
    const realJobs = [
      card("1", "Stripe"),
      card("2", "Stripe", { matchScore: 40 }),
      card("3", "Other", { matchScore: 90 }),
      card("old", "Stripe", { addedAt: NOW - 5 * DAY }),
      card("ineligible", "Stripe", { matchEligible: false }),
    ];
    const alerts = call({
      realJobs,
      followedCompanies: ["Stripe"],
      savedSearches: [{ id: "s1", label: "Stripe roles", filters: { ...NEUTRAL_FILTERS, keyword: "Stripe" } }],
    });
    const by = (id: string) => alerts.find((n: { id: string }) => n.id === id);
    expect(by("jobs-new-followed").headline).toBe("2 new roles at Stripe");
    expect(by("jobs-new-matches").headline).toBe("2 new roles matched your profile");
    expect(by("jobs-new-search-s1").headline).toBe('2 new roles for your saved search "Stripe roles"');
    expect(by("jobs-new-search-s1").href).toBe("/jobs?savedSearch=s1");
  });

  it("stays quiet when nothing is new, the setting is off, or the baseline is unknown", () => {
    const realJobs = [card("old", "Stripe", { addedAt: NOW - 5 * DAY })];
    expect(call({ realJobs, followedCompanies: ["Stripe"] })).toEqual([]);
    expect(call({ realJobs: [card("1", "Stripe")], followedCompanies: ["Stripe"], jobAlertsEnabled: false })).toEqual([]);
    expect(call({ realJobs: [card("1", "Stripe")], followedCompanies: ["Stripe"], visitBaseline: null })).toEqual([]);
  });

  it("names the count when several followed companies have new roles", () => {
    const alerts = call({ realJobs: [card("1", "A"), card("2", "B")], followedCompanies: ["A", "B"] });
    expect(alerts.find((n: { id: string }) => n.id === "jobs-new-followed").headline).toBe("2 new roles at 2 companies you follow");
  });
});
