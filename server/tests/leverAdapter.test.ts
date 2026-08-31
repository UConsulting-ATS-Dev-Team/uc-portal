import { describe, expect, it } from "vitest";
import { buildLeverLocationText, hostedUrlMatchesSlug, leverPostedDate, type LeverPosting } from "../src/leverAdapter.js";

function posting(overrides: Partial<LeverPosting> = {}): LeverPosting {
  return {
    id: "78d6f6d5-1f08-4d5d-87be-c4250567bfb5",
    text: "Android Engineer",
    categories: { commitment: "Full-time", location: "Palo Alto, CA" },
    workplaceType: "onsite",
    country: "US",
    createdAt: 1694463796009,
    hostedUrl: "https://jobs.lever.co/wealthfront/78d6f6d5-1f08-4d5d-87be-c4250567bfb5",
    applyUrl: "https://jobs.lever.co/wealthfront/78d6f6d5-1f08-4d5d-87be-c4250567bfb5/apply",
    ...overrides,
  };
}

describe("buildLeverLocationText", () => {
  it("passes through bare place text for an onsite posting unchanged", () => {
    expect(buildLeverLocationText(posting({ workplaceType: "onsite" }))).toBe("Palo Alto, CA");
  });

  it("appends a (Remote) suffix so the shared location normalizer's remote detection catches it", () => {
    expect(buildLeverLocationText(posting({ workplaceType: "remote" }))).toBe("Palo Alto, CA (Remote)");
  });

  it("falls back to bare 'Remote' when a remote posting has no place text", () => {
    expect(buildLeverLocationText(posting({ workplaceType: "remote", categories: { commitment: "Full-time" } }))).toBe("Remote");
  });

  it("appends a (Hybrid) suffix", () => {
    expect(buildLeverLocationText(posting({ workplaceType: "hybrid" }))).toBe("Palo Alto, CA (Hybrid)");
  });

  it("returns undefined when there is no place text and no remote/hybrid signal", () => {
    expect(buildLeverLocationText(posting({ workplaceType: "onsite", categories: { commitment: "Full-time" } }))).toBeUndefined();
  });

  it("handles a real Belvedere Trading-shaped posting (full state name, not an abbreviation)", () => {
    expect(
      buildLeverLocationText(posting({ workplaceType: "onsite", categories: { commitment: "Full-Time", location: "Chicago, Illinois" } })),
    ).toBe("Chicago, Illinois");
  });
});

describe("leverPostedDate", () => {
  it("converts a real unix-ms createdAt into an ISO date", () => {
    expect(leverPostedDate(posting({ createdAt: 1694463796009 }))).toBe("2023-09-11");
  });

  it("returns undefined when createdAt is missing", () => {
    expect(leverPostedDate(posting({ createdAt: undefined }))).toBeUndefined();
  });

  it("returns undefined for a non-finite createdAt rather than producing an Invalid Date string", () => {
    expect(leverPostedDate(posting({ createdAt: Number.NaN }))).toBeUndefined();
  });
});

describe("hostedUrlMatchesSlug", () => {
  it("matches a real Wealthfront hostedUrl against its configured slug", () => {
    expect(
      hostedUrlMatchesSlug("https://jobs.lever.co/wealthfront/78d6f6d5-1f08-4d5d-87be-c4250567bfb5", "wealthfront"),
    ).toBe(true);
  });

  it("matches a real Belvedere Trading hostedUrl against its configured slug", () => {
    expect(
      hostedUrlMatchesSlug("https://jobs.lever.co/belvederetrading/be7ab7fc-03c2-4192-adbe-eaf85e9588fe", "belvederetrading"),
    ).toBe(true);
  });

  it("rejects a hostedUrl scoped to a different slug", () => {
    expect(hostedUrlMatchesSlug("https://jobs.lever.co/someotherco/abc123", "wealthfront")).toBe(false);
  });

  it("rejects a missing hostedUrl", () => {
    expect(hostedUrlMatchesSlug(undefined, "wealthfront")).toBe(false);
  });

  it("rejects a missing slug", () => {
    expect(hostedUrlMatchesSlug("https://jobs.lever.co/wealthfront/abc123", "")).toBe(false);
  });

  it("is case-insensitive on both the URL and the slug", () => {
    expect(hostedUrlMatchesSlug("https://jobs.lever.co/Wealthfront/abc123", "wealthfront")).toBe(true);
  });
});
