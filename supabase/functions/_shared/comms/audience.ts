// Who a mass message goes to. Pure logic with no Deno or React in it, so the admin page (to show a live recipient count) and
// the send function (the copy that actually decides) share one implementation, and vitest imports it directly.
//
// People come from two places only: real portal accounts, and the mailing list an admin deliberately imported. The alumni
// directory is NOT a source: it holds email addresses people never gave this portal, so mailing them is a decision an admin
// makes by importing them, not something an audience filter can reach by accident.

export type Channel = "email" | "slack" | "imessage";
export type PersonStatus = "current_member" | "alumni" | "intern" | "contact";

export interface Person {
  key: string; // "a:<profile id>" for an account, "c:<contact id>" for a mailing-list contact
  source: "account" | "mailing_list";
  profileId: string | null;
  contactId: string | null;
  email: string | null;
  name: string;
  phone: string | null;
  status: PersonStatus;
  role: "member" | "admin" | null;
  classYear: number | null;
  joinedAt: string | null; // ISO timestamp
  lastActiveAt: string | null; // ISO timestamp, null = never
  deactivated: boolean;
  tags: string[];
  subscribed: boolean; // mailing-list contacts can unsubscribe; accounts are always true
}

export type FieldKey = "source" | "status" | "role" | "classYear" | "joinedAt" | "inactiveDays" | "hasPhone" | "tag";
export type Op = "is" | "is_not" | "at_least" | "at_most" | "after" | "before" | "has" | "not_has";

export interface Condition {
  field: FieldKey;
  op: Op;
  value: string | number | boolean;
}

export interface Group {
  match: "all" | "any";
  conditions: Condition[];
}

export interface Audience {
  // How the groups combine. A group with no conditions matches everyone; an audience with no groups is everyone.
  match: "all" | "any";
  groups: Group[];
}

export const EMPTY_AUDIENCE: Audience = { match: "all", groups: [{ match: "all", conditions: [] }] };

export interface FieldDef {
  key: FieldKey;
  label: string;
  type: "enum" | "number" | "date" | "boolean" | "text";
  ops: Op[];
  options?: Array<{ value: string; label: string }>;
}

export const FIELD_DEFS: FieldDef[] = [
  {
    key: "status",
    label: "Membership",
    type: "enum",
    ops: ["is", "is_not"],
    options: [
      { value: "current_member", label: "Current member" },
      { value: "alumni", label: "Alumni" },
      { value: "intern", label: "Intern" },
      { value: "contact", label: "Mailing-list contact" },
    ],
  },
  {
    key: "role",
    label: "Access level",
    type: "enum",
    ops: ["is", "is_not"],
    options: [
      { value: "member", label: "Member" },
      { value: "admin", label: "Admin" },
    ],
  },
  {
    key: "source",
    label: "Where they come from",
    type: "enum",
    ops: ["is", "is_not"],
    options: [
      { value: "account", label: "Portal account" },
      { value: "mailing_list", label: "Mailing list" },
    ],
  },
  { key: "classYear", label: "Class year", type: "number", ops: ["is", "is_not", "at_least", "at_most"] },
  { key: "joinedAt", label: "Joined", type: "date", ops: ["after", "before"] },
  { key: "inactiveDays", label: "Days since last active", type: "number", ops: ["at_least", "at_most"] },
  { key: "hasPhone", label: "Has a phone number", type: "boolean", ops: ["is"] },
  { key: "tag", label: "Mailing-list tag", type: "text", ops: ["has", "not_has"] },
];

export const OP_LABEL: Record<Op, string> = {
  is: "is",
  is_not: "is not",
  at_least: "at least",
  at_most: "at most",
  after: "after",
  before: "before",
  has: "has",
  not_has: "doesn't have",
};

const DAY_MS = 86_400_000;

function inactiveDays(person: Person, now: Date): number {
  if (!person.lastActiveAt) return Number.POSITIVE_INFINITY; // never active counts as inactive for any threshold
  return Math.floor((now.getTime() - new Date(person.lastActiveAt).getTime()) / DAY_MS);
}

export function matchesCondition(person: Person, c: Condition, now: Date = new Date()): boolean {
  switch (c.field) {
    case "status":
    case "role":
    case "source": {
      const actual = c.field === "status" ? person.status : c.field === "role" ? person.role : person.source;
      return c.op === "is_not" ? actual !== c.value : actual === c.value;
    }
    case "classYear": {
      if (person.classYear == null) return c.op === "is_not";
      const n = Number(c.value);
      if (c.op === "is") return person.classYear === n;
      if (c.op === "is_not") return person.classYear !== n;
      if (c.op === "at_least") return person.classYear >= n;
      return person.classYear <= n;
    }
    case "joinedAt": {
      if (!person.joinedAt) return false;
      const joined = new Date(person.joinedAt).getTime();
      const boundary = new Date(`${c.value}T00:00:00`).getTime();
      return c.op === "after" ? joined >= boundary : joined < boundary;
    }
    case "inactiveDays": {
      const days = inactiveDays(person, now);
      const n = Number(c.value);
      return c.op === "at_least" ? days >= n : days <= n;
    }
    case "hasPhone":
      return Boolean(person.phone) === Boolean(c.value);
    case "tag": {
      const has = person.tags.some((t) => t.toLowerCase() === String(c.value).toLowerCase());
      return c.op === "not_has" ? !has : has;
    }
  }
}

function matchesGroup(person: Person, group: Group, now: Date): boolean {
  if (group.conditions.length === 0) return true;
  const test = (c: Condition) => matchesCondition(person, c, now);
  return group.match === "any" ? group.conditions.some(test) : group.conditions.every(test);
}

export function matchesAudience(person: Person, audience: Audience, now: Date = new Date()): boolean {
  if (audience.groups.length === 0) return true;
  const test = (g: Group) => matchesGroup(person, g, now);
  return audience.match === "any" ? audience.groups.some(test) : audience.groups.every(test);
}

export type ExcludeReason = "deactivated" | "unsubscribed" | "no_email" | "no_phone" | "duplicate";

export interface Resolved {
  recipients: Person[];
  excluded: Array<{ person: Person; reason: ExcludeReason }>;
}

export const EXCLUDE_LABEL: Record<ExcludeReason, string> = {
  deactivated: "Account deactivated",
  unsubscribed: "Unsubscribed",
  no_email: "No email address",
  no_phone: "No phone number",
  duplicate: "Duplicate of another recipient",
};

// Everyone who matches, minus those who can't or must not be contacted on this channel. An account outranks a mailing-list
// contact with the same email address when the two collide.
export function resolveAudience(
  people: Person[],
  audience: Audience,
  opts: { channel: Channel; suppressedEmails: Set<string>; now?: Date }
): Resolved {
  const now = opts.now ?? new Date();
  const matched = people.filter((p) => matchesAudience(p, audience, now));
  const ordered = [...matched].sort((a, b) => (a.source === b.source ? 0 : a.source === "account" ? -1 : 1));

  const recipients: Person[] = [];
  const excluded: Resolved["excluded"] = [];
  const seen = new Set<string>();

  for (const person of ordered) {
    const email = person.email?.trim().toLowerCase() ?? null;
    if (person.deactivated) {
      excluded.push({ person, reason: "deactivated" });
      continue;
    }
    if (opts.channel === "imessage") {
      if (!person.phone) {
        excluded.push({ person, reason: "no_phone" });
        continue;
      }
    } else if (opts.channel === "email") {
      if (!email) {
        excluded.push({ person, reason: "no_email" });
        continue;
      }
      if (!person.subscribed || opts.suppressedEmails.has(email)) {
        excluded.push({ person, reason: "unsubscribed" });
        continue;
      }
    } else if (!email) {
      // Slack finds people by their email address.
      excluded.push({ person, reason: "no_email" });
      continue;
    }
    const identity = opts.channel === "imessage" ? `p:${person.phone!.replace(/\D/g, "")}` : `e:${email}`;
    if (seen.has(identity)) {
      excluded.push({ person, reason: "duplicate" });
      continue;
    }
    seen.add(identity);
    recipients.push(person);
  }
  return { recipients, excluded };
}

export interface Preset {
  key: string;
  label: string;
  audience: Audience;
}

const one = (conditions: Condition[]): Audience => ({ match: "all", groups: [{ match: "all", conditions }] });

export const AUDIENCE_PRESETS: Preset[] = [
  { key: "everyone", label: "Everyone (accounts and mailing list)", audience: EMPTY_AUDIENCE },
  { key: "current", label: "Current members", audience: one([{ field: "status", op: "is", value: "current_member" }]) },
  { key: "alumni", label: "Alumni", audience: one([{ field: "status", op: "is", value: "alumni" }]) },
  { key: "interns", label: "Accelerator interns", audience: one([{ field: "status", op: "is", value: "intern" }]) },
  { key: "admins", label: "Admins", audience: one([{ field: "role", op: "is", value: "admin" }]) },
  {
    key: "inactive",
    label: "Haven't been active in 14+ days",
    audience: one([
      { field: "source", op: "is", value: "account" },
      { field: "inactiveDays", op: "at_least", value: 14 },
    ]),
  },
  { key: "contacts", label: "Mailing-list contacts", audience: one([{ field: "source", op: "is", value: "mailing_list" }]) },
];

// A short sentence describing an audience, for the log and the confirm step.
export function describeAudience(audience: Audience): string {
  const conditions = audience.groups.flatMap((g) => g.conditions);
  if (conditions.length === 0) return "Everyone";
  const label = (c: Condition) => {
    const def = FIELD_DEFS.find((f) => f.key === c.field)!;
    const value = def.options?.find((o) => o.value === String(c.value))?.label ?? String(c.value);
    return `${def.label.toLowerCase()} ${OP_LABEL[c.op]} ${def.type === "boolean" ? (c.value ? "yes" : "no") : value}`;
  };
  const groups = audience.groups
    .filter((g) => g.conditions.length > 0)
    .map((g) => g.conditions.map(label).join(g.match === "any" ? " or " : " and "));
  return groups.join(audience.match === "any" ? "; or " : "; and ");
}
