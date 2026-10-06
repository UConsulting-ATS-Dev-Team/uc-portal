// The automatic emails the portal can send on its own, and their default wording. An admin turns each on or off and edits the text
// on the Automatic emails page (stored in auto_email_settings); the daily run-automatic-emails function does the sending. Every
// one is OFF until an admin switches it on, and none sends while email isn't connected.
//
// Shared by that page and the function, so both agree on the fields each email can use.

export interface AutoEmailDef {
  key: string;
  label: string;
  when: string; // when it goes out
  who: string; // who gets it
  description: string;
  fields: string[]; // merge fields beyond the standard ones, filled in per person when it is queued
  sample: Record<string, string>; // what the preview and a test email show for those fields
  subject: string;
  body: string;
}

export const AUTO_EMAILS: AutoEmailDef[] = [
  {
    key: "weekly_digest",
    label: "Weekly digest",
    when: "Mondays, after the digest is computed",
    who: "Members with something to report that week (new matches, deadlines, unread messages, new posts)",
    description: "The week's summary the portal already computes, sent to each member's inbox.",
    fields: ["digest"],
    sample: { digest: "3 new roles match your profile. 1 application deadline this week. 2 unread messages." },
    subject: "Your week at UC",
    body: "Hi {{firstName}},\n\n{{digest}}\n\nSee everything in the portal.",
  },
  {
    key: "accelerator_assignment_due",
    label: "Accelerator assignment due soon",
    when: "Daily, for an assignment due within two days",
    who: "Interns who haven't submitted it yet",
    description: "A reminder before a weekly assignment's due date.",
    fields: ["lessonTitle", "weekNumber", "dueDate"],
    sample: { lessonTitle: "Presentation Skills", weekNumber: "1", dueDate: "Monday, October 12" },
    subject: "Week {{weekNumber}} assignment due {{dueDate}}",
    body: "Hi {{firstName}},\n\nYour week {{weekNumber}} assignment, **{{lessonTitle}}**, is due {{dueDate}}. Submit it in the portal under Accelerator, then Assignments.",
  },
  {
    key: "accelerator_chats_due",
    label: "Coffee chats due at the next accelerator meeting",
    when: "Daily, the day before an accelerator meeting",
    who: "Interns who haven't logged all three coffee chats for the week",
    description: "Coffee chats are due at every accelerator meeting. This goes out the day before to anyone still short.",
    fields: ["meetingTime", "chatsLogged"],
    sample: { meetingTime: "Wednesday, October 14 at 6:00 PM", chatsLogged: "1" },
    subject: "Your coffee chats are due {{meetingTime}}",
    body: "Hi {{firstName}},\n\nYou've logged {{chatsLogged}} of 3 coffee chats for this week. They're due at the accelerator meeting on {{meetingTime}}: two with club members and one with another intern or a third club member. Log them in the portal under Accelerator, then Coffee chats.",
  },
];

export const autoEmailDef = (key: string) => AUTO_EMAILS.find((a) => a.key === key);

export interface AutoEmailSetting {
  key: string;
  enabled: boolean;
  subject: string | null;
  body: string | null;
}

// The wording in effect: an admin's edit if there is one, the default otherwise.
export function effectiveCopy(def: AutoEmailDef, setting?: Pick<AutoEmailSetting, "subject" | "body"> | null) {
  return { subject: setting?.subject?.trim() || def.subject, body: setting?.body?.trim() || def.body };
}
