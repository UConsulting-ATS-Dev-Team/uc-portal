import { describe, it, expect } from "vitest";
import {
  AUDIENCE_PRESETS,
  EMPTY_AUDIENCE,
  describeAudience,
  matchesAudience,
  matchesCondition,
  resolveAudience,
  type Audience,
  type Person,
} from "../../supabase/functions/_shared/comms/audience.ts";
import {
  composeEmailHtml,
  fillMergeFields,
  fillMergeFieldsHtml,
  markdownToHtml,
  markdownToSlack,
  markdownToText,
  mergeVarsFor,
  previewLine,
  unknownMergeFields,
} from "../../supabase/functions/_shared/comms/render.ts";
import { signUnsubscribeToken, verifyUnsubscribeToken } from "../../supabase/functions/_shared/comms/unsubscribe.ts";
import { parseContactList } from "../../supabase/functions/_shared/comms/importParse.ts";
import { AUTO_EMAILS, effectiveCopy } from "../../supabase/functions/_shared/comms/autoEmails.ts";

const NOW = new Date(2026, 9, 6, 12, 0, 0);
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

function person(over: Partial<Person> = {}): Person {
  const id = over.key ?? "a:1";
  return {
    key: id,
    source: "account",
    profileId: id.startsWith("a:") ? id.slice(2) : null,
    contactId: id.startsWith("c:") ? id.slice(2) : null,
    email: `${id.replace(":", "")}@example.com`,
    name: "Pat Example",
    phone: null,
    status: "current_member",
    role: "member",
    classYear: 2027,
    joinedAt: "2026-09-01T00:00:00Z",
    lastActiveAt: daysAgo(2),
    deactivated: false,
    tags: [],
    subscribed: true,
    ...over,
  };
}

const all = (conditions: Audience["groups"][number]["conditions"]): Audience => ({ match: "all", groups: [{ match: "all", conditions }] });

describe("audience conditions", () => {
  it("matches membership, role and source, and their negations", () => {
    const alum = person({ status: "alumni" });
    expect(matchesCondition(alum, { field: "status", op: "is", value: "alumni" }, NOW)).toBe(true);
    expect(matchesCondition(alum, { field: "status", op: "is_not", value: "alumni" }, NOW)).toBe(false);
    expect(matchesCondition(person({ role: "admin" }), { field: "role", op: "is", value: "admin" }, NOW)).toBe(true);
    expect(matchesCondition(person({ source: "mailing_list" }), { field: "source", op: "is", value: "account" }, NOW)).toBe(false);
  });

  it("compares class years, treating an unknown year as 'not' anything", () => {
    const p = person({ classYear: 2027 });
    expect(matchesCondition(p, { field: "classYear", op: "is", value: 2027 }, NOW)).toBe(true);
    expect(matchesCondition(p, { field: "classYear", op: "at_least", value: 2028 }, NOW)).toBe(false);
    expect(matchesCondition(p, { field: "classYear", op: "at_most", value: 2028 }, NOW)).toBe(true);
    const unknown = person({ classYear: null });
    expect(matchesCondition(unknown, { field: "classYear", op: "is", value: 2027 }, NOW)).toBe(false);
    expect(matchesCondition(unknown, { field: "classYear", op: "is_not", value: 2027 }, NOW)).toBe(true);
  });

  it("filters by join date", () => {
    const p = person({ joinedAt: "2026-09-15T12:00:00Z" });
    expect(matchesCondition(p, { field: "joinedAt", op: "after", value: "2026-09-01" }, NOW)).toBe(true);
    expect(matchesCondition(p, { field: "joinedAt", op: "before", value: "2026-09-01" }, NOW)).toBe(false);
    expect(matchesCondition(person({ joinedAt: null }), { field: "joinedAt", op: "after", value: "2026-01-01" }, NOW)).toBe(false);
  });

  it("counts someone who has never been active as inactive for any threshold", () => {
    const never = person({ lastActiveAt: null });
    expect(matchesCondition(never, { field: "inactiveDays", op: "at_least", value: 365 }, NOW)).toBe(true);
    expect(matchesCondition(never, { field: "inactiveDays", op: "at_most", value: 365 }, NOW)).toBe(false);
    const recent = person({ lastActiveAt: daysAgo(3) });
    expect(matchesCondition(recent, { field: "inactiveDays", op: "at_least", value: 14 }, NOW)).toBe(false);
    expect(matchesCondition(person({ lastActiveAt: daysAgo(20) }), { field: "inactiveDays", op: "at_least", value: 14 }, NOW)).toBe(true);
  });

  it("matches phone presence and tags case-insensitively", () => {
    expect(matchesCondition(person({ phone: "3105551234" }), { field: "hasPhone", op: "is", value: true }, NOW)).toBe(true);
    expect(matchesCondition(person({ phone: null }), { field: "hasPhone", op: "is", value: true }, NOW)).toBe(false);
    const tagged = person({ tags: ["Speaker Series"] });
    expect(matchesCondition(tagged, { field: "tag", op: "has", value: "speaker series" }, NOW)).toBe(true);
    expect(matchesCondition(tagged, { field: "tag", op: "not_has", value: "speaker series" }, NOW)).toBe(false);
  });
});

describe("audience groups", () => {
  it("treats an empty audience as everyone", () => {
    expect(matchesAudience(person(), EMPTY_AUDIENCE, NOW)).toBe(true);
    expect(matchesAudience(person(), { match: "all", groups: [] }, NOW)).toBe(true);
  });

  it("combines conditions in a group with all or any", () => {
    const p = person({ status: "alumni", classYear: 2020 });
    const everything = all([
      { field: "status", op: "is", value: "alumni" },
      { field: "classYear", op: "at_least", value: 2025 },
    ]);
    expect(matchesAudience(p, everything, NOW)).toBe(false);
    const either: Audience = {
      match: "all",
      groups: [
        {
          match: "any",
          conditions: [
            { field: "status", op: "is", value: "alumni" },
            { field: "classYear", op: "at_least", value: 2025 },
          ],
        },
      ],
    };
    expect(matchesAudience(p, either, NOW)).toBe(true);
  });

  it("combines groups with all or any", () => {
    const interns = { match: "all" as const, conditions: [{ field: "status" as const, op: "is" as const, value: "intern" }] };
    const admins = { match: "all" as const, conditions: [{ field: "role" as const, op: "is" as const, value: "admin" }] };
    const internOrAdmin: Audience = { match: "any", groups: [interns, admins] };
    expect(matchesAudience(person({ role: "admin" }), internOrAdmin, NOW)).toBe(true);
    expect(matchesAudience(person(), internOrAdmin, NOW)).toBe(false);
    expect(matchesAudience(person({ status: "intern", role: "admin" }), { match: "all", groups: [interns, admins] }, NOW)).toBe(true);
  });

  it("describes an audience in words", () => {
    expect(describeAudience(EMPTY_AUDIENCE)).toBe("Everyone");
    expect(describeAudience(all([{ field: "status", op: "is", value: "alumni" }, { field: "classYear", op: "at_least", value: 2020 }]))).toBe(
      "membership is Alumni and class year at least 2020"
    );
  });

  it("ships presets that match who they say", () => {
    const preset = (key: string) => AUDIENCE_PRESETS.find((p) => p.key === key)!.audience;
    expect(matchesAudience(person({ status: "alumni" }), preset("alumni"), NOW)).toBe(true);
    expect(matchesAudience(person({ status: "current_member" }), preset("alumni"), NOW)).toBe(false);
    expect(matchesAudience(person({ source: "mailing_list", status: "contact" }), preset("contacts"), NOW)).toBe(true);
    expect(matchesAudience(person({ lastActiveAt: daysAgo(30) }), preset("inactive"), NOW)).toBe(true);
    expect(matchesAudience(person({ source: "mailing_list", lastActiveAt: null }), preset("inactive"), NOW)).toBe(false);
  });
});

describe("resolving recipients", () => {
  const suppressed = new Set(["gone@example.com"]);
  const resolve = (people: Person[], channel: "email" | "slack" | "imessage" = "email") =>
    resolveAudience(people, EMPTY_AUDIENCE, { channel, suppressedEmails: suppressed, now: NOW });

  it("leaves out deactivated accounts, unsubscribed contacts, suppressed addresses and people with no address", () => {
    const people = [
      person({ key: "a:1" }),
      person({ key: "a:2", deactivated: true }),
      person({ key: "c:3", source: "mailing_list", status: "contact", subscribed: false }),
      person({ key: "a:4", email: "gone@example.com" }),
      person({ key: "a:5", email: null }),
    ];
    const r = resolve(people);
    expect(r.recipients.map((p) => p.key)).toEqual(["a:1"]);
    expect(Object.fromEntries(r.excluded.map((e) => [e.person.key, e.reason]))).toEqual({
      "a:2": "deactivated",
      "c:3": "unsubscribed",
      "a:4": "unsubscribed",
      "a:5": "no_email",
    });
  });

  it("sends one message per address, preferring the account over a mailing-list copy", () => {
    const people = [
      person({ key: "c:9", source: "mailing_list", status: "contact", email: "same@example.com" }),
      person({ key: "a:1", email: "Same@Example.com" }),
    ];
    const r = resolve(people);
    expect(r.recipients.map((p) => p.key)).toEqual(["a:1"]);
    expect(r.excluded[0]).toMatchObject({ reason: "duplicate" });
  });

  it("needs a phone number for iMessage and only an email for Slack", () => {
    const people = [person({ key: "a:1", phone: "(310) 555-1234" }), person({ key: "a:2", phone: null })];
    expect(resolve(people, "imessage").recipients.map((p) => p.key)).toEqual(["a:1"]);
    expect(resolve(people, "slack").recipients).toHaveLength(2);
  });

  it("does not apply the email unsubscribe list to iMessage", () => {
    const p = person({ key: "a:1", phone: "3105551234", email: "gone@example.com" });
    expect(resolve([p], "imessage").recipients).toHaveLength(1);
  });
});

describe("merge fields", () => {
  it("splits a name into first and last", () => {
    expect(mergeVarsFor({ name: "Pat Q. Example", email: "p@example.com" })).toEqual({
      firstName: "Pat",
      lastName: "Q. Example",
      fullName: "Pat Q. Example",
      email: "p@example.com",
    });
    expect(mergeVarsFor({ name: "", email: null }).firstName).toBe("");
  });

  it("fills known fields and leaves unknown ones visible", () => {
    const vars = mergeVarsFor({ name: "Pat Example", email: "p@example.com" });
    expect(fillMergeFields("Hi {{firstName}}, {{ fullName }} <{{email}}> {{nope}}", vars)).toBe("Hi Pat, Pat Example <p@example.com> {{nope}}");
  });

  it("escapes values placed into HTML", () => {
    const html = fillMergeFieldsHtml("<p>Hi {{firstName}}</p>", { firstName: "<b>Pat</b>" });
    expect(html).toBe("<p>Hi &lt;b&gt;Pat&lt;/b&gt;</p>");
  });

  it("reports fields that are not merge fields", () => {
    expect(unknownMergeFields("Hi {{firstName}} and {{frstName}} {{other}}")).toEqual(["frstName", "other"]);
  });
});

describe("markdown", () => {
  it("makes paragraphs, line breaks, bold, italic and links", () => {
    const html = markdownToHtml("Hello **there** and *friend*\nsecond line\n\n[UC](https://example.com/a?b=1&c=2)");
    expect(html).toContain("<strong>there</strong>");
    expect(html).toContain("<em>friend</em>");
    expect(html).toContain("<br>second line");
    expect(html).toContain('<a href="https://example.com/a?b=1&amp;c=2"');
    expect(html.match(/<p /g)).toHaveLength(2);
  });

  it("makes bullet lists", () => {
    const html = markdownToHtml("- one\n- two *x*");
    expect(html).toContain("<ul");
    expect(html.match(/<li/g)).toHaveLength(2);
    expect(html).toContain("<em>x</em>");
  });

  it("escapes raw HTML and refuses unsafe link schemes", () => {
    const html = markdownToHtml('<script>alert(1)</script> [x](javascript:alert(1))');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<a ");
  });

  it("produces readable plain text", () => {
    expect(markdownToText("**Hi** [site](https://example.com)")).toBe("Hi site (https://example.com)");
    expect(previewLine("**A very long line** ".repeat(20), 30).length).toBeLessThanOrEqual(30);
  });

  it("wraps a body in the branded layout with an unsubscribe link only when given one", () => {
    const withLink = composeEmailHtml({ bodyHtml: "<p>Hi</p>", unsubscribeUrl: "https://example.com/u?t=a.b" });
    expect(withLink).toContain("<p>Hi</p>");
    expect(withLink).toContain("Unsubscribe");
    expect(withLink).toContain("https://example.com/u?t=a.b");
    expect(composeEmailHtml({ bodyHtml: "<p>Hi</p>" })).not.toContain("Unsubscribe");
  });
});

describe("unsubscribe tokens", () => {
  it("round-trips an address and normalizes its case", async () => {
    const token = await signUnsubscribeToken("Pat@Example.com", "secret");
    expect(await verifyUnsubscribeToken(token, "secret")).toBe("pat@example.com");
  });

  it("rejects a tampered address, a wrong secret and garbage", async () => {
    const token = await signUnsubscribeToken("pat@example.com", "secret");
    const [, signature] = token.split(".");
    const other = await signUnsubscribeToken("someone@example.com", "secret");
    const forged = `${other.split(".")[0]}.${signature}`;
    expect(await verifyUnsubscribeToken(forged, "secret")).toBe(null);
    expect(await verifyUnsubscribeToken(token, "different")).toBe(null);
    expect(await verifyUnsubscribeToken("nonsense", "secret")).toBe(null);
    expect(await verifyUnsubscribeToken("", "secret")).toBe(null);
  });
});

describe("Slack formatting", () => {
  it("converts bold, italic, links and bullets to Slack's own markup", () => {
    expect(markdownToSlack("**Hi** *there* [site](https://example.com)\n- one\n- two")).toBe("*Hi* _there_ <https://example.com|site>\n• one\n• two");
  });
});

describe("importing contacts", () => {
  it("reads email, name and tags with no header", () => {
    const r = parseContactList("pat@example.com, Pat Example, alumni|speaker\nsam@example.com");
    expect(r.rows).toEqual([
      { email: "pat@example.com", name: "Pat Example", tags: ["alumni", "speaker"] },
      { email: "sam@example.com", name: null, tags: [] },
    ]);
  });

  it("honors a header row in any column order, and quoted cells", () => {
    const r = parseContactList('Tags,Name,Email\n"a;b","Last, First",x@example.com');
    expect(r.rows).toEqual([{ email: "x@example.com", name: "Last, First", tags: ["a", "b"] }]);
  });

  it("reads tab- and semicolon-separated lists", () => {
    expect(parseContactList("a@example.com\tAnn").rows[0].name).toBe("Ann");
    expect(parseContactList("email;name\nb@example.com;Bo").rows[0]).toMatchObject({ email: "b@example.com", name: "Bo" });
  });

  it("lowercases addresses, drops repeats and reports bad lines", () => {
    const r = parseContactList("A@Example.com\na@example.com\nnot-an-email\n, nobody");
    expect(r.rows.map((x) => x.email)).toEqual(["a@example.com"]);
    expect(r.duplicates).toBe(1);
    expect(r.problems.map((p) => p.line)).toEqual([3, 4]);
  });
});

describe("automatic emails", () => {
  it("only uses merge fields it declares", () => {
    for (const def of AUTO_EMAILS) {
      const allowed = ["firstName", "lastName", "fullName", "email", ...def.fields];
      expect(unknownMergeFields(`${def.subject}\n${def.body}`, allowed), def.key).toEqual([]);
      for (const field of def.fields) expect(def.sample[field], `${def.key} sample for ${field}`).toBeTruthy();
    }
  });

  it("uses an admin's wording over the default, and the default when there is none", () => {
    const def = AUTO_EMAILS[0];
    expect(effectiveCopy(def, null)).toEqual({ subject: def.subject, body: def.body });
    expect(effectiveCopy(def, { subject: "  ", body: "Custom" })).toEqual({ subject: def.subject, body: "Custom" });
  });
});
