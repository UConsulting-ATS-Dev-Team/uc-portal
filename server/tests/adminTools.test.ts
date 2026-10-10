import { describe, expect, it } from "vitest";
// @ts-expect-error plain JS module
import { toCsv } from "../../data/csvExport.js";
// @ts-expect-error plain JS module
import { mainSectionsFor, mainHomeItemFor, mainItemsFor, LEADERSHIP_SECTIONS } from "../../data/navItems.js";

describe("CSV export", () => {
  it("quotes cells with commas, quotes and line breaks", () => {
    expect(toCsv(["a", "b"], [["x, y", 'say "hi"'], ["line\nbreak", ""]])).toBe('a,b\r\n"x, y","say ""hi"""\r\n"line\nbreak",');
  });

  it("writes empty cells for null and undefined, and keeps numbers as they are", () => {
    expect(toCsv(["n", "m", "k"], [[null, undefined, 0]])).toBe("n,m,k\r\n,,0");
  });

  it("stops a cell from running as a spreadsheet formula, but leaves negative numbers alone", () => {
    expect(toCsv(["v"], [["=SUM(A1)"], ["+1 555"], ["-3"], ["@home"]])).toBe("v\r\n'=SUM(A1)\r\n'+1 555\r\n-3\r\n'@home");
  });
});

describe("main nav groups", () => {
  const labels = (account: object) => mainSectionsFor(account).map((g: { section: string; items: { label: string }[] }) => [g.section, g.items.map((i) => i.label)]);

  it("groups a current member's links in rail order, with Home standing on its own above them", () => {
    expect(mainHomeItemFor({ isIntern: false, isAlumni: false, isAdmin: false }).label).toBe("Home");
    expect(labels({ isIntern: false, isAlumni: false, isAdmin: false })).toEqual([
      ["Recruiting", ["Jobs", "Applications"]],
      ["Community", ["Network", "Feed", "Companies"]],
      ["Learning", ["Career Resources", "Accelerator"]],
      ["Account", ["My Profile"]],
    ]);
  });

  it("drops groups with nothing left for alumni and interns", () => {
    expect(mainHomeItemFor({ isAlumni: true })).toBeUndefined();
    expect(mainHomeItemFor({ isIntern: true })).toBeUndefined();
    expect(labels({ isIntern: false, isAlumni: true, isAdmin: false })).toEqual([
      ["Community", ["Network", "Feed", "Companies"]],
      ["Account", ["My Profile"]],
    ]);
    expect(labels({ isIntern: true, isAlumni: false, isAdmin: false })).toEqual([
      ["Learning", ["Accelerator"]],
      ["Account", ["My Profile"]],
    ]);
  });

  it("gives every account's links a group, so none disappear from the rail", () => {
    for (const account of [{ isAdmin: false }, { isAdmin: true }, { isAlumni: true }, { isIntern: true }]) {
      const grouped = [mainHomeItemFor(account)?.to, ...mainSectionsFor(account).flatMap((g: { items: { to: string }[] }) => g.items.map((i) => i.to))].filter(Boolean);
      expect(grouped.sort()).toEqual(mainItemsFor(account).map((i: { to: string }) => i.to).sort());
    }
  });

  it("title-cases the admin menu labels", () => {
    for (const group of LEADERSHIP_SECTIONS) {
      for (const item of group.items as { label: string }[]) {
        const words = item.label.split(" ").filter((w) => w.length > 3);
        for (const word of words) expect(word[0], `${item.label}: ${word}`).toBe(word[0].toUpperCase());
      }
    }
  });
});
