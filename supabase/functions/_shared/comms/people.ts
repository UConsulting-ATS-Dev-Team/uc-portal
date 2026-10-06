// The list of everyone an admin might message, built the same way on the page (for the live recipient count) and in the send
// function (the copy that decides): portal accounts, plus the mailing list an admin imported. Pure mapping plus one loader
// that works with either kind of Supabase client.

import type { Person, PersonStatus } from "./audience.ts";

export interface AccountRow {
  member_id: string;
  display_name: string;
  email: string | null;
  role: "member" | "admin";
  member_status: "current_member" | "alumni" | "intern";
  created_at: string;
  class_year: number | null;
  avatar_url: string | null;
  phone: string | null;
  deactivated_at: string | null;
  last_active_at: string | null;
  views_30d: number;
}

export interface ContactRow {
  id: string;
  email: string;
  name: string | null;
  tags: string[] | null;
  subscribed: boolean;
  created_at: string;
}

export function accountToPerson(row: AccountRow): Person {
  return {
    key: `a:${row.member_id}`,
    source: "account",
    profileId: row.member_id,
    contactId: null,
    email: row.email,
    name: row.display_name,
    phone: row.phone,
    status: row.member_status as PersonStatus,
    role: row.role,
    classYear: row.class_year,
    joinedAt: row.created_at,
    lastActiveAt: row.last_active_at,
    deactivated: row.deactivated_at != null,
    tags: [],
    subscribed: true,
  };
}

export function contactToPerson(row: ContactRow): Person {
  return {
    key: `c:${row.id}`,
    source: "mailing_list",
    profileId: null,
    contactId: row.id,
    email: row.email,
    name: row.name?.trim() || row.email,
    phone: null,
    status: "contact",
    role: null,
    classYear: null,
    joinedAt: row.created_at,
    lastActiveAt: null,
    deactivated: false,
    tags: row.tags ?? [],
    subscribed: row.subscribed,
  };
}

// deno-lint-ignore no-explicit-any
type Client = any;

// `accountsRpc` is "admin_list_accounts" from a browser signed in as an admin, "comm_accounts_internal" from the service role.
export async function loadPeople(client: Client, accountsRpc: "admin_list_accounts" | "comm_accounts_internal"): Promise<{ people: Person[]; suppressedEmails: Set<string> }> {
  const [accounts, contacts, suppressions] = await Promise.all([
    client.rpc(accountsRpc),
    client.from("mailing_list_contacts").select("id, email, name, tags, subscribed, created_at").order("id"),
    client.from("comm_suppressions").select("email").order("email"),
  ]);
  for (const result of [accounts, contacts, suppressions]) if (result.error) throw new Error(result.error.message);
  return {
    people: [...(accounts.data as AccountRow[]).map(accountToPerson), ...(contacts.data as ContactRow[]).map(contactToPerson)],
    suppressedEmails: new Set((suppressions.data as Array<{ email: string }>).map((s) => s.email.toLowerCase())),
  };
}
